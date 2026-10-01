import mongoose from "mongoose";

const branchInventorySchema = new mongoose.Schema(
	{
		product: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Product",
			required: true,
		},
		branch: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Branch",
			required: true,
		},
		price: {
			type: Number,
			required: true,
			default: 26,
			min: 0,
		},
		stock: {
			type: Number,
			required: true,
			default: 100,
			min: 0,
			validate: Number.isInteger,
		},
	},
	{ timestamps: true },
);
branchInventorySchema.index(
	{
		branch: 1,
		product: 1,
	},
	{ unique: true },
);

const BranchInventory = mongoose.model(
	"BranchInventory",
	branchInventorySchema,
);

export default BranchInventory;
