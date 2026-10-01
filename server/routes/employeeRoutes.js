import express from "express";
import Employee from "../models/Employee.js";
import Branch from "../models/Branch.js";
import Sale from "../models/Sale.js";
import { requireObjectId, sendError } from "../utils/routeHelpers.js";

const router = express.Router();
const employeePayload = ({
	name,
	position,
	branch,
	email,
	phone,
	salary,
	dateHired,
}) => ({ name, position, branch, email, phone, salary, dateHired });

// router.post("/", async (req, res) => {
// 	try {
// 		requireObjectId(req.body.branchId, "branchId");
// 		if (!(await Branch.exists({ _id: req.body.branchId })))
// 			return res.status(400).json({ message: "Branch not found" });
// 		res.status(201).json(await Employee.create(employeePayload(req.body)));
// 	} catch (error) {
// 		sendError(res, error);
// 	}
// });

router.post("/", async (req, res) => {
	try {
		const branch = await Branch.findOne({ name: req.body.branchName });

		if (!branch) {
			return res.status(400).json({ message: "Branch not found" });
		}
		res
			.status(201)
			.json(
				await Employee.create(
					employeePayload({ ...req.body, branch: branch._id }),
				),
			);
	} catch (error) {
		sendError(res, error);
	}
});

router.get("/", async (req, res) => {
	try {
		res.json(
			await Employee.find().populate("branch", "name").sort({ name: 1 }),
		);
	} catch (error) {
		sendError(res, error);
	}
});

router.get("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Employee ID");
		const employee = await Employee.findById(req.params.id).populate(
			"branch",
			"name",
		);
		if (!employee)
			return res.status(404).json({ message: "Employee not found" });
		res.json(employee);
	} catch (error) {
		sendError(res, error);
	}
});

router.put("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Employee ID");
		const update = { ...req.body };
		if (req.body.branchName) {
			const branch = await Branch.findOne({ name: req.body.branchName });
			if (!branch) return res.status(400).json({ message: "Branch not found" });
			update.branch = branch._id;
		}
		const employee = await Employee.findByIdAndUpdate(
			req.params.id,
			employeePayload(update),
			{ new: true, runValidators: true },
		).populate("branch", "name");
		if (!employee)
			return res.status(404).json({ message: "Employee not found" });
		res.json(employee);
	} catch (error) {
		sendError(res, error);
	}
});

router.delete("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Employee ID");
		const employee = await Employee.findByIdAndDelete(req.params.id);
		if (!employee)
			return res.status(404).json({ message: "Employee not found" });
		await Promise.all([
			Sale.deleteMany({ employee: employee._id }),
			Branch.updateMany({ manager: employee._id }, { $unset: { manager: 1 } }),
		]);
		res.json({ message: "Employee deleted" });
	} catch (error) {
		sendError(res, error);
	}
});

export default router;
