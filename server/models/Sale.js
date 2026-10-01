import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
	{
		employee: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Employee",
			required: true,
		},
		client: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Client",
			required: true,
		},
		branch: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Branch",
			required: true,
		},

		products: [
			{
				product: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "Product",
					required: true,
				},
				quantity: {
					type: Number,
					required: true,
					min: 1,
					validate: Number.isInteger,
				},
				unitPrice: {
					type: Number,
					required: true,
					min: 0,
				},
			},
		],
		totalAmount: {
			type: Number,
			required: true,
			min: 0,
		},
		saleDate: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	},
);

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
