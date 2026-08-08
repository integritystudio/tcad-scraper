import { describe, expect, it } from "vitest";
import {
	buildCoverageIndex,
	buildCoveredMask,
	type CorpusRow,
	greedyCover,
	prefixesForRow,
	tokenize,
} from "../coverage-optimizer";

const row = (name: string, address = ""): CorpusRow => ({
	name,
	property_address: address || null,
});

describe("tokenize", () => {
	it("lower-cases and splits on whitespace", () => {
		expect(tokenize("BARNETT HOWARD")).toEqual(["barnett", "howard"]);
	});

	it("keeps hyphens inside a word", () => {
		// TCAD prefix matching does not cross a hyphen: "mo-pac" returns 966
		// matches where "mopa" returns 46, so MO-PAC must stay one token.
		expect(tokenize("MO-PAC EXPY")).toEqual(["mo-pac", "expy"]);
	});

	it("strips edge punctuation but keeps the word", () => {
		expect(tokenize("SMITH, JOHN (TRUSTEE)")).toEqual([
			"smith",
			"john",
			"trustee",
		]);
	});

	it("drops standalone punctuation tokens such as the ampersand", () => {
		expect(tokenize("SMITH KATRINA & AMMON")).toEqual([
			"smith",
			"katrina",
			"ammon",
		]);
	});

	it("returns nothing for null or empty text", () => {
		expect(tokenize(null)).toEqual([]);
		expect(tokenize("")).toEqual([]);
	});
});

describe("prefixesForRow", () => {
	it("takes the 4-char prefix of every long-enough word in name and address", () => {
		const prefixes = prefixesForRow(row("ZILKER BREWING", "1701 E 6 ST"));
		expect(prefixes).toEqual(new Set(["zilk", "brew"]));
	});

	it("drops words shorter than the prefix length — TCAD rejects them as terms", () => {
		expect(prefixesForRow(row("LEE"))).toEqual(new Set());
	});

	it("drops all-digit prefixes — bare numeric terms do not search", () => {
		const prefixes = prefixesForRow(row("", "12345 BARTON SPRINGS RD"));
		expect(prefixes).toEqual(new Set(["bart", "spri"]));
	});

	it("deduplicates a prefix shared by two words", () => {
		expect(prefixesForRow(row("SMITH SMITHERS"))).toEqual(new Set(["smit"]));
	});
});

describe("buildCoverageIndex", () => {
	const rows = [
		row("SMITH JOHN"),
		row("SMITHERS ANNA"),
		row("JOHNSON PAUL"),
		row("LEE"), // no word >= 4 chars → unreachable
	];

	it("maps each prefix to the properties it matches", () => {
		const index = buildCoverageIndex(rows, { minPostings: 1 });

		expect(Array.from(index.postings.get("smit") ?? [])).toEqual([0, 1]);
		expect(Array.from(index.postings.get("john") ?? [])).toEqual([0, 2]);
		expect(index.propertyCount).toBe(4);
	});

	it("counts properties no 4-char term can reach", () => {
		const index = buildCoverageIndex(rows, { minPostings: 1 });
		expect(index.unreachableCount).toBe(1);
	});

	it("drops candidates below minPostings", () => {
		const index = buildCoverageIndex(rows, { minPostings: 2 });

		expect(index.postings.has("smit")).toBe(true); // 2 properties
		expect(index.postings.has("anna")).toBe(false); // 1 property
	});

	it("omits excluded prefixes entirely", () => {
		const index = buildCoverageIndex(rows, {
			minPostings: 1,
			excluded: new Set(["smit"]),
		});

		expect(index.postings.has("smit")).toBe(false);
		expect(index.postings.has("john")).toBe(true);
	});
});

describe("buildCoveredMask", () => {
	const rows = [row("SMITH JOHN"), row("SMITZ ANNA"), row("JOHNSON PAUL")];

	it("credits a term only with the properties it actually matches", () => {
		// "smith" is a longer prefix than "smit": it reaches SMITH but not
		// SMITZ, so crediting it with the whole "smit" posting would report the
		// corpus as covered while SMITZ is still missing.
		expect(Array.from(buildCoveredMask(rows, ["smith"]))).toEqual([1, 0, 0]);
		expect(Array.from(buildCoveredMask(rows, ["smit"]))).toEqual([1, 1, 0]);
	});

	it("matches each token of a multi-word term independently", () => {
		expect(Array.from(buildCoveredMask(rows, ["anna paul"]))).toEqual([
			0, 1, 1,
		]);
	});

	it("ignores tokens shorter than the prefix length", () => {
		expect(Array.from(buildCoveredMask(rows, ["lee"]))).toEqual([0, 0, 0]);
	});

	it("returns an all-zero mask for no terms", () => {
		expect(Array.from(buildCoveredMask(rows, []))).toEqual([0, 0, 0]);
	});
});

describe("greedyCover", () => {
	/** "aaaa" covers 4, "bbbb" covers 3 of which 2 overlap "aaaa", "cccc" covers 1. */
	const rows: CorpusRow[] = [
		row("AAAA"),
		row("AAAA BBBB"),
		row("AAAA BBBB"),
		row("AAAA"),
		row("BBBB"),
		row("CCCC"),
	];

	it("picks terms by marginal, not total, coverage", () => {
		const index = buildCoverageIndex(rows, { minPostings: 1 });
		const result = greedyCover(index, { minMarginalGain: 1 });

		expect(result.selected.map((s) => s.term)).toEqual([
			"aaaa", // 4 new
			"bbbb", // 1 new (2 of its 3 already covered by aaaa)
			"cccc", // 1 new
		]);
		expect(result.selected.map((s) => s.newlyCovered)).toEqual([4, 1, 1]);
	});

	it("reports cumulative coverage that reaches the whole corpus", () => {
		const index = buildCoverageIndex(rows, { minPostings: 1 });
		const result = greedyCover(index, { minMarginalGain: 1 });

		expect(result.totalCovered).toBe(rows.length);
		expect(result.selected[result.selected.length - 1].cumulativeFraction).toBe(
			1,
		);
	});

	it("stops once the target fraction is reached", () => {
		const index = buildCoverageIndex(rows, { minPostings: 1 });
		const result = greedyCover(index, {
			targetFraction: 0.5,
			minMarginalGain: 1,
		});

		expect(result.stoppedBecause).toBe("target-reached");
		expect(result.selected).toHaveLength(1);
	});

	it("stops when the next term adds too little", () => {
		const index = buildCoverageIndex(rows, { minPostings: 1 });
		const result = greedyCover(index, {
			targetFraction: 1,
			minMarginalGain: 2,
		});

		expect(result.stoppedBecause).toBe("marginal-gain");
		expect(result.selected.map((s) => s.term)).toEqual(["aaaa"]);
	});

	it("honours maxTerms", () => {
		const index = buildCoverageIndex(rows, { minPostings: 1 });
		const result = greedyCover(index, {
			targetFraction: 1,
			minMarginalGain: 1,
			maxTerms: 2,
		});

		expect(result.stoppedBecause).toBe("max-terms");
		expect(result.selected).toHaveLength(2);
	});

	it("plans only the remainder when work is already covered", () => {
		const index = buildCoverageIndex(rows, { minPostings: 1 });
		const result = greedyCover(index, {
			preCoveredMask: buildCoveredMask(rows, ["aaaa"]),
			minMarginalGain: 1,
		});

		expect(result.preCovered).toBe(4);
		expect(result.selected.map((s) => s.term)).toEqual(["bbbb", "cccc"]);
	});

	it("never selects an excluded term", () => {
		const index = buildCoverageIndex(rows, { minPostings: 1 });
		const result = greedyCover(index, {
			excludeTerms: new Set(["aaaa"]),
			minMarginalGain: 1,
		});

		expect(result.selected.map((s) => s.term)).not.toContain("aaaa");
		expect(result.selected.map((s) => s.term)).toContain("bbbb");
	});

	it("rejects a pre-covered mask sized for a different corpus", () => {
		const index = buildCoverageIndex(rows, { minPostings: 1 });

		expect(() =>
			greedyCover(index, { preCoveredMask: new Uint8Array(2) }),
		).toThrow(RangeError);
	});

	it("matches exhaustive search on a corpus small enough to brute-force", () => {
		// Greedy is only an approximation in general, so pin it against the
		// true optimum on a case where the optimum is computable: three terms
		// cover the corpus and no two do.
		const small: CorpusRow[] = [row("AAAA"), row("BBBB"), row("CCCC")];
		const index = buildCoverageIndex(small, { minPostings: 1 });
		const result = greedyCover(index, { minMarginalGain: 1 });

		expect(result.selected).toHaveLength(3);
		expect(result.totalCovered).toBe(3);
	});
});
