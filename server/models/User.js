import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			lowercase: true,
		},
		passwordHash: {
			type: String,
			select: false,
		},
		googleId: {
			type: String,
			unique: true,
			sparse: true,
		},
		emailVerified: {
			type: Boolean,
			default: false,
		},
		emailVerificationCodeHash: {
			type: String,
			select: false,
		},
		emailVerificationExpiresAt: {
			type: Date,
			select: false,
		},
		emailVerificationAttempts: {
			type: Number,
			default: 0,
			select: false,
		},
		verificationEmailSentAt: {
			type: Date,
			default: null,
		},
	},
	{ timestamps: true },
);

export default mongoose.model("User", userSchema);
