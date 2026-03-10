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

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn().mockResolvedValue(undefined);

vi.mock("../../lib/redis-cache.service", () => ({
	cacheService: {
		get: mockCacheGet,
		set: mockCacheSet,
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
vi.spyOn(global, "setInterval").mockReturnValue(
	{} as unknown as NodeJS.Timeout,
);

describe("deduplicateByPropertyId", () => {
	let deduplicateByPropertyId: (
		props: { propertyId: string }[],
	) => { propertyId: string }[];

	beforeEach(async () => {
		vi.resetModules();
		const module = await import("../scraper.queue");
		deduplicateByPropertyId = module.deduplicateByPropertyId as typeof deduplicateByPropertyId;
	});

	it("should return empty array for empty input", () => {
		expect(deduplicateByPropertyId([] as never[])).toEqual([]);
	});

	it("should pass through when no duplicates exist", () => {
		const props = [
			{ propertyId: "1", name: "A" },
			{ propertyId: "2", name: "B" },
		];
		const result = deduplicateByPropertyId(props as never[]);
		expect(result).toHaveLength(2);
	});

	it("should keep last occurrence when duplicates exist", () => {
		const props = [
			{ propertyId: "1", name: "First" },
			{ propertyId: "2", name: "Middle" },
			{ propertyId: "1", name: "Last" },
		];
		const result = deduplicateByPropertyId(props as never[]);
		expect(result).toHaveLength(2);
		expect(result.find((p) => p.propertyId === "1")).toHaveProperty(
			"name",
			"Last",
		);
	});

	it("should skip properties with empty propertyId", () => {
		const props = [
			{ propertyId: "", name: "Empty" },
			{ propertyId: "1", name: "Valid" },
		];
		const result = deduplicateByPropertyId(props as never[]);
		expect(result).toHaveLength(1);
		expect(result[0].propertyId).toBe("1");
	});
});

describe("Scraper Queue", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("canScheduleJob", () => {
		let canScheduleJob: (searchTerm: string) => Promise<boolean>;

		beforeEach(async () => {
			vi.clearAllMocks();
			// Default: no existing rate limit key (cache miss = allow)
			mockCacheGet.mockResolvedValue(null);
			const module = await import("../scraper.queue");
			canScheduleJob = module.canScheduleJob;
		});

		it("should allow scheduling a new job for a search term", async () => {
			const result = await canScheduleJob("Smith");
			expect(result).toBe(true);
			expect(mockCacheSet).toHaveBeenCalledWith(
				"ratelimit:scrape:Smith",
				expect.any(Number),
				expect.any(Number),
			);
		});

		it("should prevent scheduling duplicate jobs within delay period", async () => {
			// First call: cache miss → allow
			const result1 = await canScheduleJob("Johnson");
			expect(result1).toBe(true);

			// Second call: cache hit → deny
			mockCacheGet.mockResolvedValue(Date.now());
			const result2 = await canScheduleJob("Johnson");
			expect(result2).toBe(false);
			expect(mockCacheSet).toHaveBeenCalledTimes(1); // Only first call sets the key
		});

		it("should allow scheduling after delay period has passed (TTL expired)", async () => {
			// First call: allow
			const result1 = await canScheduleJob("Williams");
			expect(result1).toBe(true);

			// TTL expired — Redis returns null (key gone)
			mockCacheGet.mockResolvedValue(null);
			const result2 = await canScheduleJob("Williams");
			expect(result2).toBe(true);
		});

		it("should track different search terms independently", async () => {
			// All terms have cache miss → all allowed
			const result1 = await canScheduleJob("Brown");
			const result2 = await canScheduleJob("Davis");
			const result3 = await canScheduleJob("Miller");

			expect(result1).toBe(true);
			expect(result2).toBe(true);
			expect(result3).toBe(true);
		});

		it("should deny when Redis returns a cached timestamp", async () => {
			mockCacheGet.mockResolvedValue(Date.now() - 1000); // 1 second ago, within TTL
			const result = await canScheduleJob("Wilson");
			expect(result).toBe(false);
			expect(mockCacheSet).not.toHaveBeenCalled();
		});

		it("should handle empty search term", async () => {
			const result = await canScheduleJob("");
			expect(result).toBe(true);
		});

		it("should handle special characters in search term", async () => {
			const specialTerms = ["Smith & Co.", "LLC.", "Trust-Family"];

			for (const term of specialTerms) {
				mockCacheGet.mockResolvedValue(null);
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
		beforeEach(async () => {
			vi.clearAllMocks();
			vi.resetModules();
			await import("../scraper.queue");
		});

		it("should register completed event listener", () => {
			expect(mockBullQueue.on).toHaveBeenCalledWith(
				"completed",
				expect.any(Function),
			);
		});

		it("should register failed event listener", () => {
			expect(mockBullQueue.on).toHaveBeenCalledWith(
				"failed",
				expect.any(Function),
			);
		});

		it("should register stalled event listener", () => {
			expect(mockBullQueue.on).toHaveBeenCalledWith(
				"stalled",
				expect.any(Function),
			);
		});

		it("should handle completed event correctly", () => {
			const completedHandler = mockBullQueue.on.mock.calls.find(
				(call: [string, (...args: unknown[]) => void]) =>
					call[0] === "completed",
			)?.[1];

			expect(completedHandler).toBeDefined();

			const mockJob = { id: "test-job-123" };
			const mockResult = {
				count: 50,
				duration: 5000,
				searchTerm: "Test",
				properties: [],
			};

			expect(() => completedHandler(mockJob, mockResult)).not.toThrow();
		});

		it("should handle failed event correctly", () => {
			const failedHandler = mockBullQueue.on.mock.calls.find(
				(call: [string, (...args: unknown[]) => void]) => call[0] === "failed",
			)?.[1];

			expect(failedHandler).toBeDefined();

			const mockJob = { id: "test-job-456", attemptsMade: 3 };
			const mockError = new Error("Test error");

			expect(() => failedHandler(mockJob, mockError)).not.toThrow();
		});

		it("should handle stalled event correctly", () => {
			const stalledHandler = mockBullQueue.on.mock.calls.find(
				(call: [string, (...args: unknown[]) => void]) => call[0] === "stalled",
			)?.[1];

			expect(stalledHandler).toBeDefined();

			const mockJob = { id: "test-job-789" };

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
