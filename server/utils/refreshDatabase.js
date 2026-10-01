import cron from "node-cron";
import mongoose from "mongoose";

import Sale from "../models/Sale.js";
import Employee from "../models/Employee.js";
import Client from "../models/Client.js";
import Product from "../models/Product.js";
import Branch from "../models/Branch.js";
import BranchInventory from "../models/BranchInventory.js";

import branches from "../data/branches.json" with { type: "json" };
import branchInventories from "../data/branchinventories.json" with { type: "json" };
import employees from "../data/employees.json" with { type: "json" };
import sales from "../data/sales.json" with { type: "json" };
import products from "../data/products.json" with { type: "json" };
import clients from "../data/clients.json" with { type: "json" };

const deserializeDocuments = (documents) =>
	documents.map((document) => mongoose.mongo.BSON.EJSON.deserialize(document));

async function refreshDatabase() {
	try {
		await Promise.all([
			BranchInventory.deleteMany({}),
			Branch.deleteMany({}),
			Employee.deleteMany({}),
			Sale.deleteMany({}),
			Product.deleteMany({}),
			Client.deleteMany({}),
		]);

		await Promise.all([
			BranchInventory.insertMany(deserializeDocuments(branchInventories)),
			Branch.insertMany(deserializeDocuments(branches)),
			Employee.insertMany(deserializeDocuments(employees)),
			Sale.insertMany(deserializeDocuments(sales)),
			Product.insertMany(deserializeDocuments(products)),
			Client.insertMany(deserializeDocuments(clients)),
		]);

		console.log("Database refreshed successfully.");
	} catch (error) {
		console.error("Failed to refresh database:", error);
	}
}

cron.schedule("0 * * * *", refreshDatabase);
