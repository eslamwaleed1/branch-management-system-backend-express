import express from "express";
import Product from "../models/Product.js";
import Branch from "../models/Branch.js";
import BranchInventory from "../models/BranchInventory.js";
import { requireObjectId, sendError } from "../utils/routeHelpers.js";

const router = express.Router();

const inventoryResponse = (product, inventories) => ({
	product,
	branchInventories: inventories,
});

router.post("/", async (req, res) => {
	try {
		const { product: productData, branchInventories = [] } = req.body;
		if (
			!productData ||
			!productData.name ||
			!Array.isArray(branchInventories)
		) {
			return res
				.status(400)
				.json({ message: "Product and branchInventories are required" });
		}
		const branchNames = branchInventories.map((item) => item.branchName);
		if (new Set(branchNames).size !== branchNames.length)
			return res
				.status(400)
				.json({ message: "Each branch may appear only once" });
		const branches = await Branch.find({ name: { $in: branchNames } }).select(
			"_id name",
		);
		if (branches.length !== branchNames.length)
			return res
				.status(400)
				.json({ message: "One or more branches do not exist" });
		const product = await Product.create({
			name: productData.name,
			category: productData.category,
		});
		const inventories = await BranchInventory.insertMany(
			branchInventories.map(({ branchName, price, stock }) => ({
				product: product._id,
				branch: branches.find((item) => item.name === branchName)._id,
				price,
				stock,
			})),
		);
		await Promise.all(
			inventories.map((inventory) =>
				inventory.populate([
					{ path: "product", select: "name category" },
					{ path: "branch", select: "name" },
				]),
			),
		);
		res.status(201).json(inventoryResponse(product, inventories));
	} catch (error) {
		sendError(res, error);
	}
});

router.get("/", async (req, res) => {
	try {
		const products = await Product.find().sort({ name: 1 });
		const inventories = await BranchInventory.find({
			product: { $in: products.map(({ _id }) => _id) },
		})
			.populate("branch", "name")
			.populate("product", "name category");
		const inventoryByProduct = new Map();
		for (const inventory of inventories) {
			const key = inventory.product._id.toString();
			inventoryByProduct.set(key, [
				...(inventoryByProduct.get(key) || []),
				inventory,
			]);
		}
		res.json(
			products.map((product) =>
				inventoryResponse(
					product,
					inventoryByProduct.get(product._id.toString()) || [],
				),
			),
		);
	} catch (error) {
		sendError(res, error);
	}
});

router.get("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Product ID");
		const product = await Product.findById(req.params.id);
		if (!product) return res.status(404).json({ message: "Product not found" });
		const inventories = await BranchInventory.find({
			product: product._id,
		}).populate("branch", "name");
		res.json(inventoryResponse(product, inventories));
	} catch (error) {
		sendError(res, error);
	}
});

router.delete("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Product ID");
		const product = await Product.findByIdAndDelete(req.params.id);
		if (!product) return res.status(404).json({ message: "Product not found" });
		await BranchInventory.deleteMany({ product: product._id });
		res.json({ message: "Product and inventories deleted" });
	} catch (error) {
		sendError(res, error);
	}
});

router.put("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Product ID");
		const { product: productData = {}, branchInventories: inventoryData } =
			req.body;
		const product = await Product.findByIdAndUpdate(
			req.params.id,
			{ name: productData.name, category: productData.category },
			{ new: true, runValidators: true },
		);
		if (!product) return res.status(404).json({ message: "Product not found" });
		if (inventoryData !== undefined) {
			if (!Array.isArray(inventoryData))
				return res
					.status(400)
					.json({ message: "branchInventories must be an array" });
			const branchNames = inventoryData.map((item) => item.branchName);
			if (new Set(branchNames).size !== branchNames.length)
				return res
					.status(400)
					.json({ message: "Each branch may appear only once" });
			const branches = await Branch.find({ name: { $in: branchNames } }).select(
				"_id name",
			);
			if (branches.length !== branchNames.length)
				return res
					.status(400)
					.json({ message: "One or more branches do not exist" });
			await BranchInventory.deleteMany({
				product: product._id,
				branch: { $nin: branches.map((item) => item._id) },
			});
			await Promise.all(
				inventoryData.map(({ branchName, price, stock }) =>
					BranchInventory.findOneAndUpdate(
						{
							product: product._id,
							branch: branches.find((item) => item.name === branchName)._id,
						},
						{ price, stock },
						{
							new: true,
							upsert: true,
							runValidators: true,
							setDefaultsOnInsert: true,
						},
					),
				),
			);
		}
		const inventories = await BranchInventory.find({
			product: product._id,
		}).populate("branch", "name");
		res.json(inventoryResponse(product, inventories));
	} catch (error) {
		sendError(res, error);
	}
});

export default router;
