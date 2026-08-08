import { describe, expect, it, vi } from "vitest";

// list-curated-terms imports generate-next-200-terms which imports d1-prisma.
vi.mock("../lib/d1-prisma", () => ({
	epochAgo: (ms: number) => String(Date.now() - ms),
	prisma: {
		$disconnect: vi.fn(),
		searchTermAnalytics: { findMany: vi.fn().mockResolvedValue([]) },
		property: { count: vi.fn().mockResolvedValue(0) },
		scrapeJob: { findMany: vi.fn().mockResolvedValue([]) },
		$queryRaw: vi.fn().mockResolvedValue([]),
		$queryRawUnsafe: vi.fn().mockResolvedValue([]),
	},
}));
vi.mock("../lib/queue-utils", () => ({
	enqueueBatch: vi.fn().mockResolvedValue([]),
}));

import { getCuratedTermInventory } from "../utils/list-curated-terms";

describe("curated backfill term lists (T4 dedup invariant)", () => {
	it("has zero duplicates across all curated backfill lists", () => {
		const { duplicated } = getCuratedTermInventory();
		expect(duplicated, duplicated.join(", ")).toHaveLength(0);
	});
});
