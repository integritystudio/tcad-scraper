import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCount = vi.fn();

vi.mock("../d1-prisma", () => ({
	prisma: { scrapeJob: { count: (...args: unknown[]) => mockCount(...args) } },
}));

import { getJobStats } from "../job-stats";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("getJobStats", () => {
	it("fetches total/completed/failed/pending counts by status", async () => {
		mockCount
			.mockResolvedValueOnce(100) // total (no where clause)
			.mockResolvedValueOnce(60) // completed
			.mockResolvedValueOnce(30) // failed
			.mockResolvedValueOnce(10); // pending

		const stats = await getJobStats();

		expect(stats.totalJobs).toBe(100);
		expect(stats.completedJobs).toBe(60);
		expect(stats.failedJobs).toBe(30);
		expect(stats.pendingJobs).toBe(10);
		expect(mockCount).toHaveBeenNthCalledWith(1);
		expect(mockCount).toHaveBeenNthCalledWith(2, {
			where: { status: "completed" },
		});
		expect(mockCount).toHaveBeenNthCalledWith(3, {
			where: { status: "failed" },
		});
		expect(mockCount).toHaveBeenNthCalledWith(4, {
			where: { status: "pending" },
		});
	});

	it("computes completedRate and failedRate as percentages of total", async () => {
		mockCount
			.mockResolvedValueOnce(100)
			.mockResolvedValueOnce(60)
			.mockResolvedValueOnce(30)
			.mockResolvedValueOnce(10);

		const stats = await getJobStats();

		expect(stats.completedRate).toBe(60);
		expect(stats.failedRate).toBe(30);
	});

	it("returns 0 rates when totalJobs is 0, without dividing by zero", async () => {
		mockCount
			.mockResolvedValueOnce(0)
			.mockResolvedValueOnce(0)
			.mockResolvedValueOnce(0)
			.mockResolvedValueOnce(0);

		const stats = await getJobStats();

		expect(stats.completedRate).toBe(0);
		expect(stats.failedRate).toBe(0);
	});
});
