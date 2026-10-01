import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},

		manager: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Employee",
		},

		location: {
			type: String,
		},

		phone: {
			type: String,
		},
	},
	{
		timestamps: true,
	},
);

const Branch = mongoose.model("Branch", branchSchema);

export default Branch;
