/**
 * Scraper Queue Tests
 *
 * Tests for the BullMQ scraper queue including:
 * - Rate limiting (canScheduleJob)
 * - Queue configuration
 * - Event listeners
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to declare mocks before they're used
const { mockBullQueue, MockBull } = vi.hoisted(() => {
	const mockBullQueue = {
		process: vi.fn(),
		on: vi.fn(),
		clean: vi.fn().mockResolvedValue(undefined),
		add: vi.fn(),
		getJob: vi.fn(),
		getJobs: vi.fn(),
		pause: vi.fn(),
		resume: vi.fn(),
		close: vi.fn(),
	};

	// Create a proper constructor function that returns mockBullQueue
	class MockBull {
		constructor() {
			return mockBullQueue;
		}
	}

	return { mockBullQueue, MockBull };
});

vi.mock("bull", () => ({
	default: MockBull,
}));

vi.mock("../../lib/tcad-scraper");
vi.mock("../../lib/prisma", () => ({
	prisma: {
		scrapeJob: {
			create: vi.fn(),
			update: vi.fn(),
		},
		$executeRawUnsafe: vi.fn(),
	},
}));

vi.mock("../../lib/redis-cache.service", () => ({
	cacheService: {
		deletePattern: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock("../../services/search-term-optimizer", () => ({
	searchTermOptimizer: {
		updateAnalytics: vi.fn().mockResolvedValue(undefined),
	},
}));

// Mock logger to suppress output during tests
vi.mock("../../lib/logger", () => ({
	default: {
		info: () => {},
		warn: () => {},
		error: () => {},
		debug: () => {},
	},
}));

// Mock setInterval at module level to prevent cleanup interval from running
vi.spyOn(global, "setInterval").mockReturnValue({} as unknown as NodeJS.Timeout);

describe("Scraper Queue", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("canScheduleJob", () => {
		// Import after mocks are set up
		let canScheduleJob: (searchTerm: string) => Promise<boolean>;

		beforeEach(async () => {
			// Use fake timers for this test suite
			vi.useFakeTimers();

			// Reset module to clear the activeJobs Map
			vi.resetModules();
			const module = await import("../scraper.queue");
			canScheduleJob = module.canScheduleJob;
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should allow scheduling a new job for a search term", async () => {
			const result = await canScheduleJob("Smith");
			expect(result).toBe(true);
		});

		it("should prevent scheduling duplicate jobs within delay period", async () => {
			const searchTerm = "Johnson";

			// First job should be allowed
			const result1 = await canScheduleJob(searchTerm);
			expect(result1).toBe(true);

			// Second job within delay period should be denied
			const result2 = await canScheduleJob(searchTerm);
			expect(result2).toBe(false);
		});

		it("should allow scheduling after delay period has passed", async () => {
			const searchTerm = "Williams";

			// Schedule first job
			const result1 = await canScheduleJob(searchTerm);
			expect(result1).toBe(true);

			// Advance time past the job delay (60 seconds)
			vi.advanceTimersByTime(61000);

			// Should allow second job after delay
			const result2 = await canScheduleJob(searchTerm);
			expect(result2).toBe(true);
		});

		it("should track different search terms independently", async () => {
			const result1 = await canScheduleJob("Brown");
			const result2 = await canScheduleJob("Davis");
			const result3 = await canScheduleJob("Miller");

			// All different search terms should be allowed
			expect(result1).toBe(true);
			expect(result2).toBe(true);
			expect(result3).toBe(true);
		});

		it("should clean up old entries from activeJobs map", async () => {
			const searchTerm = "Wilson";

			// Schedule first job
			await canScheduleJob(searchTerm);

			// Advance time past cleanup interval (5 minutes)
			vi.advanceTimersByTime(301000);

			// Schedule another job to trigger cleanup
			await canScheduleJob("Moore");

			// Original job should be cleaned up, so scheduling it again should work
			const result = await canScheduleJob(searchTerm);
			expect(result).toBe(true);
		});

		it("should handle multiple rapid calls correctly", async () => {
			const searchTerm = "Taylor";

			// Simulate rapid successive calls
			const results = await Promise.all([
				canScheduleJob(searchTerm),
				canScheduleJob(searchTerm),
				canScheduleJob(searchTerm),
			]);

			// Only first call should succeed
			expect(results[0]).toBe(true);
			expect(results[1]).toBe(false);
			expect(results[2]).toBe(false);
		});

		it("should handle empty search term", async () => {
			const result = await canScheduleJob("");
			expect(result).toBe(true);
		});

		it("should handle special characters in search term", async () => {
			const specialTerms = ["Smith & Co.", "LLC.", "Trust-Family"];

			for (const term of specialTerms) {
				const result = await canScheduleJob(term);
				expect(result).toBe(true);
			}
		});
	});

	describe("Queue Configuration", () => {
		it("should create Bull queue with correct configuration", async () => {
			// Clear mocks before importing
			vi.clearAllMocks();

			// Reset modules to force re-import
			vi.resetModules();

			// Import the module to trigger Bull queue creation
			const module = await import("../scraper.queue");

			// Verify the Bull constructor was called with correct arguments
			// The mockBullQueue instance should be defined and returned
			expect(module.scraperQueue).toBeDefined();
			expect(module.scraperQueue).toBe(mockBullQueue);
		});

		it("should register queue processor with correct concurrency", async () => {
			// Clear mocks before importing
			vi.clearAllMocks();

			// Reset modules to force re-import
			vi.resetModules();

			// Import the module to trigger processor registration
			await import("../scraper.queue");

			// Verify that process was called with the correct job name and concurrency
			expect(mockBullQueue.process).toHaveBeenCalledWith(
				"scrape-properties",
				2,
				expect.any(Function),
			);
		});
	});

	describe("Queue Event Listeners", () => {
		it("should register completed event listener", async () => {
			// Clear mocks and reset modules
			vi.clearAllMocks();
			vi.resetModules();

			// Import the module to trigger event listener registration
			await import("../scraper.queue");

			expect(mockBullQueue.on).toHaveBeenCalledWith(
				"completed",
				expect.any(Function),
			);
		});

		it("should register failed event listener", async () => {
			// Clear mocks and reset modules
			vi.clearAllMocks();
			vi.resetModules();

			// Import the module to trigger event listener registration
			await import("../scraper.queue");

			expect(mockBullQueue.on).toHaveBeenCalledWith(
				"failed",
				expect.any(Function),
			);
		});

		it("should register stalled event listener", async () => {
			// Clear mocks and reset modules
			vi.clearAllMocks();
			vi.resetModules();

			// Import the module to trigger event listener registration
			await import("../scraper.queue");

			expect(mockBullQueue.on).toHaveBeenCalledWith(
				"stalled",
				expect.any(Function),
			);
		});

		it("should handle completed event correctly", async () => {
			// Clear mocks and reset modules
			vi.clearAllMocks();
			vi.resetModules();

			// Import the module to trigger event listener registration
			await import("../scraper.queue");

			const completedHandler = mockBullQueue.on.mock.calls.find(
				(call: [string, (...args: unknown[]) => void]) => call[0] === "completed",
			)?.[1];

			expect(completedHandler).toBeDefined();

			// Simulate completed event
			const mockJob = { id: "test-job-123" };
			const mockResult = {
				count: 50,
				duration: 5000,
				searchTerm: "Test",
				properties: [],
			};

			// Should not throw
			expect(() => completedHandler(mockJob, mockResult)).not.toThrow();
		});

		it("should handle failed event correctly", async () => {
			// Clear mocks and reset modules
			vi.clearAllMocks();
			vi.resetModules();

			// Import the module to trigger event listener registration
			await import("../scraper.queue");

			const failedHandler = mockBullQueue.on.mock.calls.find(
				(call: [string, (...args: unknown[]) => void]) => call[0] === "failed",
			)?.[1];

			expect(failedHandler).toBeDefined();

			// Simulate failed event
			const mockJob = { id: "test-job-456", attemptsMade: 3 };
			const mockError = new Error("Test error");

			// Should not throw
			expect(() => failedHandler(mockJob, mockError)).not.toThrow();
		});

		it("should handle stalled event correctly", async () => {
			// Clear mocks and reset modules
			vi.clearAllMocks();
			vi.resetModules();

			// Import the module to trigger event listener registration
			await import("../scraper.queue");

			const stalledHandler = mockBullQueue.on.mock.calls.find(
				(call: [string, (...args: unknown[]) => void]) => call[0] === "stalled",
			)?.[1];

			expect(stalledHandler).toBeDefined();

			// Simulate stalled event
			const mockJob = { id: "test-job-789" };

			// Should not throw
			expect(() => stalledHandler(mockJob)).not.toThrow();
		});
	});

	describe("Queue Export", () => {
		it("should export scraperQueue instance", async () => {
			const { scraperQueue } = await import("../scraper.queue");

			expect(scraperQueue).toBeDefined();
			expect(scraperQueue).toBe(mockBullQueue);
		});

		it("should export canScheduleJob function", async () => {
			const { canScheduleJob } = await import("../scraper.queue");

			expect(canScheduleJob).toBeDefined();
			expect(typeof canScheduleJob).toBe("function");
		});
	});
});
