import type { NextFunction, Request, Response } from "express";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import logger from "../../lib/logger";
import {
	asyncHandler,
	errorHandler,
	notFoundHandler,
} from "../error.middleware";

// Mock logger
vi.mock("../../lib/logger", () => ({
	default: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}));

describe("Error Middleware", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;
	let jsonMock: Mock;
	let statusMock: Mock;

	beforeEach(() => {
		jsonMock = vi.fn();
		statusMock = vi.fn().mockReturnValue({ json: jsonMock });

		mockReq = {
			method: "GET",
			path: "/test-path",
		};

		mockRes = {
			status: statusMock,
			json: jsonMock,
		};

		mockNext = vi.fn();

		// Clear mock calls
		vi.clearAllMocks();
	});

	describe("asyncHandler", () => {
		it("should call next with error when async function throws", async () => {
			const error = new Error("Test error");
			const asyncFn = vi.fn().mockRejectedValue(error);

			const wrappedFn = asyncHandler(asyncFn);
			wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			// Wait for promise to resolve
			await new Promise((resolve) => setImmediate(resolve));

			expect(mockNext).toHaveBeenCalledWith(error);
			expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
		});

		it("should not call next when async function succeeds", async () => {
			const asyncFn = vi.fn().mockResolvedValue("success");

			const wrappedFn = asyncHandler(asyncFn);
			wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			// Wait for promise to resolve
			await new Promise((resolve) => setImmediate(resolve));

			expect(mockNext).not.toHaveBeenCalled();
			expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
		});

		it("should handle errors in async operations", async () => {
			const errorMessage = "Async operation error";
			const asyncFn = vi.fn().mockImplementation(async () => {
				await Promise.resolve(); // Make it actually async
				throw new Error(errorMessage);
			});

			const wrappedFn = asyncHandler(asyncFn);
			wrappedFn(mockReq as Request, mockRes as Response, mockNext);

			// Wait for promise to resolve
			await new Promise((resolve) => setImmediate(resolve));

			expect(mockNext).toHaveBeenCalled();
			expect(mockNext).toHaveBeenCalledWith(
				expect.objectContaining({
					message: errorMessage,
				}),
			);
		});
	});

	describe("errorHandler", () => {
		const originalEnv = process.env.NODE_ENV;

		afterEach(() => {
			process.env.NODE_ENV = originalEnv;
		});

		it("should handle generic errors with 500 status", () => {
			const error = new Error("Generic error");

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Error: Generic error"),
			);
			expect(statusMock).toHaveBeenCalledWith(500);
			expect(jsonMock).toHaveBeenCalledWith({
				error: "Internal server error",
				message: "An unexpected error occurred",
			});
		});

		it("should include error message and stack in development mode", () => {
			process.env.NODE_ENV = "development";
			const error = new Error("Dev error");
			error.stack = "Error stack trace";

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(jsonMock).toHaveBeenCalledWith({
				error: "Internal server error",
				message: "Dev error",
				stack: "Error stack trace",
			});
		});

		it("should handle ValidationError with 400 status", () => {
			const error = new Error("Invalid input");
			error.name = "ValidationError";

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(statusMock).toHaveBeenCalledWith(400);
			expect(jsonMock).toHaveBeenCalledWith({
				error: "Validation failed",
				message: "Invalid input",
			});
		});

		it("should handle UnauthorizedError with 401 status", () => {
			const error = new Error("Not authorized");
			error.name = "UnauthorizedError";

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(statusMock).toHaveBeenCalledWith(401);
			expect(jsonMock).toHaveBeenCalledWith({
				error: "Unauthorized",
				message: "Not authorized",
			});
		});

		it("should log all errors", () => {
			const error = new Error("Test error");

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Error: Test error"),
			);
		});

		it("should hide error details in production", () => {
			process.env.NODE_ENV = "production";
			const error = new Error("Sensitive error information");

			errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

			expect(jsonMock).toHaveBeenCalledWith({
				error: "Internal server error",
				message: "An unexpected error occurred",
			});
		});
	});

	describe("notFoundHandler", () => {
		it("should return 404 with route information", () => {
			mockReq.method = "GET";
			mockReq.path = "/api/nonexistent";

			notFoundHandler(mockReq as Request, mockRes as Response);

			expect(statusMock).toHaveBeenCalledWith(404);
			expect(jsonMock).toHaveBeenCalledWith({
				error: "Not found",
				message: "Route GET /api/nonexistent not found",
			});
		});

		it("should handle POST requests", () => {
			mockReq.method = "POST";
			mockReq.path = "/api/invalid";

			notFoundHandler(mockReq as Request, mockRes as Response);

			expect(jsonMock).toHaveBeenCalledWith({
				error: "Not found",
				message: "Route POST /api/invalid not found",
			});
		});

		it("should handle different HTTP methods", () => {
			const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

			methods.forEach((method) => {
				vi.clearAllMocks();
				mockReq.method = method;
				mockReq.path = "/test";

				notFoundHandler(mockReq as Request, mockRes as Response);

				expect(jsonMock).toHaveBeenCalledWith({
					error: "Not found",
					message: `Route ${method} /test not found`,
				});
			});
		});
	});
});
