import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_TERM_LENGTH } from "../../../utils/constants";

const mockQueryRaw = vi.fn();

vi.mock("../d1-prisma", () => ({
	prisma: { $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) },
	epochAgo: (ms: number) => String(Date.now() - ms),
}));

import {
	buildPrefixIndex,
	get2025Count,
	isSupersetOfAny,
} from "../backfill-utils";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("get2025Count", () => {
	it("returns the count from the query result", async () => {
		mockQueryRaw.mockResolvedValue([{ count: 12345 }]);
		const result = await get2025Count();
		expect(result).toBe(12345);
	});

	it("returns 0 when no properties exist", async () => {
		mockQueryRaw.mockResolvedValue([{ count: 0 }]);
		const result = await get2025Count();
		expect(result).toBe(0);
	});
});

describe("isSupersetOfAny", () => {
	// Test terms are crafted relative to MIN_TERM_LENGTH (4):
	// - "john" (length = MIN_TERM_LENGTH) → exact match, not a superset
	// - "johnson" (length > MIN_TERM_LENGTH, starts with "john") → superset
	// - "joe" (length < MIN_TERM_LENGTH) → too short to check
	const successful = new Set(["john", "smith", "jane"]);

	it("returns true when a shorter prefix is in the successful set", () => {
		expect(isSupersetOfAny("johnson", successful)).toBe(true);
	});

	it("returns true for longer extensions of successful terms", () => {
		expect(isSupersetOfAny("smithfield", successful)).toBe(true);
	});

	it("returns false when no prefix matches", () => {
		expect(isSupersetOfAny("williams", successful)).toBe(false);
	});

	it("returns false when the term equals a successful term (not longer)", () => {
		// "john" has length = MIN_TERM_LENGTH, loop runs for len < MIN_TERM_LENGTH → no iterations
		expect(isSupersetOfAny("john", successful)).toBe(false);
		expect("john".length).toBe(MIN_TERM_LENGTH);
	});

	it("returns false for terms shorter than MIN_TERM_LENGTH", () => {
		expect(isSupersetOfAny("joe", successful)).toBe(false);
		expect("joe".length).toBeLessThan(MIN_TERM_LENGTH);
	});

	it("returns false for an empty successful set", () => {
		expect(isSupersetOfAny("johnson", new Set())).toBe(false);
	});

	it("checks all prefix lengths from MIN_TERM_LENGTH up to term length - 1", () => {
		// "janes" (length = MIN_TERM_LENGTH + 1) should match "jane" at length MIN_TERM_LENGTH
		expect(isSupersetOfAny("janes", successful)).toBe(true);
		expect("janes".length).toBe(MIN_TERM_LENGTH + 1);
	});

	it("handles (MIN_TERM_LENGTH+1)-char terms with a MIN_TERM_LENGTH-char prefix", () => {
		const s = new Set(["test"]);
		expect("test".length).toBe(MIN_TERM_LENGTH);
		expect(isSupersetOfAny("testi", s)).toBe(true);
		expect(isSupersetOfAny("tests", s)).toBe(true);
		expect(isSupersetOfAny("toast", s)).toBe(false);
	});
});

describe("buildPrefixIndex", () => {
	it("indexes every proper prefix from MIN_TERM_LENGTH up to length - 1", () => {
		const index = buildPrefixIndex(new Set(["fortenberry"]));

		expect(index.has("fort")).toBe(true);
		expect(index.has("fortenberr")).toBe(true);
		expect(index.has("fortenberry")).toBe(false); // full term, not a proper prefix
		expect(index.has("for")).toBe(false); // below MIN_TERM_LENGTH
	});

	it("returns an empty index when every term is exactly MIN_TERM_LENGTH", () => {
		const term = "fort";
		expect(term.length).toBe(MIN_TERM_LENGTH);
		expect(buildPrefixIndex(new Set([term])).size).toBe(0);
	});

	it("merges prefixes across terms", () => {
		const index = buildPrefixIndex(new Set(["johnson", "smithfield"]));

		expect(index.has("john")).toBe(true);
		expect(index.has("smith")).toBe(true);
	});
});
