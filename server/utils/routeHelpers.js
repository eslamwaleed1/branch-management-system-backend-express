import mongoose from "mongoose";

export const isValidObjectId = (value) => mongoose.isValidObjectId(value);

export const getErrorStatus = (error) => {
	if (error?.name === "ValidationError" || error?.name === "CastError") {
		return 400;
	}

	if (error?.code === 11000) {
		return 409;
	}

	return 500;
};

export const sendError = (res, error) => {
	const status = getErrorStatus(error);
	res.status(status).json({ message: error.message });
};

export const requireObjectId = (value, fieldName) => {
	if (!isValidObjectId(value)) {
		const error = new Error(`${fieldName} must be a valid ID`);
		error.name = "ValidationError";
		throw error;
	}
};
