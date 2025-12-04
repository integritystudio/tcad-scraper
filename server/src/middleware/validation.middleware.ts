import type { NextFunction, Request, Response } from "express";
import { type ZodSchema, z } from "zod";

/**
 * Middleware factory for validating request data using Zod schemas
 */
export const validate = (
	schema: ZodSchema,
	source: "body" | "query" | "params" = "body",
) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		try {
			const dataToValidate = req[source];
			const validatedData = schema.parse(dataToValidate);

			// Replace the original data with validated data (with defaults applied)
			req[source] = validatedData;

			next();
		} catch (error) {
			if (error instanceof z.ZodError) {
				res.status(400).json({
					error: "Invalid request data",
					details: error.errors.map((err) => ({
						path: err.path.join("."),
						message: err.message,
					})),
				});
				return;
			}
			next(error);
		}
	};
};

/**
 * Convenience functions for common validation scenarios
 */
export const validateBody = (schema: ZodSchema) => validate(schema, "body");
export const validateQuery = (schema: ZodSchema) => validate(schema, "query");
export const validateParams = (schema: ZodSchema) => validate(schema, "params");
