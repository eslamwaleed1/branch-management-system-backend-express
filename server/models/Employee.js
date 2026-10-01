import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
		},

		position: {
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

		salary: {
			type: Number,
			min: 0,
			default: 40000
		},

		dateHired: {
			type: Date,
		},
	},
	{
		timestamps: true,
	},
);

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
