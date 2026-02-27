/**
 * TCAD Scraper Tests (API-only)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock token refresh service
vi.mock("../../services/token-refresh.service", () => ({
	tokenRefreshService: {
		getCurrentToken: vi.fn().mockReturnValue("test-tcad-key"),
	},
}));

// Mock tcad-api-client
const mockFetchTCADProperties = vi.fn();
vi.mock("../tcad-api-client", () => ({
	fetchTCADProperties: (...args: unknown[]) =>
		mockFetchTCADProperties(...args),
	mapTCADResultToPropertyData: vi.fn((r: unknown) => r),
}));

// Mock logger
vi.mock("../logger", () => ({
	default: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		trace: vi.fn(),
	},
}));

import { tokenRefreshService } from "../../services/token-refresh.service";
import { TCADScraper } from "../tcad-scraper";

describe("TCADScraper", () => {
	let scraper: TCADScraper;

	beforeEach(() => {
		vi.clearAllMocks();
		mockFetchTCADProperties.mockReset();
		vi.mocked(tokenRefreshService.getCurrentToken).mockReturnValue(
			"test-tcad-key",
		);
		scraper = new TCADScraper();
	});

	afterEach(async () => {
		await scraper.cleanup();
	});

	describe("constructor", () => {
		it("should initialize with default config", () => {
			expect(scraper).toBeDefined();
		});

		it("should accept custom config", () => {
			const custom = new TCADScraper({
				timeout: 60000,
				retryAttempts: 5,
			});
			expect(custom).toBeDefined();
		});

		it("should handle empty config object", () => {
			const defaultScraper = new TCADScraper({});
			expect(defaultScraper).toBeDefined();
		});
	});

	describe("initialize", () => {
		it("should succeed when token is available", async () => {
			await expect(scraper.initialize()).resolves.not.toThrow();
		});

		it("should throw when no token is available", async () => {
			vi.mocked(tokenRefreshService.getCurrentToken).mockReturnValue(null);

			const noTokenScraper = new TCADScraper();
			await expect(noTokenScraper.initialize()).rejects.toThrow(
				"No TCAD API token available",
			);
		});
	});

	describe("scrapePropertiesViaAPI", () => {
		it("should call fetchTCADProperties and return mapped results", async () => {
			mockFetchTCADProperties.mockResolvedValue({
				totalCount: 2,
				results: [{ id: "1" }, { id: "2" }],
				pageSize: 1000,
			});

			const results = await scraper.scrapePropertiesViaAPI("Willow");

			expect(mockFetchTCADProperties).toHaveBeenCalledWith(
				"test-tcad-key",
				"Willow",
				expect.any(Number),
			);
			expect(results).toHaveLength(2);
		});

		it("should retry on failure with exponential backoff", async () => {
			mockFetchTCADProperties
				.mockRejectedValueOnce(new Error("Network error"))
				.mockResolvedValueOnce({
					totalCount: 1,
					results: [{ id: "1" }],
					pageSize: 1000,
				});

			const results = await scraper.scrapePropertiesViaAPI("test", 2);

			expect(mockFetchTCADProperties).toHaveBeenCalledTimes(2);
			expect(results).toHaveLength(1);
		});

		it("should throw after all retries exhausted", async () => {
			mockFetchTCADProperties.mockRejectedValue(new Error("API down"));

			await expect(
				scraper.scrapePropertiesViaAPI("test", 1),
			).rejects.toThrow("API down");
		});

		it("should throw when no token is available", async () => {
			vi.mocked(tokenRefreshService.getCurrentToken).mockReturnValue(null);

			await expect(
				scraper.scrapePropertiesViaAPI("test", 1),
			).rejects.toThrow("No TCAD API token available");
		});
	});

	describe("cleanup", () => {
		it("should be a no-op and not throw", async () => {
			await expect(scraper.cleanup()).resolves.not.toThrow();
		});

		it("should be safe to call multiple times", async () => {
			await scraper.cleanup();
			await expect(scraper.cleanup()).resolves.not.toThrow();
		});
	});
});
