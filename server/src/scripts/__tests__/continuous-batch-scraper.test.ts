import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing TermSelector
const mockFindMany = vi.fn();
const mockGroupBy = vi.fn();
vi.mock("../../lib/prisma", () => ({
	prisma: {
		searchTermAnalytics: {
			findMany: (...args: unknown[]) => mockFindMany(...args),
		},
		property: {
			groupBy: (...args: unknown[]) => mockGroupBy(...args),
		},
	},
}));

// Mock scraper queue (imported transitively)
vi.mock("../../queues/scraper.queue", () => ({
	scraperQueue: {
		add: vi.fn(),
		getWaitingCount: vi.fn().mockResolvedValue(0),
		getActiveCount: vi.fn().mockResolvedValue(0),
		getWaiting: vi.fn().mockResolvedValue([]),
		getActive: vi.fn().mockResolvedValue([]),
	},
}));

// Mock search-term-optimizer
const mockGetBlacklistedTerms = vi.fn();
const mockGetOverSearchedTerms = vi.fn();
vi.mock("../../services/search-term-optimizer", () => ({
	searchTermOptimizer: {
		getBlacklistedTerms: (...args: unknown[]) => mockGetBlacklistedTerms(...args),
		getOverSearchedTerms: (...args: unknown[]) => mockGetOverSearchedTerms(...args),
	},
}));

import { TermSelector } from "../continuous-batch-scraper";

function makeTierRow(searchTerm: string) {
	return { searchTerm };
}

// Call order per getNextBatch:
// 1. getSearchedTermSet → searchTermAnalytics.findMany (searched set) + property.groupBy
// 2. queryTier(tier1) → searchTermAnalytics.findMany
// 3. queryTier(tier2) → searchTermAnalytics.findMany
// 4. queryTier(tier3) → searchTermAnalytics.findMany
// 5. Tier 4 fallback (no findMany, uses cached searched set)

describe("TermSelector", () => {
	let selector: TermSelector;

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset defaults after clearAllMocks
		mockGetBlacklistedTerms.mockResolvedValue([]);
		mockGetOverSearchedTerms.mockResolvedValue([]);
		mockFindMany.mockResolvedValue([]);
		mockGroupBy.mockResolvedValue([]);
		selector = new TermSelector();
	});

	describe("tier ordering", () => {
		it("selects Tier 1 terms before Tier 2 and Tier 3", async () => {
			mockFindMany
				.mockResolvedValueOnce([]) // getSearchedTermSet (analytics)
				.mockResolvedValueOnce([makeTierRow("HighYield500")]) // tier 1
				.mockResolvedValueOnce([makeTierRow("ModYield100")]) // tier 2
				.mockResolvedValueOnce([makeTierRow("ReScrape1000")]); // tier 3

			const batch = await selector.getNextBatch(3);
			expect(batch).toEqual(["HighYield500", "ModYield100", "ReScrape1000"]);
		});

		it("fills from lower tiers when higher tiers are empty", async () => {
			mockFindMany
				.mockResolvedValueOnce([]) // getSearchedTermSet (analytics)
				.mockResolvedValueOnce([]) // tier 1 empty
				.mockResolvedValueOnce([makeTierRow("ModYield")]) // tier 2
				.mockResolvedValueOnce([]); // tier 3 empty

			const batch = await selector.getNextBatch(2);
			// Should have ModYield from tier 2, plus a fallback term
			expect(batch[0]).toBe("ModYield");
			expect(batch.length).toBe(2);
		});
	});

	describe("enqueued term exclusion", () => {
		it("does not return the same term twice across calls", async () => {
			// First call: searched set + tier1 returns [TermA]
			mockFindMany
				.mockResolvedValueOnce([]) // getSearchedTermSet (analytics) — cached after first call
				.mockResolvedValueOnce([makeTierRow("TermA")]) // call 1: tier1
				// Second call: searched set cached, tier1 returns [TermA, TermB]
				.mockResolvedValueOnce([makeTierRow("TermA"), makeTierRow("TermB")]); // call 2: tier1

			const batch1 = await selector.getNextBatch(1);
			expect(batch1).toEqual(["TermA"]);

			const batch2 = await selector.getNextBatch(1);
			expect(batch2).toEqual(["TermB"]);
		});
	});

	describe("fallback behavior", () => {
		it("falls back to FALLBACK_TERMS when DB tiers are exhausted", async () => {
			// All tiers empty — default mockResolvedValue([]) covers all findMany calls
			const batch = await selector.getNextBatch(3);
			expect(batch.length).toBe(3);
			expect(batch.every((t) => typeof t === "string" && t.length > 0)).toBe(true);
		});

		it("excludes already-searched terms from fallback", async () => {
			mockFindMany
				.mockResolvedValueOnce([ // getSearchedTermSet (analytics)
					{ searchTerm: "Joseph" },
					{ searchTerm: "Taylor" },
					{ searchTerm: "Charles" },
				])
				.mockResolvedValueOnce([]) // tier 1
				.mockResolvedValueOnce([]) // tier 2
				.mockResolvedValueOnce([]); // tier 3

			const batch = await selector.getNextBatch(3);
			expect(batch).not.toContain("Joseph");
			expect(batch).not.toContain("Taylor");
			expect(batch).not.toContain("Charles");
		});
	});

	describe("exhaustion", () => {
		it("returns empty array when all sources exhausted", async () => {
			// Exhaust all fallback terms by requesting a huge batch
			const bigBatch = await selector.getNextBatch(500);
			expect(bigBatch.length).toBeGreaterThan(0);

			// Now request more — should be empty
			const emptyBatch = await selector.getNextBatch(5);
			expect(emptyBatch).toEqual([]);
		});
	});

	describe("blacklist handling", () => {
		it("skips blacklisted terms from DB tiers", async () => {
			mockGetBlacklistedTerms.mockResolvedValue(["BadTerm"]);

			mockFindMany
				.mockResolvedValueOnce([]) // getSearchedTermSet (analytics)
				.mockResolvedValueOnce([makeTierRow("BadTerm"), makeTierRow("GoodTerm")]) // tier 1
				.mockResolvedValueOnce([]) // tier 2
				.mockResolvedValueOnce([]); // tier 3

			const batch = await selector.getNextBatch(1);
			expect(batch).toEqual(["GoodTerm"]);
		});

		it("marks over-searched terms as enqueued", async () => {
			mockGetOverSearchedTerms.mockResolvedValue(["OverDone"]);

			mockFindMany
				.mockResolvedValueOnce([]) // getSearchedTermSet (analytics)
				.mockResolvedValueOnce([makeTierRow("OverDone"), makeTierRow("Fresh")]) // tier 1
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);

			const batch = await selector.getNextBatch(1);
			expect(batch).toEqual(["Fresh"]);
		});

		it("loads blacklist only once", async () => {
			await selector.getNextBatch(1);
			await selector.getNextBatch(1);

			expect(mockGetBlacklistedTerms).toHaveBeenCalledTimes(1);
			expect(mockGetOverSearchedTerms).toHaveBeenCalledTimes(1);
		});
	});
});
