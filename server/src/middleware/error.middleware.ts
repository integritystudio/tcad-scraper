import type { NextFunction, Request, Response } from "express";
import type qs from "qs";
import logger from "../lib/logger";

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = <
	P = Record<string, string>,
	ResBody = unknown,
	ReqBody = unknown,
	ReqQuery = qs.ParsedQs,
>(
	fn: (
		req: Request<P, ResBody, ReqBody, ReqQuery>,
		res: Response,
		next: NextFunction,
	) => Promise<unknown>,
) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		Promise.resolve(
			fn(req as Request<P, ResBody, ReqBody, ReqQuery>, res, next),
		).catch(next);
	};
};

/**
 * Global error handling middleware
 */
export const errorHandler = (
	error: Error,
	_req: Request,
	res: Response,
	_next: NextFunction,
): void => {
	logger.error(
		`Error: ${error.message}${error.stack ? `\nStack: ${error.stack}` : ""}`,
	);

	// Handle specific error types
	if (error.name === "ValidationError") {
		res.status(400).json({
			error: "Validation failed",
			message: error.message,
		});
		return;
	}

	if (error.name === "UnauthorizedError") {
		res.status(401).json({
			error: "Unauthorized",
			message: error.message,
		});
		return;
	}

	// Default to 500 server error
	res.status(500).json({
		error: "Internal server error",
		message:
			process.env.NODE_ENV === "development"
				? error.message
				: "An unexpected error occurred",
		...(process.env.NODE_ENV === "development" && { stack: error.stack }),
	});
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
	res.status(404).json({
		error: "Not found",
		message: `Route ${req.method} ${req.path} not found`,
	});
};
