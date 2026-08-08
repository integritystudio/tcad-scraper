import { describe, expect, it, vi } from "vitest";

vi.mock("../config/batch-configs", () => ({
	BATCH_CONFIGS: {
		llc: { terms: ["LLC", "Trust", "smith"] },
		numbers: { terms: ["12345"] },
	},
	HIGH_RESULT_TERM_SPLITS: new Map([["Oaks", ["Oak Hill", "Oakwood"]]]),
}));

vi.mock("../lib/terms/FIRST_NAMES_FEMALE", () => ({
	FIRST_NAMES_FEMALE: ["Carol"],
}));
vi.mock("../lib/terms/FIRST_NAMES_MALE", () => ({ FIRST_NAMES_MALE: ["David"] }));
// overlaps batch-configs "smith" case-insensitively
vi.mock("../lib/terms/LAST_NAMES", () => ({ LAST_NAMES: ["Smith"] }));
vi.mock("../lib/terms/STREET_GEOGRAPHIC", () => ({ STREET_GEOGRAPHIC: ["Ranch"] }));
// overlaps batch-configs "Trust"
vi.mock("../lib/terms/BUSINESS_ENTITY", () => ({ BUSINESS_ENTITY: ["Trust"] }));

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
	});

	it("excludes numeric-only terms from every source", () => {
		const { all } = getAllSearchTerms();

		expect(all).not.toContain("12345");
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

		// "smith" (batch-configs) vs "Smith" (curated-names) — batch-configs wins.
		expect(sources["batch-configs"]).toContain("smith");
		expect(sources["curated-names"]).not.toContain("Smith");
		expect(duplicated.some((d) => d.toLowerCase().startsWith("smith ["))).toBe(
			true,
		);
	});

	it("returns all accepted terms, deduped, as a single sorted list", () => {
		const { all } = getAllSearchTerms();

		expect(all).toEqual(expect.arrayContaining(["Carol", "David", "Ranch"]));
		expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b)));
	});

	it("does not flag non-overlapping terms as duplicated", () => {
		const { duplicated } = getAllSearchTerms();

		// LLC, Oakwood, Carol, David, Ranch appear in exactly one source each in
		// the fixture above — only "Trust" and "smith"/"Smith" overlap.
		for (const term of ["LLC", "Oakwood", "Carol", "David", "Ranch"]) {
			expect(duplicated.some((d) => d.startsWith(`${term} [`))).toBe(false);
		}
	});
});
