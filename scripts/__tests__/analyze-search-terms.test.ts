import { beforeEach, describe, expect, it, vi } from "vitest";

const mockScrapeJobCount = vi.fn();
const mockScrapeJobFindMany = vi.fn();
const mockGet2025Count = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock("../lib/d1-prisma", () => ({
	prisma: {
		scrapeJob: {
			count: (...args: unknown[]) => mockScrapeJobCount(...args),
			findMany: (...args: unknown[]) => mockScrapeJobFindMany(...args),
		},
		$queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
	},
	epochAgo: (ms: number) => String(Date.now() - ms),
}));

vi.mock("../lib/backfill-utils", () => ({
	get2025Count: (...args: unknown[]) => mockGet2025Count(...args),
}));

import { analyzeSearchTerms } from "../analyze-search-terms";

/** Configure standard mock responses for one full analyzeSearchTerms() run. */
function setupDefaultMocks(overrides: { propertyCount?: number } = {}) {
	vi.clearAllMocks();

	// scrapeJob.count called 4 times: total, completed, failed, pending
	mockScrapeJobCount
		.mockResolvedValueOnce(10)
		.mockResolvedValueOnce(8)
		.mockResolvedValueOnce(1)
		.mockResolvedValueOnce(1);

	mockGet2025Count.mockResolvedValue(overrides.propertyCount ?? 450_000);

	// $queryRaw called in order:
	// 1. COUNT(DISTINCT search_term) from scrape_jobs — unique terms
	// 2. top 20 terms query → []
	// 3. always-failing terms → []
	// 4. recent terms (last 30 days) → []
	mockQueryRaw
		.mockResolvedValueOnce([{ count: BigInt(42) }]) // unique terms
		.mockResolvedValueOnce([]) // topTerms
		.mockResolvedValueOnce([]) // failingTerms
		.mockResolvedValueOnce([]); // recentTerms

	// countTermsMatching (5 categories) uses scrapeJob.findMany with distinct
	mockScrapeJobFindMany.mockResolvedValue([]);
}

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("analyzeSearchTerms — staleness guard", () => {
	it("fires console.warn when propertyCount exceeds TARGET_2025_PROPERTY_COUNT", async () => {
		setupDefaultMocks({ propertyCount: 510_000 });

		await analyzeSearchTerms();

		const warnSpy = vi.mocked(console.warn);
		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("constant may be stale"),
		);
	});

	it("does NOT fire console.warn when propertyCount is below threshold", async () => {
		setupDefaultMocks({ propertyCount: 400_000 });

		await analyzeSearchTerms();

		expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
	});

	it("clamps Remaining to 0 when DB count exceeds TARGET_2025_PROPERTY_COUNT", async () => {
		setupDefaultMocks({ propertyCount: 500_000 });

		await analyzeSearchTerms();

		const allOutput = vi
			.mocked(console.log)
			.mock.calls.map((c) => c[0] as string)
			.join("\n");
		expect(allOutput).toContain("Remaining: 0");
		expect(allOutput).not.toMatch(/Remaining: -/);
	});
});

describe("analyzeSearchTerms — totalJobs === 0", () => {
	it("does not throw when totalJobs is 0", async () => {
		setupDefaultMocks();
		// Override: all job counts = 0
		mockScrapeJobCount.mockReset().mockResolvedValue(0);

		await expect(analyzeSearchTerms()).resolves.toBeUndefined();
	});

	it("reports 0.0% rather than NaN% (getJobStats guards divide-by-zero)", async () => {
		setupDefaultMocks();
		mockScrapeJobCount.mockReset().mockResolvedValue(0);

		await analyzeSearchTerms();

		const allOutput = vi
			.mocked(console.log)
			.mock.calls.map((c) => c[0] as string)
			.join("\n");
		expect(allOutput).not.toContain("NaN%");
		expect(allOutput).toContain("Completed: 0 (0.0%)");
		expect(allOutput).toContain("Failed: 0 (0.0%)");
	});
});
