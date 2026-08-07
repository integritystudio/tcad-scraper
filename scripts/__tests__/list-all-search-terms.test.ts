import { describe, expect, it, vi } from "vitest";

vi.mock("../config/batch-configs", () => ({
	BATCH_CONFIGS: {
		llc: { terms: ["LLC", "Trust"] },
		numbers: { terms: ["12345"] },
	},
	HIGH_RESULT_TERM_SPLITS: new Map([["Oak", ["Oak Hill", "Oakwood"]]]),
}));

vi.mock("../lib/curated-names", () => ({
	FIRST_NAMES_FEMALE: ["Carol"],
	FIRST_NAMES_MALE: ["David"],
	LAST_NAMES: ["Smith"],
	STREET_GEOGRAPHIC: ["Ranch"],
	BUSINESS_ENTITY: ["Trust"], // overlaps batch-configs "Trust"
}));

vi.mock("../lib/fallback-terms", () => ({
	FALLBACK_TERMS: ["smith", "Johnson", "99999"], // "smith" overlaps curated-names "Smith"
}));

import { getAllSearchTerms } from "../utils/list-all-search-terms";

describe("getAllSearchTerms", () => {
	it("collects non-numeric terms from every source into their own bucket", () => {
		const { sources } = getAllSearchTerms();

		expect(sources["batch-configs"]).toEqual(
			expect.arrayContaining(["LLC", "Oak Hill", "Oakwood"]),
		);
		expect(sources["curated-names"]).toEqual(
			expect.arrayContaining(["Carol", "David", "Ranch"]),
		);
		expect(sources["fallback-terms"]).toEqual(
			expect.arrayContaining(["Johnson"]),
		);
	});

	it("excludes numeric-only terms from every source", () => {
		const { all } = getAllSearchTerms();

		expect(all).not.toContain("12345");
		expect(all).not.toContain("99999");
	});

	it("prefers the higher-priority source and records the overlap", () => {
		const { sources, duplicated } = getAllSearchTerms();

		// "Trust" is in both batch-configs and curated-names (BUSINESS_ENTITY) —
		// batch-configs wins per priority order.
		expect(sources["batch-configs"]).toContain("Trust");
		expect(sources["curated-names"]).not.toContain("Trust");
		expect(duplicated.some((d) => d.startsWith("Trust ["))).toBe(true);
	});

	it("dedupes case-insensitively across sources", () => {
		const { sources, duplicated } = getAllSearchTerms();

		// "Smith" (curated-names) vs "smith" (fallback-terms) — curated-names wins.
		expect(sources["curated-names"]).toContain("Smith");
		expect(sources["fallback-terms"]).not.toContain("smith");
		expect(duplicated.some((d) => d.toLowerCase().startsWith("smith ["))).toBe(
			true,
		);
	});

	it("returns all accepted terms, deduped, as a single sorted list", () => {
		const { all } = getAllSearchTerms();

		expect(all).toEqual(expect.arrayContaining(["Carol", "David", "Johnson"]));
		expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b)));
	});

	it("does not flag non-overlapping terms as duplicated", () => {
		const { duplicated } = getAllSearchTerms();

		// LLC, Oakwood, Carol, David, Ranch, Johnson appear in exactly one
		// source each in the fixture above — only "Trust" and "Smith" overlap.
		for (const term of [
			"LLC",
			"Oakwood",
			"Carol",
			"David",
			"Ranch",
			"Johnson",
		]) {
			expect(duplicated.some((d) => d.startsWith(`${term} [`))).toBe(false);
		}
	});
});
