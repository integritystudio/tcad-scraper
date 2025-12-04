import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import * as metricsService from "../../lib/metrics.service";
import { metricsMiddleware } from "../metrics.middleware";

// Mock the metrics service
vi.mock("../../lib/metrics.service", () => ({
	recordHttpRequest: vi.fn(),
}));

describe("Metrics Middleware", () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;
	let finishListeners: Array<() => void>;

	beforeEach(() => {
		finishListeners = [];

		mockReq = {
			method: "GET",
			path: "/api/test",
			baseUrl: "/api",
			route: {
				path: "/test",
			} as any,
		};

		mockRes = {
			statusCode: 200,
			on: vi.fn((event: string, callback: () => void) => {
				if (event === "finish") {
					finishListeners.push(callback);
				}
				return mockRes as Response;
			}),
		};

		mockNext = vi.fn();

		vi.clearAllMocks();
	});

	it("should call next immediately", () => {
		metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);

		expect(mockNext).toHaveBeenCalledTimes(1);
	});

	it("should record metrics when response finishes", () => {
		metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);

		// Simulate response finishing
		finishListeners.forEach((listener) => listener());

		expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
			"GET",
			"/api/test",
			200,
			expect.any(Number),
		);
	});

	it("should measure request duration accurately", async () => {
		const _startTime = Date.now();

		metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);

		// Simulate 100ms delay
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Simulate response finishing
		finishListeners.forEach((listener) => listener());

		const call = (metricsService.recordHttpRequest as Mock).mock.calls[0];
		const duration = call[3];

		// Duration should be in seconds and approximately 0.1
		// Allow 5ms tolerance for timing precision (0.095s - 0.2s range)
		expect(duration).toBeGreaterThanOrEqual(0.095);
		expect(duration).toBeLessThan(0.2);
	});

	it("should record correct HTTP method", () => {
		const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

		methods.forEach((method) => {
			vi.clearAllMocks();
			finishListeners = [];

			mockReq.method = method;
			mockRes!.on = vi.fn((event: string, callback: () => void) => {
				if (event === "finish") finishListeners.push(callback);
				return mockRes as Response;
			});

			metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);
			finishListeners.forEach((listener) => listener());

			expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
				method,
				expect.any(String),
				expect.any(Number),
				expect.any(Number),
			);
		});
	});

	it("should record correct status codes", () => {
		const statusCodes = [200, 201, 400, 401, 404, 500, 503];

		statusCodes.forEach((statusCode) => {
			vi.clearAllMocks();
			finishListeners = [];

			mockRes!.statusCode = statusCode;
			mockRes!.on = vi.fn((event: string, callback: () => void) => {
				if (event === "finish") finishListeners.push(callback);
				return mockRes as Response;
			});

			metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);
			finishListeners.forEach((listener) => listener());

			expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				statusCode,
				expect.any(Number),
			);
		});
	});

	it("should use route pattern when available", () => {
		mockReq.baseUrl = "/api";
		mockReq.route = {
			path: "/properties/:id",
		} as any;

		metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);
		finishListeners.forEach((listener) => listener());

		expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
			"GET",
			"/api/properties/:id",
			200,
			expect.any(Number),
		);
	});

	it("should fallback to path when route is not available", () => {
		mockReq.route = undefined;
		mockReq.path = "/api/custom/path";

		metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);
		finishListeners.forEach((listener) => listener());

		expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
			"GET",
			"/api/custom/path",
			200,
			expect.any(Number),
		);
	});

	it("should handle routes with empty baseUrl", () => {
		mockReq.baseUrl = "";
		mockReq.route = {
			path: "/health",
		} as any;

		metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);
		finishListeners.forEach((listener) => listener());

		expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
			"GET",
			"/health",
			200,
			expect.any(Number),
		);
	});

	it("should handle parameterized routes correctly", () => {
		mockReq.baseUrl = "/api/properties";
		mockReq.route = {
			path: "/:id/details",
		} as any;

		metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);
		finishListeners.forEach((listener) => listener());

		expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
			"GET",
			"/api/properties/:id/details",
			200,
			expect.any(Number),
		);
	});

	it("should handle routes with no path correctly", () => {
		mockReq.route = {
			path: undefined,
		} as any;
		mockReq.path = "/fallback/path";

		metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);
		finishListeners.forEach((listener) => listener());

		expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
			"GET",
			"/fallback/path",
			200,
			expect.any(Number),
		);
	});

	it("should only record metrics once per request", () => {
		metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);

		// Call finish listener once (finish event only fires once in reality)
		finishListeners.forEach((listener) => listener());

		// Should only record once
		expect(metricsService.recordHttpRequest).toHaveBeenCalledTimes(1);
	});

	it("should measure very fast requests", () => {
		metricsMiddleware(mockReq as Request, mockRes as Response, mockNext);

		// Immediately finish
		finishListeners.forEach((listener) => listener());

		const call = (metricsService.recordHttpRequest as Mock).mock.calls[0];
		const duration = call[3];

		// Duration should be very small but >= 0
		expect(duration).toBeGreaterThanOrEqual(0);
		expect(duration).toBeLessThan(0.01); // Less than 10ms
	});
});
