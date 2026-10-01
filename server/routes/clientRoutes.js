import express from "express";
import Client from "../models/Client.js";
import Branch from "../models/Branch.js";
import Sale from "../models/Sale.js";
import { requireObjectId, sendError } from "../utils/routeHelpers.js";

const router = express.Router();
const clientPayload = ({ name, branch, email, phone }) => ({
	name,
	branch,
	email,
	phone,
});

router.post("/", async (req, res) => {
	try {
		const branch = await Branch.findOne({ name: req.body.branchName });
		if (!branch) return res.status(400).json({ message: "Branch not found" });
		res
			.status(201)
			.json(
				await Client.create(
					clientPayload({
						name: req.body.name,
						branch: branch._id,
						email: req.body.email,
						phone: req.body.phone || "+1 6215 265"
					}),
				),
			);
	} catch (error) {
		sendError(res, error);
	}
});

router.get("/", async (req, res) => {
	try {
		res.json(await Client.find().populate("branch", "name").sort({ name: 1 }));
	} catch (error) {
		sendError(res, error);
	}
});

router.get("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Client ID");
		const client = await Client.findById(req.params.id).populate(
			"branch",
			"name",
		);
		if (!client) return res.status(404).json({ message: "Client not found" });
		res.json(client);
	} catch (error) {
		sendError(res, error);
	}
});

router.put("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Client ID");
		const update = { ...req.body };
		if (req.body.branchName) {
			const branch = await Branch.findOne({ name: req.body.branchName });
			if (!branch) return res.status(400).json({ message: "Branch not found" });
			update.branch = branch._id;
		}
		const client = await Client.findByIdAndUpdate(
			req.params.id,
			clientPayload(update),
			{ new: true, runValidators: true },
		).populate("branch", "name");
		if (!client) return res.status(404).json({ message: "Client not found" });
		res.json(client);
	} catch (error) {
		sendError(res, error);
	}
});

router.delete("/:id", async (req, res) => {
	try {
		requireObjectId(req.params.id, "Client ID");
		const client = await Client.findByIdAndDelete(req.params.id);
		if (!client) return res.status(404).json({ message: "Client not found" });
		await Sale.deleteMany({ client: client._id });
		res.json({ message: "Client deleted" });
	} catch (error) {
		sendError(res, error);
	}
});

export default router;
