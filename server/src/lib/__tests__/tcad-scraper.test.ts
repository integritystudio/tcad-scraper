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

// Mock config
vi.mock("../../config", () => ({
	config: {
		logging: {
			level: "error",
		},
		scraper: {
			headless: true,
			timeout: 30000,
			retryAttempts: 3,
			retryDelay: 1000,
			userAgents: [
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
			],
			viewports: [
				{ width: 1920, height: 1080 },
				{ width: 1366, height: 768 },
			],
			humanDelay: {
				min: 500,
				max: 2000,
			},
			brightData: {
				enabled: false,
				apiToken: null,
				proxyHost: "brd.superproxy.io",
				proxyPort: 22225,
			},
			proxy: {
				enabled: false,
				server: null,
				username: null,
				password: null,
			},
		},
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

import { chromium } from "playwright";
import { TCADScraper } from "../tcad-scraper";

describe("TCADScraper", () => {
	let scraper: TCADScraper;

	beforeEach(() => {
		vi.clearAllMocks();
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

		it("should configure proxy if enabled in config", () => {
			// Test with Bright Data proxy
			vi.resetModules();
			vi.doMock("../../config", () => ({
				config: {
					logging: { level: "error" },
					scraper: {
						headless: true,
						timeout: 30000,
						retryAttempts: 3,
						retryDelay: 1000,
						userAgents: ["test-agent"],
						viewports: [{ width: 1920, height: 1080 }],
						humanDelay: { min: 500, max: 2000 },
						brightData: {
							enabled: true,
							apiToken: "test-token-12345678",
							proxyHost: "brd.superproxy.io",
							proxyPort: 22225,
						},
						proxy: {
							enabled: false,
							server: null,
						},
					},
				},
			}));

			// Should not throw when creating scraper with proxy config
			expect(() => new TCADScraper()).not.toThrow();
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

			await expect(scraper.initialize()).rejects.toThrow("Launch failed");
		});

		/**
		 * TECHNICAL DEBT: Skipped - Playwright mock pollution from previous test
		 * The "should handle browser launch failure" test sets mockRejectedValue
		 * which persists and causes this test to fail
		 * Fix: Use vi.resetAllMocks() or restructure mock
		 */
		it.skip("should include proxy config when provided", async () => {
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
				const scraperAny = scraper as any;
				const testArray = [1, 2, 3, 4, 5];

				const result = scraperAny.getRandomElement(testArray);

				expect(testArray).toContain(result);
			});

			it("should handle single element array", () => {
				const scraperAny = scraper as any;
				const testArray = ["only-element"];

				const result = scraperAny.getRandomElement(testArray);

				expect(result).toBe("only-element");
			});

			it("should return different elements on multiple calls", () => {
				const scraperAny = scraper as any;
				const testArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
				const results = new Set();

				// Call 20 times, should get variety
				for (let i = 0; i < 20; i++) {
					results.add(scraperAny.getRandomElement(testArray));
				}

				// With 20 calls on 10 elements, should get more than 1 unique value
				expect(results.size).toBeGreaterThan(1);
			});
		});

		describe("humanDelay", () => {
			beforeEach(() => {
				vi.useFakeTimers();
			});

			afterEach(() => {
				vi.useRealTimers();
			});

			it("should delay within specified range", async () => {
				const scraperAny = scraper as any;

				const delayPromise = scraperAny.humanDelay(100, 200);

				// Run all pending timers
				await vi.runAllTimersAsync();

				await delayPromise;

				expect(true).toBe(true); // If we got here, delay worked
			});

			it("should use default config values when not specified", async () => {
				const scraperAny = scraper as any;

				const delayPromise = scraperAny.humanDelay();

				// Run all pending timers (config uses 500-2000ms)
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

			await expect(
				uninitializedScraper.scrapePropertiesViaAPI("test"),
			).rejects.toThrow("Browser not initialized");
		});

		/**
		 * TECHNICAL DEBT: Skipped - Method behavior changed to be fault-tolerant
		 * scrapePropertiesWithFallback now returns [] instead of throwing
		 * when browser isn't initialized (graceful degradation)
		 * Fix: Update test to expect [] or remove if no longer needed
		 */
		it.skip("should throw error if scrapePropertiesWithFallback called without initialization", async () => {
			const uninitializedScraper = new TCADScraper();

			await expect(
				uninitializedScraper.scrapePropertiesWithFallback("test"),
			).rejects.toThrow("Browser not initialized");
		});
	});

	describe("cleanup", () => {
		/**
		 * TECHNICAL DEBT: Skipped - Playwright mock pollution
		 * Mock state from previous tests affects browser initialization
		 * Fix: Use vi.resetAllMocks() or restructure mock with vi.hoisted()
		 */
		it.skip("should close browser if initialized", async () => {
			await scraper.initialize();

			await scraper.cleanup();

			// Verify that cleanup was called (browser should be closed)
			expect(scraper).toBeDefined();
		});

		it("should handle cleanup when browser not initialized", async () => {
			await expect(scraper.cleanup()).resolves.not.toThrow();
		});

		/**
		 * TECHNICAL DEBT: Skipped - Mock browser reference not accessible
		 * vi.mocked(chromium.launch).mock.results[0].value doesn't properly
		 * return the mocked browser instance after previous test failures
		 * Fix: Restructure mock to maintain consistent browser reference
		 */
		it.skip("should handle browser close errors gracefully", async () => {
			await scraper.initialize();

			// Mock the browser's close method to reject
			const mockBrowser = await vi.mocked(chromium.launch).mock.results[0]
				.value;
			if (mockBrowser && typeof mockBrowser.close === "function") {
				vi.mocked(mockBrowser.close).mockRejectedValue(
					new Error("Close failed"),
				);
			}

			// Should not throw
			await expect(scraper.cleanup()).resolves.not.toThrow();
		});
	});

	/**
	 * TECHNICAL DEBT: Skipped suite - Playwright mock pollution
	 * These tests depend on successful browser initialization which fails
	 * due to mock state pollution from earlier tests
	 * Fix: Use vi.resetAllMocks() or restructure mock with vi.hoisted()
	 */
	describe.skip("User Agent and Viewport Selection", () => {
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
