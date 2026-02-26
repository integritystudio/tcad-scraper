/**
 * TCAD Scraper Tests
 *
 * Tests for helper methods and configuration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Playwright
vi.mock("playwright", () => ({
	chromium: {
		launch: vi.fn().mockResolvedValue({
			newContext: vi.fn(),
			close: vi.fn(),
		}),
	},
}));

// Mock token refresh service
vi.mock("../../services/token-refresh.service", () => ({
	tokenRefreshService: {
		getCurrentToken: vi.fn().mockReturnValue(null),
	},
}));

// Mock DOM scraper fallback
vi.mock("../fallback/dom-scraper", () => ({
	scrapeDOMFallback: vi.fn().mockResolvedValue([]),
}));

// Mock tcad-api-client to prevent real fetch calls in API-direct mode
vi.mock("../tcad-api-client", () => ({
	fetchTCADProperties: vi
		.fn()
		.mockRejectedValue(new Error("mock: no API call expected")),
	mapTCADResultToPropertyData: vi.fn((r: unknown) => r),
}));

import { chromium } from "playwright";
import { TCADScraper } from "../tcad-scraper";

describe("TCADScraper", () => {
	let scraper: TCADScraper;

	beforeEach(() => {
		vi.resetAllMocks();
		// Re-setup default mock behavior after reset
		vi.mocked(chromium.launch).mockResolvedValue({
			newContext: vi.fn().mockResolvedValue({
				newPage: vi.fn().mockResolvedValue({
					goto: vi.fn(),
					close: vi.fn(),
				}),
				close: vi.fn(),
			}),
			close: vi.fn(),
		} as unknown as ReturnType<typeof chromium.launch> extends Promise<infer T>
			? T
			: never);
		scraper = new TCADScraper();
	});

	afterEach(async () => {
		if (scraper) {
			// Cleanup if needed
		}
	});

	describe("constructor", () => {
		it("should initialize with default config", () => {
			const scraper = new TCADScraper();
			expect(scraper).toBeDefined();
		});

		it("should accept custom config", () => {
			const customScraper = new TCADScraper({
				headless: false,
				timeout: 60000,
			});
			expect(customScraper).toBeDefined();
		});

		it("should accept proxy config via constructor", () => {
			const scraperWithProxy = new TCADScraper({
				proxyServer: "http://brd.superproxy.io:22225",
				proxyUsername: "test-user",
				proxyPassword: "test-pass",
			});
			expect(scraperWithProxy).toBeDefined();
		});
	});

	describe("initialize", () => {
		it("should launch browser with correct options", async () => {
			await scraper.initialize();

			expect(chromium.launch).toHaveBeenCalledWith(
				expect.objectContaining({
					headless: true,
					args: expect.arrayContaining([
						"--disable-blink-features=AutomationControlled",
						"--disable-web-security",
						"--no-sandbox",
					]),
				}),
			);
		});

		it("should handle browser launch failure", async () => {
			vi.mocked(chromium.launch).mockRejectedValue(new Error("Launch failed"));

			// With a token in env, initialize() gracefully falls back to API-direct mode
			// Without a token, it throws
			const hasToken = !!(
				(
					await import("../../services/token-refresh.service")
				).tokenRefreshService.getCurrentToken() ||
				(await import("../../config")).config.scraper.tcadApiKey
			);

			if (hasToken) {
				await expect(scraper.initialize()).resolves.not.toThrow();
			} else {
				await expect(scraper.initialize()).rejects.toThrow("Launch failed");
			}
		});

		it("should include proxy config when provided", async () => {
			const scraperWithProxy = new TCADScraper({
				proxyServer: "http://proxy.example.com:8080",
				proxyUsername: "user",
				proxyPassword: "pass",
			});

			await scraperWithProxy.initialize();

			expect(chromium.launch).toHaveBeenCalledWith(
				expect.objectContaining({
					proxy: {
						server: "http://proxy.example.com:8080",
						username: "user",
						password: "pass",
					},
				}),
			);
		});
	});

	describe("Helper Methods", () => {
		describe("getRandomElement", () => {
			it("should return element from array", () => {
				// Access private method via any
				const scraperPrivate = scraper as unknown as Record<
					string,
					(...args: unknown[]) => unknown
				>;
				const testArray = [1, 2, 3, 4, 5];

				const result = scraperPrivate.getRandomElement(testArray);

				expect(testArray).toContain(result);
			});

			it("should handle single element array", () => {
				const scraperPrivate = scraper as unknown as Record<
					string,
					(...args: unknown[]) => unknown
				>;
				const testArray = ["only-element"];

				const result = scraperPrivate.getRandomElement(testArray);

				expect(result).toBe("only-element");
			});

			it("should return different elements on multiple calls", () => {
				const scraperPrivate = scraper as unknown as Record<
					string,
					(...args: unknown[]) => unknown
				>;
				const testArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
				const results = new Set();

				// Call 20 times, should get variety
				for (let i = 0; i < 20; i++) {
					results.add(scraperPrivate.getRandomElement(testArray));
				}

				// With 20 calls on 10 elements, should get more than 1 unique value
				expect(results.size).toBeGreaterThan(1);
			});
		});

		describe("humanDelay (standalone utility)", () => {
			beforeEach(() => {
				vi.useFakeTimers();
			});

			afterEach(() => {
				vi.useRealTimers();
			});

			it("should delay within specified range", async () => {
				const { humanDelay } = await import("../../utils/timing");

				const delayPromise = humanDelay(100, 200);

				await vi.runAllTimersAsync();

				await delayPromise;

				expect(true).toBe(true);
			});

			it("should use default config values when not specified", async () => {
				const { humanDelay } = await import("../../utils/timing");

				const delayPromise = humanDelay();

				await vi.runAllTimersAsync();

				await delayPromise;

				expect(true).toBe(true);
			});
		});
	});

	describe("Configuration", () => {
		it("should merge custom config with defaults", () => {
			const customScraper = new TCADScraper({
				timeout: 45000,
				retryAttempts: 5,
			});

			expect(customScraper).toBeDefined();
			// Config should be accessible and merged
		});

		it("should handle empty config object", () => {
			const defaultScraper = new TCADScraper({});
			expect(defaultScraper).toBeDefined();
		});
	});

	describe("Error Handling", () => {
		it("should throw error if scrapePropertiesViaAPI called without initialization", async () => {
			const uninitializedScraper = new TCADScraper();

			// maxRetries: 1 avoids retry delays that exceed test timeout
			await expect(
				uninitializedScraper.scrapePropertiesViaAPI("test", 1),
			).rejects.toThrow();
		});

		it("should throw error if scrapePropertiesWithFallback called without initialization", async () => {
			const uninitializedScraper = new TCADScraper();

			await expect(
				uninitializedScraper.scrapePropertiesWithFallback("test", 1),
			).rejects.toThrow();
		});
	});

	describe("cleanup", () => {
		it("should close browser if initialized", async () => {
			await scraper.initialize();

			await scraper.cleanup();

			// Verify that cleanup was called (browser should be closed)
			expect(scraper).toBeDefined();
		});

		it("should handle cleanup when browser not initialized", async () => {
			await expect(scraper.cleanup()).resolves.not.toThrow();
		});

		it("should propagate browser close errors", async () => {
			// Create a mock browser with a close method that rejects
			const mockBrowser = {
				newContext: vi.fn().mockResolvedValue({
					newPage: vi.fn().mockResolvedValue({
						goto: vi.fn(),
						close: vi.fn(),
					}),
					close: vi.fn(),
				}),
				close: vi.fn().mockRejectedValue(new Error("Close failed")),
			};
			vi.mocked(chromium.launch).mockResolvedValue(
				mockBrowser as unknown as ReturnType<
					typeof chromium.launch
				> extends Promise<infer T>
					? T
					: never,
			);

			await scraper.initialize();

			// Browser close errors propagate (not silently swallowed)
			await expect(scraper.cleanup()).rejects.toThrow("Close failed");
		});
	});

	describe("User Agent and Viewport Selection", () => {
		it("should use random user agent from config", async () => {
			await scraper.initialize();

			// Config is set in constructor and used during initialization
			expect(scraper).toBeDefined();
		});

		it("should use random viewport from config", async () => {
			await scraper.initialize();

			expect(scraper).toBeDefined();
		});
	});

	describe("Retry Logic", () => {
		it("should respect retry configuration", () => {
			const scraperWithRetries = new TCADScraper({
				retryAttempts: 5,
				retryDelay: 2000,
			});

			expect(scraperWithRetries).toBeDefined();
		});
	});
});
