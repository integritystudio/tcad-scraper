/**
 * Token Refresh Service Tests (worker mode)
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

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { TCADTokenRefreshService } from "../token-refresh.service";

function tokenResponse(token = "jwt-abc-123") {
	return {
		ok: true,
		json: () => Promise.resolve({ token, expiresIn: 300 }),
	};
}

describe("TCADTokenRefreshService", () => {
	let service: TCADTokenRefreshService;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		service = new TCADTokenRefreshService();
	});

	afterEach(async () => {
		await service.cleanup();
		vi.useRealTimers();
	});

	describe("constructor", () => {
		it("should initialize without a token", () => {
			expect(service.getCurrentToken()).toBeNull();
		});

		it("should initialize stats correctly", () => {
			const stats = service.getStats();
			expect(stats.refreshCount).toBe(0);
			expect(stats.failureCount).toBe(0);
			expect(stats.isRefreshing).toBe(false);
			expect(stats.lastRefreshTime).toBeNull();
		});
	});

	describe("refreshToken", () => {
		it("should fetch a token from the worker", async () => {
			mockFetch.mockResolvedValueOnce(tokenResponse("fresh-token"));

			const result = await service.refreshToken();

			expect(result).toBe("fresh-token");
			expect(service.getCurrentToken()).toBe("fresh-token");
			expect(mockFetch).toHaveBeenCalledOnce();
		});

		it("should increment refreshCount on success", async () => {
			mockFetch.mockResolvedValueOnce(tokenResponse());

			await service.refreshToken();

			expect(service.getStats().refreshCount).toBe(1);
		});

		it("should increment failureCount on HTTP error", async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });

			await service.refreshToken();

			expect(service.getStats().failureCount).toBe(1);
		});

		it("should increment failureCount on network error", async () => {
			mockFetch.mockRejectedValueOnce(new Error("fetch failed"));

			await service.refreshToken();

			expect(service.getStats().failureCount).toBe(1);
		});

		it("should return stale token on failure", async () => {
			mockFetch.mockResolvedValueOnce(tokenResponse("first"));
			await service.refreshToken();

			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
			const result = await service.refreshToken();

			expect(result).toBe("first");
		});

		it("should skip concurrent refresh calls", async () => {
			let resolveFirst!: (v: unknown) => void;
			mockFetch.mockReturnValueOnce(
				new Promise((r) => {
					resolveFirst = r;
				}),
			);

			const p1 = service.refreshToken();
			const p2 = service.refreshToken();

			resolveFirst(tokenResponse("tok"));
			await p1;
			await p2;

			expect(mockFetch).toHaveBeenCalledOnce();
		});

		it("should handle missing token in response", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ expiresIn: 300 }),
			});

			await service.refreshToken();

			expect(service.getStats().failureCount).toBe(1);
		});
	});

	describe("getStats", () => {
		it("should mask token in stats", async () => {
			mockFetch.mockResolvedValueOnce(tokenResponse("abcdef1234"));
			await service.refreshToken();

			const stats = service.getStats();
			expect(stats.currentToken).toBe("...1234");
		});

		it("should show null when no token", () => {
			expect(service.getStats().currentToken).toBeNull();
		});
	});

	describe("startAutoRefreshInterval", () => {
		it("should refresh on interval", async () => {
			mockFetch.mockResolvedValue(tokenResponse());

			service.startAutoRefreshInterval(60_000);
			expect(service.getStats().isRunning).toBe(true);

			await vi.advanceTimersByTimeAsync(60_000);
			expect(mockFetch).toHaveBeenCalledOnce();

			await vi.advanceTimersByTimeAsync(60_000);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("should stop previous timer when called again", () => {
			service.startAutoRefreshInterval(60_000);
			service.startAutoRefreshInterval(30_000);

			expect(service.getStats().isRunning).toBe(true);
		});
	});

	describe("stopAutoRefresh", () => {
		it("should stop the timer", () => {
			service.startAutoRefreshInterval(60_000);
			service.stopAutoRefresh();

			expect(service.getStats().isRunning).toBe(false);
		});

		it("should handle being called when not running", () => {
			expect(() => service.stopAutoRefresh()).not.toThrow();
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

		it("should report unhealthy with no token", () => {
			const health = service.getHealth();
			expect(health.healthy).toBe(false);
			expect(health.hasToken).toBe(false);
		});

		it("should report healthy after successful refresh", async () => {
			mockFetch.mockResolvedValueOnce(tokenResponse());
			await service.refreshToken();

			const health = service.getHealth();
			expect(health.healthy).toBe(true);
			expect(health.hasToken).toBe(true);
		});

		it("should report autoRefresh running state", () => {
			expect(service.getHealth().isAutoRefreshRunning).toBe(false);

			service.startAutoRefreshInterval(60_000);
			expect(service.getHealth().isAutoRefreshRunning).toBe(true);

			service.stopAutoRefresh();
			expect(service.getHealth().isAutoRefreshRunning).toBe(false);
		});
	});

	describe("cleanup", () => {
		it("should not throw", async () => {
			await expect(service.cleanup()).resolves.not.toThrow();
		});

		it("should stop auto-refresh", async () => {
			service.startAutoRefreshInterval(60_000);
			await service.cleanup();
			expect(service.getStats().isRunning).toBe(false);
		});
	});
});
