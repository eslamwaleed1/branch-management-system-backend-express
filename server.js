import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import { randomBytes } from "node:crypto";
import "dotenv/config";
import authRoutes from "./server/routes/authRoutes.js";
import employeeRoutes from "./server/routes/employeeRoutes.js";
import productRoutes from "./server/routes/productRoutes.js";
import clientRoutes from "./server/routes/clientRoutes.js";
import saleRoutes from "./server/routes/saleRoutes.js";
import branchRoutes from "./server/routes/branchRoutes.js";
import ensureGuestAccount from "./server/utils/ensureGuestAccount.js";

const app = express();
const allowedOrigins = [
	"http://localhost:5173",
	...(process.env.FRONTEND_ORIGINS || "")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean),
];
const production = process.env.NODE_ENV === "production";
if (production && !process.env.SESSION_SECRET) {
	throw new Error("SESSION_SECRET must be configured in production");
}

app.set("trust proxy", 1);
app.use(
	cors({
		origin: function (origin, callback) {
			if (!origin) return callback(null, true);
			const isAllowedOrigin = allowedOrigins.includes(origin);
			if (!isAllowedOrigin) {
				const msg =
					"The CORS policy for this site does not allow access from the specified Origin.";
				return callback(new Error(msg), false);
			}
			return callback(null, true);
		},
		credentials: true,
	}),
);
app.use(express.json());
const authSession = session({
	name: "bms.sid",
	secret: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
	resave: false,
	saveUninitialized: false,
	store: process.env.MONGODB_URI
		? MongoStore.create({
				mongoUrl: process.env.MONGODB_URI,
				collectionName: "auth_sessions",
			})
		: undefined,
	cookie: {
		httpOnly: true,
		secure: production,
		sameSite: production ? "none" : "lax",
		maxAge: 7 * 24 * 60 * 60 * 1000,
	},
});
app.use("/api/auth", authSession, authRoutes);
app.use("/api/auth", (error, req, res, next) => {
	console.error("Authentication request failed:", error.message);
	if (res.headersSent) return next(error);
	res.status(500).json({ message: "Authentication service failed" });
});
app.use("/api/employees", employeeRoutes);
app.use("/api/products", productRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/branches", branchRoutes);

app.get("/api/test", (req, res) => {
	res.json({ message: "Hello from the backend!" });
});

const PORT = process.env.PORT || 5000;
const DB_URI = process.env.MONGODB_URI;

const startServer = () => {
	app.listen(PORT, () => {
		console.log(`🚀 Server running on http://localhost:${PORT}`);
	});
};

const connectDB = async () => {
	try {
		if (!DB_URI) {
			console.warn(
				"⚠️ MONGODB_URI is missing. Starting server without MongoDB.",
			);
			return startServer();
		}

		await mongoose.connect(DB_URI);
		console.log("🔹 MongoDB connected successfully.");
		try {
			await ensureGuestAccount();
		} catch (error) {
			console.error("Guest account initialization failed:", error.message);
		}
		startServer();
	} catch (error) {
		console.error("❌ Database connection failed:", error.message);
		console.warn(
			"⚠️ Starting server without a database connection. Mongo-backed routes will fail until MongoDB is reachable.",
		);
		startServer();
	}
};

// Handle connection errors after the initial connection
mongoose.connection.on("error", (err) => {
	console.error("⚠️ MongoDB runtime error:", err);
});

mongoose.connection.on("disconnected", () => {
	console.warn("⚠️ MongoDB disconnected.");
});

// Run the connection function
connectDB();
