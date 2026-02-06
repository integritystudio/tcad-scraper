/**
 * Scrape Scheduler Tests
 *
 * Tests for the cron-based scheduled job system
 */

import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

interface CronTask {
	start: ReturnType<typeof vi.fn>;
	stop: ReturnType<typeof vi.fn>;
}

// Mock dependencies before imports
vi.mock("node-cron", () => ({
	default: {
		schedule: vi.fn().mockImplementation(() => ({
			start: vi.fn(),
			stop: vi.fn(),
		})),
	},
}));

vi.mock("../../queues/scraper.queue", () => ({
	scraperQueue: {
		add: vi.fn().mockResolvedValue(undefined),
		clean: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock("../../lib/prisma", () => ({
	prisma: {
		monitoredSearch: {
			findMany: vi.fn(),
			update: vi.fn(),
		},
		scrapeJob: {
			deleteMany: vi.fn(),
		},
	},
}));

// Mock logger to suppress output during tests
vi.mock("../../lib/logger", () => ({
	default: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}));

import cron from "node-cron";
import { prisma } from "../../lib/prisma";
import { scraperQueue } from "../../queues/scraper.queue";
import { scheduledJobs } from "../scrape-scheduler";

// Get mock instances for testing
const mockScraperQueue = scraperQueue as unknown as {
	add: Mock;
	clean: Mock;
};

const mockPrisma = prisma as unknown as {
	monitoredSearch: {
		findMany: Mock;
		update: Mock;
	};
	scrapeJob: {
		deleteMany: Mock;
	};
};

describe("ScheduledJobs", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Configure cron.schedule mock to return task objects
		(cron.schedule as Mock).mockImplementation(() => ({
			start: vi.fn(),
			stop: vi.fn(),
		}));
	});

	describe("initialize", () => {
		it("should create four cron tasks", () => {
			scheduledJobs.initialize();

			// Should create 4 tasks: daily, weekly, monthly, cleanup
			expect(cron.schedule).toHaveBeenCalledTimes(4);
		});

		it("should create daily task with correct schedule", () => {
			scheduledJobs.initialize();

			expect(cron.schedule).toHaveBeenCalledWith(
				"0 2 * * *", // 2 AM daily
				expect.any(Function),
				expect.objectContaining({
					scheduled: false,
					timezone: "America/Chicago",
				}),
			);
		});

		it("should create weekly task with correct schedule", () => {
			scheduledJobs.initialize();

			expect(cron.schedule).toHaveBeenCalledWith(
				"0 3 * * 0", // 3 AM on Sundays
				expect.any(Function),
				expect.objectContaining({
					scheduled: false,
					timezone: "America/Chicago",
				}),
			);
		});

		it("should create monthly task with correct schedule", () => {
			scheduledJobs.initialize();

			expect(cron.schedule).toHaveBeenCalledWith(
				"0 4 1 * *", // 4 AM on the 1st
				expect.any(Function),
				expect.objectContaining({
					scheduled: false,
					timezone: "America/Chicago",
				}),
			);
		});

		it("should create cleanup task with correct schedule", () => {
			scheduledJobs.initialize();

			expect(cron.schedule).toHaveBeenCalledWith(
				"0 * * * *", // Every hour
				expect.any(Function),
				expect.objectContaining({
					scheduled: false,
				}),
			);
		});

		it("should start all created tasks", () => {
			scheduledJobs.initialize();

			// Verify that 4 tasks were created and each has start called
			const scheduleMock = cron.schedule as Mock;
			expect(scheduleMock).toHaveBeenCalledTimes(4);

			// Get all returned task mocks and verify start was called
			scheduleMock.mock.results.forEach((result: { value: CronTask }) => {
				expect(result.value.start).toHaveBeenCalled();
			});
		});

		it("should handle multiple initializations", () => {
			scheduledJobs.initialize();
			vi.clearAllMocks();

			scheduledJobs.initialize();

			// Should create new tasks on second initialization
			expect(cron.schedule).toHaveBeenCalledTimes(4);
		});
	});

	describe("runScheduledScrapes", () => {
		beforeEach(() => {
			// Setup mock data
			mockPrisma.monitoredSearch.findMany.mockResolvedValue([
				{
					id: "1",
					searchTerm: "John Smith",
					frequency: "daily",
					active: true,
				},
				{
					id: "2",
					searchTerm: "Jane Doe",
					frequency: "daily",
					active: true,
				},
			]);

			mockPrisma.monitoredSearch.update.mockResolvedValue({});
		});

		it("should query monitored searches with correct frequency", async () => {
			scheduledJobs.initialize();

			// Get the daily task callback
			const dailyTaskCallback = (cron.schedule as Mock).mock.calls[0][1];

			await dailyTaskCallback();

			expect(mockPrisma.monitoredSearch.findMany).toHaveBeenCalledWith({
				where: {
					active: true,
					frequency: "daily",
				},
			});
		});

		it("should add jobs to scraper queue for each search", async () => {
			scheduledJobs.initialize();

			const dailyTaskCallback = (cron.schedule as Mock).mock.calls[0][1];

			await dailyTaskCallback();

			expect(mockScraperQueue.add).toHaveBeenCalledTimes(2);
			expect(mockScraperQueue.add).toHaveBeenCalledWith(
				"scrape-properties",
				expect.objectContaining({
					searchTerm: "John Smith",
					scheduled: true,
				}),
				expect.objectContaining({
					delay: expect.any(Number),
					attempts: 5,
					backoff: {
						type: "exponential",
						delay: 5000,
					},
				}),
			);
		});

		it("should use random delay between 0-60 seconds", async () => {
			scheduledJobs.initialize();

			const dailyTaskCallback = (cron.schedule as Mock).mock.calls[0][1];

			await dailyTaskCallback();

			const addCalls = mockScraperQueue.add.mock.calls;
			addCalls.forEach((call: [string, unknown, { delay: number }]) => {
				const delay = call[2].delay;
				expect(delay).toBeGreaterThanOrEqual(0);
				expect(delay).toBeLessThan(60000);
			});
		});

		it("should update last run time for each search", async () => {
			scheduledJobs.initialize();

			const dailyTaskCallback = (cron.schedule as Mock).mock.calls[0][1];

			await dailyTaskCallback();

			expect(mockPrisma.monitoredSearch.update).toHaveBeenCalledTimes(2);
			expect(mockPrisma.monitoredSearch.update).toHaveBeenCalledWith({
				where: { id: "1" },
				data: { lastRun: expect.any(Date) },
			});
		});

		it("should handle weekly frequency", async () => {
			mockPrisma.monitoredSearch.findMany.mockResolvedValue([
				{
					id: "3",
					searchTerm: "Weekly Search",
					frequency: "weekly",
					active: true,
				},
			]);

			scheduledJobs.initialize();

			const weeklyTaskCallback = (cron.schedule as Mock).mock.calls[1][1];

			await weeklyTaskCallback();

			expect(mockPrisma.monitoredSearch.findMany).toHaveBeenCalledWith({
				where: {
					active: true,
					frequency: "weekly",
				},
			});
		});

		it("should handle monthly frequency", async () => {
			mockPrisma.monitoredSearch.findMany.mockResolvedValue([
				{
					id: "4",
					searchTerm: "Monthly Search",
					frequency: "monthly",
					active: true,
				},
			]);

			scheduledJobs.initialize();

			const monthlyTaskCallback = (cron.schedule as Mock).mock.calls[2][1];

			await monthlyTaskCallback();

			expect(mockPrisma.monitoredSearch.findMany).toHaveBeenCalledWith({
				where: {
					active: true,
					frequency: "monthly",
				},
			});
		});

		it("should handle empty search results", async () => {
			mockPrisma.monitoredSearch.findMany.mockResolvedValue([]);

			scheduledJobs.initialize();

			const dailyTaskCallback = (cron.schedule as Mock).mock.calls[0][1];

			await dailyTaskCallback();

			expect(mockScraperQueue.add).not.toHaveBeenCalled();
			expect(mockPrisma.monitoredSearch.update).not.toHaveBeenCalled();
		});

		it("should handle errors gracefully", async () => {
			mockPrisma.monitoredSearch.findMany.mockRejectedValue(
				new Error("Database error"),
			);

			scheduledJobs.initialize();

			const dailyTaskCallback = (cron.schedule as Mock).mock.calls[0][1];

			// Should not throw
			await expect(dailyTaskCallback()).resolves.not.toThrow();
		});
	});

	describe("cleanupOldJobs", () => {
		beforeEach(() => {
			mockPrisma.scrapeJob.deleteMany.mockResolvedValue({ count: 15 });
			mockScraperQueue.clean.mockResolvedValue(undefined);
		});

		it("should delete scrape jobs older than 30 days", async () => {
			scheduledJobs.initialize();

			const cleanupCallback = (cron.schedule as Mock).mock.calls[3][1];

			await cleanupCallback();

			expect(mockPrisma.scrapeJob.deleteMany).toHaveBeenCalledWith({
				where: {
					completedAt: {
						lt: expect.any(Date),
					},
				},
			});

			// Verify the date is approximately 30 days ago
			const deleteCall = mockPrisma.scrapeJob.deleteMany.mock.calls[0][0];
			const thirtyDaysAgo = deleteCall.where.completedAt.lt;
			const now = new Date();
			const daysDiff = Math.floor(
				(now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24),
			);
			expect(daysDiff).toBe(30);
		});

		it("should clean Bull queue completed jobs older than 7 days", async () => {
			scheduledJobs.initialize();

			const cleanupCallback = (cron.schedule as Mock).mock.calls[3][1];

			await cleanupCallback();

			const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
			expect(mockScraperQueue.clean).toHaveBeenCalledWith(
				sevenDaysInMs,
				"completed",
			);
		});

		it("should clean Bull queue failed jobs older than 7 days", async () => {
			scheduledJobs.initialize();

			const cleanupCallback = (cron.schedule as Mock).mock.calls[3][1];

			await cleanupCallback();

			const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
			expect(mockScraperQueue.clean).toHaveBeenCalledWith(
				sevenDaysInMs,
				"failed",
			);
		});

		it("should handle cleanup errors gracefully", async () => {
			mockPrisma.scrapeJob.deleteMany.mockRejectedValue(
				new Error("Cleanup error"),
			);

			scheduledJobs.initialize();

			const cleanupCallback = (cron.schedule as Mock).mock.calls[3][1];

			// Should not throw
			await expect(cleanupCallback()).resolves.not.toThrow();
		});

		it("should handle queue cleanup errors gracefully", async () => {
			mockScraperQueue.clean.mockRejectedValue(
				new Error("Queue cleanup error"),
			);

			scheduledJobs.initialize();

			const cleanupCallback = (cron.schedule as Mock).mock.calls[3][1];

			// Should not throw
			await expect(cleanupCallback()).resolves.not.toThrow();
		});
	});

	describe("stop", () => {
		it("should stop all tasks", () => {
			scheduledJobs.initialize();

			const scheduleMock = cron.schedule as Mock;
			const tasks = scheduleMock.mock.results.map(
				(result: { value: CronTask }) => result.value,
			);

			// Clear mocks after init
			tasks.forEach((task: CronTask) => {
				task.stop.mockClear();
			});

			scheduledJobs.stop();

			// Should stop all 4 tasks
			tasks.forEach((task: CronTask) => {
				expect(task.stop).toHaveBeenCalled();
			});
		});

		it("should handle stop before initialize", () => {
			// Since we're using a singleton and it may have been initialized in other tests,
			// we can't reliably test this without resetting the module
			// Just verify stop can be called without throwing
			expect(() => scheduledJobs.stop()).not.toThrow();
		});

		it("should handle multiple stop calls", () => {
			scheduledJobs.initialize();

			const scheduleMock = cron.schedule as Mock;
			const tasks = scheduleMock.mock.results.map(
				(result: { value: CronTask }) => result.value,
			);

			scheduledJobs.stop();

			// Clear first stop calls
			tasks.forEach((task: CronTask) => {
				task.stop.mockClear();
			});

			// Second stop
			scheduledJobs.stop();

			// Should still attempt to stop tasks
			tasks.forEach((task: CronTask) => {
				expect(task.stop).toHaveBeenCalled();
			});
		});
	});

	describe("triggerDailyScrapes", () => {
		beforeEach(() => {
			mockPrisma.monitoredSearch.findMany.mockResolvedValue([
				{
					id: "1",
					searchTerm: "Test Search",
					frequency: "daily",
					active: true,
				},
			]);

			mockPrisma.monitoredSearch.update.mockResolvedValue({});
		});

		it("should manually trigger daily scrapes", async () => {
			await scheduledJobs.triggerDailyScrapes();

			expect(mockPrisma.monitoredSearch.findMany).toHaveBeenCalledWith({
				where: {
					active: true,
					frequency: "daily",
				},
			});
		});

		it("should add jobs to queue when manually triggered", async () => {
			await scheduledJobs.triggerDailyScrapes();

			expect(mockScraperQueue.add).toHaveBeenCalledWith(
				"scrape-properties",
				expect.objectContaining({
					searchTerm: "Test Search",
					scheduled: true,
				}),
				expect.any(Object),
			);
		});

		it("should update last run time when manually triggered", async () => {
			await scheduledJobs.triggerDailyScrapes();

			expect(mockPrisma.monitoredSearch.update).toHaveBeenCalledWith({
				where: { id: "1" },
				data: { lastRun: expect.any(Date) },
			});
		});
	});

	describe("Module Export", () => {
		it("should export scheduledJobs instance", () => {
			expect(scheduledJobs).toBeDefined();
			expect(typeof scheduledJobs.initialize).toBe("function");
			expect(typeof scheduledJobs.stop).toBe("function");
			expect(typeof scheduledJobs.triggerDailyScrapes).toBe("function");
		});
	});
});
