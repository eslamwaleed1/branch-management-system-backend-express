import express from "express";
import mongoose from "mongoose";
import Branch from "../models/Branch.js";
import Employee from "../models/Employee.js";
import Client from "../models/Client.js";
import BranchInventory from "../models/BranchInventory.js";
import Sale from "../models/Sale.js";
import { requireObjectId, sendError } from "../utils/routeHelpers.js";

const router = express.Router();
const branchPayload = ({ name, manager, location, phone }) => ({
	name,
	manager: manager || undefined,
	location,
	phone,
});

router.post("/", async (req, res) => {
	try {
		const { managerName } = req.body;
		if (managerName) {
			const manager = await Employee.findOne({ name: managerName });
			if (!manager)
				return res.status(400).json({ message: "Manager not found" });
			return res
				.status(400)
				.json({ message: "Create the branch before assigning its manager" });
		}
		res.status(201).json(await Branch.create(branchPayload(req.body)));
	} catch (error) {
		sendError(res, error);
	}
});

router.get("/", async (req, res) => {
	try {
		res.json(
			await Branch.find().populate("manager", "name email").sort({ name: 1 }),
		);
	} catch (error) {
		sendError(res, error);
	}
});

// router.get("/:id", async (req, res) => {
// 	try {
// 		requireObjectId(req.params.id, "Branch ID");
// 		const branch = await Branch.findById(req.params.id).populate(
// 			"manager",
// 			"name email",
// 		);
// 		if (!branch) return res.status(404).json({ message: "Branch not found" });
// 		res.json(branch);
// 	} catch (error) {
// 		sendError(res, error);
// 	}
// });

router.get("/:identifier", async (req, res) => {
	try {
		const { identifier } = req.params;
		let branch;
		if (mongoose.Types.ObjectId.isValid(identifier)) {
			branch = await Branch.findById(identifier).populate(
				"manager",
				"name email",
			);
		} else {
			branch = await Branch.findOne({ name: identifier });
		}

		if (!branch || (Array.isArray(branch) && branch.length === 0)) {
			return res.status(404).json({ message: "Branch not found" });
		}

		res.json(branch);
	} catch (error) {
		sendError(res, error);
	}
});

router.put("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Branch ID");
		const update = { ...req.body };
		const { managerName } = req.body;
		if (managerName) {
			const manager = await Employee.findOne({
				name: managerName,
				branch: req.params.id,
			});
			if (!manager)
				return res
					.status(400)
					.json({ message: "Manager must be an employee of this branch" });
			update.manager = manager._id;
		}
		const branch = await Branch.findByIdAndUpdate(
			req.params.id,
			branchPayload(update),
			{ new: true, runValidators: true },
		).populate("manager", "name email");
		if (!branch) return res.status(404).json({ message: "Branch not found" });
		res.json(branch);
	} catch (error) {
		sendError(res, error);
	}
});

router.delete("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Branch ID");
		const branch = await Branch.findByIdAndDelete(req.params.id);
		if (!branch) return res.status(404).json({ message: "Branch not found" });
		await Promise.all([
			Employee.deleteMany({ branch: branch._id }),
			Client.deleteMany({ branch: branch._id }),
			BranchInventory.deleteMany({ branch: branch._id }),
			Sale.deleteMany({ branch: branch._id }),
		]);
		res.json({
			message: "Branch and related employees, clients, and inventories deleted",
		});
	} catch (error) {
		sendError(res, error);
	}
});

export default router;
