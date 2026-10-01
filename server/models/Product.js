import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},

		category: {
			type: String,
			trim: true,
		},
	},
	{
		timestamps: true,
	},
);

const Product = mongoose.model("Product", productSchema);

export default Product;
