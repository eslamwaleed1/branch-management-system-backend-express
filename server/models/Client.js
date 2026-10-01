import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},

		branch: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Branch",
			required: true,
		},

		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			lowercase: true,
		},

		phone: {
			type: String,
			default: "+1 4651 561"
		},
	},
	{
		timestamps: true,
	},
);

const Client = mongoose.model("Client", clientSchema);

export default Client;
