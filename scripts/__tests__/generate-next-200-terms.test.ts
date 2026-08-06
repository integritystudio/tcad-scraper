import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAnalyticsFindMany = vi.fn();
const mockBlacklistFindMany = vi.fn();
const mockGroupBy = vi.fn();
const mockDisconnect = vi.fn();
const mockQueryRaw = vi.fn();
const mockQueryRawUnsafe = vi.fn();
const mockPropertyCount = vi.fn();
const mockScrapeJobFindMany = vi.fn();

// Yield-scoring chunk result: every candidate scores mid-band so none are
// dropped and tie-stable sort preserves selection order.
const MID_BAND_SCORE = 150;
const YIELD_CHUNK_ROW = Object.fromEntries(
	Array.from({ length: 25 }, (_, j) => [`c${j}`, MID_BAND_SCORE]),
);

// Dispatch searchTermAnalytics.findMany by argument shape:
//   - analytics call (getSearchedTermSets): select only, no where.successRate
//   - blacklist call (main): where.successRate === 0
function dispatchAnalyticsFindMany(...args: unknown[]) {
	const opts = args[0] as Record<string, unknown> | undefined;
	const where = opts?.where as Record<string, unknown> | undefined;
	if (where && "successRate" in where) return mockBlacklistFindMany(...args);
	return mockAnalyticsFindMany(...args);
}

vi.mock("../lib/d1-prisma", () => ({
	epochAgo: (ms: number) => String(Date.now() - ms),
	prisma: {
		searchTermAnalytics: {
			findMany: (...args: unknown[]) => dispatchAnalyticsFindMany(...args),
		},
		property: {
			groupBy: (...args: unknown[]) => mockGroupBy(...args),
			count: (...args: unknown[]) => mockPropertyCount(...args),
		},
		scrapeJob: {
			findMany: (...args: unknown[]) => mockScrapeJobFindMany(...args),
		},
		$queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
		$queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
		$disconnect: () => mockDisconnect(),
	},
}));

const mockEnqueueBatch = vi.fn();
vi.mock("../lib/queue-utils", () => ({
	enqueueBatch: (...args: unknown[]) => mockEnqueueBatch(...args),
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
	mockQueryRawUnsafe.mockResolvedValue([YIELD_CHUNK_ROW]);
	mockPropertyCount.mockResolvedValue(260_000);
	mockEnqueueBatch.mockResolvedValue([]);
});

describe("generate-next-200-terms main()", () => {
	it("does NOT call enqueueBatch when enqueueMode is false (default)", async () => {
		await main(false);
		expect(mockEnqueueBatch).not.toHaveBeenCalled();
	});

	it("calls enqueueBatch with selected terms and 'next-200-gen' userId when enqueueMode=true", async () => {
		mockEnqueueBatch.mockImplementation(async (terms: unknown) => terms);

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

	it("resolves without throwing on success path", async () => {
		await expect(main(false)).resolves.toBeUndefined();
	});

	it("resolves without throwing when enqueue succeeds", async () => {
		mockEnqueueBatch.mockImplementation(async (terms: unknown) => terms);
		await expect(main(true)).resolves.toBeUndefined();
	});

	it("excludes DB-blacklisted terms from selection regardless of stored casing", async () => {
		// Regression: the retired SearchTermDeduplicator compared original-case
		// candidates against a lowercased blacklist, so Title-case candidates
		// slipped through once the failed-only carve-out (c758fba) removed
		// blacklisted terms from allSearched.
		mockBlacklistFindMany.mockResolvedValue([{ searchTerm: "Christine" }]);

		await main(true);

		const [terms] = mockEnqueueBatch.mock.calls[0] as [string[]];
		expect(terms).not.toContain("Christine");
		expect(terms).toContain("Theresa"); // non-blacklisted sibling still selected
	});
});
