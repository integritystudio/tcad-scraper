import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAnalyticsFindMany = vi.fn();
const mockBlacklistFindMany = vi.fn();
const mockGroupBy = vi.fn();
const mockDisconnect = vi.fn();
const mockQueryRaw = vi.fn();
const mockScrapeJobFindMany = vi.fn();

// Dispatch searchTermAnalytics.findMany by argument shape:
//   - analytics call (getSearchedTermSets): select only, no where.successRate
//   - blacklist call (main): where.successRate === 0
function dispatchAnalyticsFindMany(...args: unknown[]) {
	const opts = args[0] as Record<string, unknown> | undefined;
	const where = opts?.where as Record<string, unknown> | undefined;
	if (where && "successRate" in where) return mockBlacklistFindMany(...args);
	return mockAnalyticsFindMany(...args);
}

vi.mock("../../server/src/lib/prisma", () => ({
	prisma: {
		searchTermAnalytics: {
			findMany: (...args: unknown[]) => dispatchAnalyticsFindMany(...args),
		},
		property: {
			groupBy: (...args: unknown[]) => mockGroupBy(...args),
		},
		scrapeJob: {
			findMany: (...args: unknown[]) => mockScrapeJobFindMany(...args),
		},
		$queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
		$disconnect: () => mockDisconnect(),
	},
}));

const mockEnqueueBatch = vi.fn();
vi.mock("../lib/queue-utils", () => ({
	enqueueBatch: (...args: unknown[]) => mockEnqueueBatch(...args),
}));

const mockQueueClose = vi.fn();
vi.mock("../../server/src/queues/scraper.queue", () => ({
	scraperQueue: {
		close: () => mockQueueClose(),
	},
}));

import { main } from "../generate-next-200-terms";

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "log").mockImplementation(() => {});

	mockAnalyticsFindMany.mockResolvedValue([]);
	mockBlacklistFindMany.mockResolvedValue([]);
	mockGroupBy.mockResolvedValue([]);
	mockScrapeJobFindMany.mockResolvedValue([]);
	mockEnqueueBatch.mockResolvedValue(0);
});

describe("generate-next-200-terms main()", () => {
	it("does NOT call enqueueBatch when enqueueMode is false (default)", async () => {
		await main(false);
		expect(mockEnqueueBatch).not.toHaveBeenCalled();
		expect(mockQueueClose).not.toHaveBeenCalled();
	});

	it("calls enqueueBatch with selected terms and 'next-200-gen' userId when enqueueMode=true", async () => {
		mockEnqueueBatch.mockResolvedValue(5);

		await main(true);

		expect(mockEnqueueBatch).toHaveBeenCalledOnce();
		const [terms, userId] = mockEnqueueBatch.mock.calls[0] as [
			string[],
			string,
		];
		expect(userId).toBe("next-200-gen");
		expect(Array.isArray(terms)).toBe(true);
		expect(terms.length).toBeGreaterThan(0);
	});

	it("calls scraperQueue.close() after enqueue completes", async () => {
		mockEnqueueBatch.mockResolvedValue(5);

		await main(true);

		expect(mockQueueClose).toHaveBeenCalledOnce();
	});

	it("does not call scraperQueue.close() when enqueueMode is false", async () => {
		await main(false);
		expect(mockQueueClose).not.toHaveBeenCalled();
	});

	it("resolves without throwing on success path", async () => {
		await expect(main(false)).resolves.toBeUndefined();
	});

	it("resolves without throwing when enqueue succeeds", async () => {
		mockEnqueueBatch.mockResolvedValue(10);
		await expect(main(true)).resolves.toBeUndefined();
	});
});
