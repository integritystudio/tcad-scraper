/**
 * Token Refresh Service Tests (env-token mode)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock logger to suppress output during tests
vi.mock("../../lib/logger", () => ({
	default: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

import { TCADTokenRefreshService } from "../token-refresh.service";

describe("TCADTokenRefreshService", () => {
	let service: TCADTokenRefreshService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new TCADTokenRefreshService();
	});

	afterEach(async () => {
		await service.cleanup();
	});

	describe("constructor", () => {
		it("should initialize with token from environment if available", () => {
			const token = service.getCurrentToken();
			expect(token).toBe("test-tcad-key");
		});

		it("should initialize stats correctly", () => {
			const stats = service.getStats();
			expect(stats.refreshCount).toBe(0);
			expect(stats.failureCount).toBe(0);
			expect(stats.isRefreshing).toBe(false);
			expect(stats.lastRefreshTime).toBeNull();
		});
	});

	describe("getCurrentToken", () => {
		it("should return the current token", () => {
			const token = service.getCurrentToken();
			expect(token).toBe("test-tcad-key");
		});
	});

	describe("getStats", () => {
		it("should return complete statistics", () => {
			const stats = service.getStats();

			expect(stats).toHaveProperty("currentToken");
			expect(stats).toHaveProperty("lastRefreshTime");
			expect(stats).toHaveProperty("refreshCount");
			expect(stats).toHaveProperty("failureCount");
			expect(stats).toHaveProperty("isRefreshing");
			expect(stats).toHaveProperty("isRunning");
		});

		it("should mask token in stats", () => {
			const stats = service.getStats();
			expect(stats.currentToken).toContain("...");
			expect(stats.currentToken).not.toBe("test-tcad-key");
		});

		it("should show isRunning as false", () => {
			const stats = service.getStats();
			expect(stats.isRunning).toBe(false);
		});
	});

	describe("getHealth", () => {
		it("should return health status", () => {
			const health = service.getHealth();

			expect(health).toHaveProperty("healthy");
			expect(health).toHaveProperty("hasToken");
			expect(health).toHaveProperty("lastRefresh");
			expect(health).toHaveProperty("timeSinceLastRefresh");
			expect(health).toHaveProperty("refreshCount");
			expect(health).toHaveProperty("failureCount");
			expect(health).toHaveProperty("failureRate");
			expect(health).toHaveProperty("isRefreshing");
			expect(health).toHaveProperty("isAutoRefreshRunning");
		});

		it("should show healthy when token exists", () => {
			const health = service.getHealth();
			expect(health.healthy).toBe(true);
			expect(health.hasToken).toBe(true);
		});

		it("should calculate failure rate correctly", () => {
			const health = service.getHealth();
			expect(health.failureRate).toBe("0%");
		});

		it("should show autoRefresh as not running", () => {
			const health = service.getHealth();
			expect(health.isAutoRefreshRunning).toBe(false);
		});
	});

	describe("refreshToken", () => {
		it("should return current env token", async () => {
			const result = await service.refreshToken();
			expect(result).toBe("test-tcad-key");
		});
	});

	describe("startAutoRefresh", () => {
		it("should be a no-op", () => {
			expect(() => service.startAutoRefresh()).not.toThrow();
			expect(service.getStats().isRunning).toBe(false);
		});
	});

	describe("startAutoRefreshInterval", () => {
		it("should be a no-op", () => {
			expect(() => service.startAutoRefreshInterval()).not.toThrow();
			expect(service.getStats().isRunning).toBe(false);
		});
	});

	describe("stopAutoRefresh", () => {
		it("should handle being called when not running", () => {
			expect(() => service.stopAutoRefresh()).not.toThrow();
		});
	});

	describe("cleanup", () => {
		it("should not throw", async () => {
			await expect(service.cleanup()).resolves.not.toThrow();
		});

		it("should be safe to call multiple times", async () => {
			await service.cleanup();
			await expect(service.cleanup()).resolves.not.toThrow();
		});
	});
});
