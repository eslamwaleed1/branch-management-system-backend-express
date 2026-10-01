import express from "express";
import Sale from "../models/Sale.js";
import Employee from "../models/Employee.js";
import Client from "../models/Client.js";
import Product from "../models/Product.js";
import Branch from "../models/Branch.js";
import BranchInventory from "../models/BranchInventory.js";
import { requireObjectId, sendError } from "../utils/routeHelpers.js";

const router = express.Router();
const salePopulate = (query) =>
	query
		.populate("employee", "name position")
		.populate("client", "name email")
		.populate("branch", "name")
		.populate("products.product", "name category");

const normalizeItems = (items) => {
	if (!Array.isArray(items) || items.length === 0)
		throw Object.assign(new Error("At least one product is required"), {
			name: "ValidationError",
		});
	const grouped = new Map();
	for (const item of items) {
		if (!Number.isInteger(item.quantity) || item.quantity < 1)
			throw Object.assign(new Error("Quantity must be a positive integer"), {
				name: "ValidationError",
			});
		grouped.set(
			item.productName,
			(grouped.get(item.productName) || 0) + item.quantity,
		);
	}
	return [...grouped].map(([productName, quantity]) => ({
		productName,
		quantity,
	}));
};

const reserveInventory = async (branchId, items) => {
	const reserved = [];
	let totalAmount = 0;
	try {
		for (const { productName, quantity } of items) {
			const product = await Product.findOne({ name: productName });
			if (!product)
				throw Object.assign(new Error("Product not found"), {
					name: "ValidationError",
				});
			const inventory = await BranchInventory.findOneAndUpdate(
				{ branch: branchId, product: product._id, stock: { $gte: quantity } },
				{ $inc: { stock: -quantity } },
				{ new: true },
			).populate("product", "name");
			if (!inventory)
				throw Object.assign(
					new Error("Product is unavailable or has insufficient branch stock"),
					{ name: "ValidationError" },
				);
			reserved.push({ inventory, quantity });
			totalAmount += inventory.price * quantity;
		}
		return { reserved, totalAmount };
	} catch (error) {
		await Promise.all(
			reserved.map(({ inventory, quantity }) =>
				BranchInventory.updateOne(
					{ _id: inventory._id },
					{ $inc: { stock: quantity } },
				),
			),
		);
		throw error;
	}
};

router.post("/", async (req, res) => {
	try {
		const { employeeName, clientName, productsInput } = req.body;
		const items = normalizeItems(productsInput);
		const employee = await Employee.findOne({ name: employeeName });
		const client = await Client.findOne({ name: clientName });
		if (!employee)
			return res.status(400).json({ message: "Employee not found" });
		if (!client) return res.status(400).json({ message: "Client not found" });
		if (employee.branch.toString() !== client.branch.toString())
			return res.status(400).json({
				message: "Employee and client must belong to the same branch",
			});
		const { reserved, totalAmount } = await reserveInventory(
			employee.branch,
			items,
		);
		try {
			const sale = await Sale.create({
				employee: employee._id,
				client: client._id,
				branch: employee.branch,
				products: reserved.map(({ inventory, quantity }) => ({
					product: inventory.product._id,
					quantity,
					unitPrice: inventory.price,
				})),
				totalAmount,
			});
			res.status(201).json(await salePopulate(Sale.findById(sale._id)));
		} catch (error) {
			await Promise.all(
				reserved.map(({ inventory, quantity }) =>
					BranchInventory.updateOne(
						{ _id: inventory._id },
						{ $inc: { stock: quantity } },
					),
				),
			);
			throw error;
		}
	} catch (error) {
		sendError(res, error);
	}
});

router.get("/", async (req, res) => {
	try {
		res.json(await salePopulate(Sale.find().sort({ saleDate: -1 })));
	} catch (error) {
		sendError(res, error);
	}
});

router.get("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Sale ID");
		const sale = await salePopulate(Sale.findById(req.params.id));
		if (!sale) return res.status(404).json({ message: "Sale not found" });
		res.json(sale);
	} catch (error) {
		sendError(res, error);
	}
});

router.delete("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Sale ID");
		const sale = await Sale.findByIdAndDelete(req.params.id);
		if (!sale) return res.status(404).json({ message: "Sale not found" });
		await Promise.all(
			sale.products.map((item) =>
				BranchInventory.updateOne(
					{ branch: sale.branch, product: item.product },
					{ $inc: { stock: item.quantity } },
				),
			),
		);
		res.json({ message: "Sale deleted and inventory restored" });
	} catch (error) {
		sendError(res, error);
	}
});

router.put("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Sale ID");
		const sale = await Sale.findById(req.params.id);
		if (!sale) return res.status(404).json({ message: "Sale not found" });
		if (req.body.saleDate) {
			const updated = await Sale.findByIdAndUpdate(
				sale._id,
				{ saleDate: req.body.saleDate },
				{ new: true, runValidators: true },
			);
			return res.json(await salePopulate(Sale.findById(updated._id)));
		}
		return res.status(400).json({
			message:
				"Sales line items cannot be edited; delete and create a replacement sale",
		});
	} catch (error) {
		sendError(res, error);
	}
});

export default router;
