import express from "express";
import cors from "cors"; 
import mongoose from "mongoose";
import "dotenv/config";
import employeeRoutes from "./server/routes/employeeRoutes.js";
import productRoutes from "./server/routes/productRoutes.js";
import clientRoutes from "./server/routes/clientRoutes.js";
import saleRoutes from "./server/routes/saleRoutes.js";
import branchRoutes from "./server/routes/branchRoutes.js";
import "./server/utils/refreshDatabase.js"




const app = express();
const allowedOrigins = [
  'http://localhost:5173',
  'https://branch-management-system-f28xadycv-eslamwaleed1s-projects.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());
app.use("/api/employees", employeeRoutes);
app.use("/api/products", productRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/branches", branchRoutes);

app.get("/api/test", (req, res) => {
	res.json({ message: "Hello from the backend!" });
});

const PORT = process.env.PORT || 5000;
const DB_URI = process.env.MONGODB_URI;

const startServer = () => {
	app.listen(PORT, () => {
		console.log(`🚀 Server running on http://localhost:${PORT}`);
	});
};

const connectDB = async () => {
	try {
		if (!DB_URI) {
			console.warn(
				"⚠️ MONGODB_URI is missing. Starting server without MongoDB.",
			);
			return startServer();
		}

		await mongoose.connect(DB_URI);
		console.log("🔹 MongoDB connected successfully.");
		startServer();
	} catch (error) {
		console.error("❌ Database connection failed:", error.message);
		console.warn(
			"⚠️ Starting server without a database connection. Mongo-backed routes will fail until MongoDB is reachable.",
		);
		startServer();
	}
};

// Handle connection errors after the initial connection
mongoose.connection.on("error", (err) => {
	console.error("⚠️ MongoDB runtime error:", err);
});

mongoose.connection.on("disconnected", () => {
	console.warn("⚠️ MongoDB disconnected.");
});

// Run the connection function
connectDB();
