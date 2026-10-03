import bcrypt from "bcryptjs";
import User from "../models/User.js";

const guestEmail = process.env.GUEST_EMAIL;
const guestPassword = process.env.GUEST_PASSWORD;

export default async function ensureGuestAccount() {
	let user = await User.findOne({ email: guestEmail }).select("+passwordHash");
	if (!user) {
		const passwordHash = await bcrypt.hash(guestPassword, 12);
		try {
			user = await User.create({
				email: guestEmail,
				passwordHash,
				emailVerified: true,
			});
		} catch (error) {
			if (error?.code !== 11000) throw error;
			user = await User.findOne({ email: guestEmail }).select("+passwordHash");
			if (!user) throw error;
		}
	}

	if (
		!user.passwordHash ||
		!(await bcrypt.compare(guestPassword, user.passwordHash)) ||
		!user.emailVerified
	) {
		user.passwordHash = await bcrypt.hash(guestPassword, 12);
		user.emailVerified = true;
		await user.save();
	}

	console.log("Guest account is ready.");
}
