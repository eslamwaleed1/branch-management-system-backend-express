import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import User from "../models/User.js";

const router = express.Router();
const passwordPattern = /^.{8,128}$/s;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
	/\/$/,
	"",
);
const googleCallbackUrl =
	process.env.GOOGLE_CALLBACK_URL ||
	`http://localhost:${process.env.PORT || 5000}/api/auth/google/callback`;
const verificationCodeLifetimeMs = 10 * 60 * 1000;
const verificationResendDelayMs = 60 * 1000;
const maxVerificationAttempts = 5;

const csrfTokenFor = (req) => {
	if (!req.session.csrfToken) {
		req.session.csrfToken = randomBytes(32).toString("hex");
	}
	return req.session.csrfToken;
};

const requireCsrf = (req, res, next) => {
	const sessionToken = req.session.csrfToken;
	const submittedToken = req.get("X-CSRF-Token");
	if (
		typeof sessionToken !== "string" ||
		typeof submittedToken !== "string" ||
		sessionToken.length !== submittedToken.length ||
		!timingSafeEqual(Buffer.from(sessionToken), Buffer.from(submittedToken))
	) {
		return res.status(403).json({ message: "Invalid or missing CSRF token" });
	}
	next();
};

const normalizeEmail = (value) =>
	typeof value === "string" ? value.trim().toLowerCase() : "";

const validEmail = (email) =>
	email.length <= 254 && emailPattern.test(email);

const publicUser = (user) => ({ id: user.id, email: user.email });

const sendVerificationCode = async (user) => {
	const host = process.env.SMTP_HOST;
	const port = Number(process.env.SMTP_PORT || 587);
	const username = process.env.SMTP_USER;
	const password = process.env.SMTP_PASS;
	const from = process.env.EMAIL_FROM || username;
	if (!host || !Number.isInteger(port) || !username || !password || !from) {
		const error = new Error("Email delivery is not configured on the server");
		error.code = "EMAIL_NOT_CONFIGURED";
		throw error;
	}

	const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
	user.emailVerificationCodeHash = await bcrypt.hash(code, 10);
	user.emailVerificationExpiresAt = new Date(
		Date.now() + verificationCodeLifetimeMs,
	);
	user.emailVerificationAttempts = 0;
	await user.save();

	const transporter = nodemailer.createTransport({
		host,
		port,
		secure: process.env.SMTP_SECURE === "true" || port === 465,
		auth: { user: username, pass: password },
	});
	await transporter.sendMail({
		from,
		to: user.email,
		subject: "Verify your email address",
		text: `Your verification code is ${code}. It expires in 10 minutes.`,
		html: `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes.</p>`,
	});
	user.verificationEmailSentAt = new Date();
	await user.save();
};

const establishSession = (req, userId) =>
	new Promise((resolve, reject) => {
		req.session.regenerate((error) => {
			if (error) return reject(error);
			req.session.userId = userId;
			req.session.csrfToken = randomBytes(32).toString("hex");
			req.session.save((saveError) => {
				if (saveError) return reject(saveError);
				resolve();
			});
		});
	});

const googleFailureUrl = (intent) =>
	`${frontendUrl}/${intent === "signup" ? "signup" : "login"}?error=google`;

router.get("/csrf", (req, res, next) => {
	const csrfToken = csrfTokenFor(req);
	req.session.save((error) => {
		if (error) return next(error);
		res.json({ csrfToken });
	});
});

router.get("/session", async (req, res, next) => {
	res.set("Cache-Control", "no-store");
	if (typeof req.session.userId !== "string") {
		return res.status(401).json({ message: "No authenticated session" });
	}

	try {
		const user = await User.findById(req.session.userId);
		if (!user) {
			return req.session.destroy((error) => {
				if (error) return next(error);
				res.clearCookie("bms.sid");
				res.status(401).json({ message: "The authenticated account no longer exists" });
			});
		}
		res.json({ user: publicUser(user) });
	} catch (error) {
		next(error);
	}
});

router.post("/signup", requireCsrf, async (req, res, next) => {
	const email = normalizeEmail(req.body?.email);
	const { password } = req.body || {};
	if (
		!validEmail(email) ||
		typeof password !== "string" ||
		!passwordPattern.test(password)
	) {
		return res.status(400).json({
			message: "Enter a valid email and a password between 8 and 128 characters",
		});
	}

	try {
		const passwordHash = await bcrypt.hash(password, 12);
		const user = await User.create({ email, passwordHash });
		try {
			await sendVerificationCode(user);
		} catch (error) {
			console.error("Verification email delivery failed:", error.message);
			return res.status(503).json({
				code: "VERIFICATION_EMAIL_FAILED",
				message:
					"Your account was created, but we couldn't send the verification code. Check the email service configuration and request a new code.",
			});
		}
		res.status(201).json({
			message: "Verification code sent",
			user: publicUser(user),
		});
	} catch (error) {
		if (error?.code === 11000) {
			return res
				.status(409)
				.json({ message: "An account with this email already exists" });
		}
		next(error);
	}
});

router.post("/verification/resend", requireCsrf, async (req, res, next) => {
	const email = normalizeEmail(req.body?.email);
	if (!validEmail(email)) {
		return res.status(400).json({ message: "Enter a valid email address" });
	}

	try {
		const user = await User.findOne({ email }).select(
			"+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts",
		);
		if (!user || user.emailVerified) {
			return res.json({
				message: "If the account needs verification, a new code will be sent.",
			});
		}

		if (
			user.verificationEmailSentAt &&
			Date.now() - user.verificationEmailSentAt.getTime() <
				verificationResendDelayMs
		) {
			return res.status(429).json({
				message: "Please wait a minute before requesting another code.",
			});
		}

		try {
			await sendVerificationCode(user);
		} catch (error) {
			console.error("Verification email delivery failed:", error.message);
			return res.status(503).json({
				message: "We couldn't send a verification code. Please try again later.",
			});
		}
		res.json({ message: "A new verification code has been sent." });
	} catch (error) {
		next(error);
	}
});

router.post("/verification/confirm", requireCsrf, async (req, res, next) => {
	const email = normalizeEmail(req.body?.email);
	const code = req.body?.code;
	if (!validEmail(email) || typeof code !== "string" || !/^\d{6}$/.test(code)) {
		return res.status(400).json({ message: "Enter a valid email and 6-digit code" });
	}

	try {
		const user = await User.findOne({ email }).select(
			"+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts",
		);
		if (!user?.emailVerificationCodeHash || user.emailVerified) {
			return res.status(400).json({ message: "The verification code is invalid or expired" });
		}
		if (
			!user.emailVerificationExpiresAt ||
			user.emailVerificationExpiresAt.getTime() <= Date.now() ||
			user.emailVerificationAttempts >= maxVerificationAttempts
		) {
			return res.status(400).json({
				message: "The verification code is invalid or expired. Request a new code.",
			});
		}

		if (!(await bcrypt.compare(code, user.emailVerificationCodeHash))) {
			user.emailVerificationAttempts += 1;
			await user.save();
			return res.status(400).json({
				message: "The verification code is incorrect. Check it and try again.",
			});
		}

		user.emailVerified = true;
		user.emailVerificationCodeHash = undefined;
		user.emailVerificationExpiresAt = undefined;
		user.emailVerificationAttempts = 0;
		await user.save();
		await establishSession(req, user.id);
		res.json({ user: publicUser(user) });
	} catch (error) {
		next(error);
	}
});

router.post("/login", requireCsrf, async (req, res, next) => {
	const email = normalizeEmail(req.body?.email);
	const { password } = req.body || {};
	if (!validEmail(email) || typeof password !== "string") {
		return res.status(400).json({ message: "Enter a valid email and password" });
	}

	try {
		const user = await User.findOne({ email }).select("+passwordHash");
		if (
			!user?.passwordHash ||
			!(await bcrypt.compare(password, user.passwordHash))
		) {
			return res.status(401).json({ message: "Invalid email or password" });
		}
		if (!user.emailVerified) {
			return res.status(403).json({
				code: "EMAIL_NOT_VERIFIED",
				message: "Verify your email address before signing in.",
			});
		}

		await establishSession(req, user.id);
		res.json({ user: publicUser(user) });
	} catch (error) {
		next(error);
	}
});

router.post("/logout", requireCsrf, (req, res, next) => {
	req.session.destroy((error) => {
		if (error) return next(error);
		res.clearCookie("bms.sid");
		res.status(204).end();
	});
});

router.get("/google", (req, res, next) => {
	const intent = req.query.intent === "signup" ? "signup" : "login";
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
		return res.status(503).json({ message: "Google sign-in is not configured" });
	}

	const state = randomBytes(32).toString("hex");
	req.session.googleOAuthState = state;
	req.session.googleAuthIntent = intent;
	req.session.save((error) => {
		if (error) return next(error);
		const query = new URLSearchParams({
			client_id: process.env.GOOGLE_CLIENT_ID,
			redirect_uri: googleCallbackUrl,
			response_type: "code",
			scope: "openid email profile",
			state,
		});
		res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
	});
});

router.get("/google/callback", async (req, res) => {
	const intent = req.session.googleAuthIntent;
	const expectedState = req.session.googleOAuthState;
	const returnedState = req.query.state;
	if (
		typeof expectedState !== "string" ||
		typeof returnedState !== "string" ||
		expectedState.length !== returnedState.length ||
		!timingSafeEqual(Buffer.from(expectedState), Buffer.from(returnedState))
	) {
		return res.redirect(googleFailureUrl(intent));
	}

	delete req.session.googleOAuthState;
	delete req.session.googleAuthIntent;
	const redirectOnError = googleFailureUrl(intent);

	try {
		if (req.query.error || typeof req.query.code !== "string") {
			return res.redirect(redirectOnError);
		}
		const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code: req.query.code,
				client_id: process.env.GOOGLE_CLIENT_ID || "",
				client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
				redirect_uri: googleCallbackUrl,
				grant_type: "authorization_code",
			}),
		});
		const tokens = await tokenResponse.json();
		if (!tokenResponse.ok || typeof tokens.access_token !== "string") {
			throw new Error("Google token exchange failed");
		}

		const profileResponse = await fetch(
			"https://www.googleapis.com/oauth2/v2/userinfo",
			{ headers: { Authorization: `Bearer ${tokens.access_token}` } },
		);
		const profile = await profileResponse.json();
		if (
			!profileResponse.ok ||
			profile.verified_email !== true ||
			typeof profile.id !== "string" ||
			!validEmail(normalizeEmail(profile.email))
		) {
			throw new Error("Google did not return a verified email address");
		}

		const email = normalizeEmail(profile.email);
		let user = await User.findOne({
			$or: [{ googleId: profile.id }, { email }],
		});
		if (!user && intent === "signup") {
			user = await User.create({
				email,
				googleId: profile.id,
				emailVerified: true,
			});
		} else if (!user) {
			return res.redirect(redirectOnError);
		} else if (user.googleId && user.googleId !== profile.id) {
			return res.redirect(redirectOnError);
		} else if (!user.googleId) {
			user.googleId = profile.id;
			user.emailVerified = true;
			await user.save();
		} else if (!user.emailVerified) {
			user.emailVerified = true;
			await user.save();
		}

		await establishSession(req, user.id);
		res.redirect(`${frontendUrl}/auth/callback`);
	} catch (error) {
		console.error("Google authentication failed:", error.message);
		res.redirect(redirectOnError);
	}
});

export default router;
