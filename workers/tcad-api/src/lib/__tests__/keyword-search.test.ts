import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
	FTS_MAX_PAGE_SIZE,
	buildFtsMatchQuery,
	buildKeywordSearchFilters,
	extractValueBounds,
	searchKeywordFallback,
	stripValuePhrases,
} from "../keyword-search";


describe("buildFtsMatchQuery", () => {
	it("quotes and OR-joins plain words", () => {
		expect(buildFtsMatchQuery("Oak Street")).toBe('"oak" OR "street"');
	});

	it("neutralizes FTS5 operators and punctuation", () => {
		expect(buildFtsMatchQuery('name:* AND "x" NOT (y)')).toBe(
			'"name" OR "and" OR "x" OR "not" OR "y"',
		);
	});

	it("keeps digits from natural-language queries", () => {
		expect(buildFtsMatchQuery("worth over $500k")).toBe('"500k"');
	});

	it("returns empty string when no tokens survive", () => {
		expect(buildFtsMatchQuery("$%^&*")).toBe("");
	});

	it("drops query-language stopwords so signal tokens drive the ranking", () => {
		// The measured worst case: filler tokens previously OR-matched 48% of
		// the table and outranked every real Austin property.
		expect(buildFtsMatchQuery("properties in Austin worth over 500k")).toBe(
			'"austin" OR "500k"',
		);
	});

	it("keeps raw tokens when every token is a stopword", () => {
		// Rather than emptying the match and silently returning nothing.
		expect(buildFtsMatchQuery("show me all the properties")).toBe(
			'"show" OR "me" OR "all" OR "the" OR "properties"',
		);
	});

	it("does not drop stopword substrings inside real tokens", () => {
		// "Overton" starts with "over"; "Ain" is not "in" — token equality only.
		expect(buildFtsMatchQuery("Overton Ainsworth")).toBe(
			'"overton" OR "ainsworth"',
		);
	});
});

describe("extractValueBounds", () => {
	it("reads a lower bound with a k suffix", () => {
		expect(extractValueBounds("worth over 500k")).toEqual({
			min: 500_000,
			max: null,
		});
	});

	it.each([
		["over $500k", 500_000],
		["above 500,000", 500_000],
		["more than 1.2m", 1_200_000],
		["greater than 3 million", 3_000_000],
		["over 500000", 500_000],
	])("parses lower bound from %s", (phrase, expected) => {
		expect(extractValueBounds(phrase).min).toBe(expected);
	});

	it.each([
		["under 250k", 250_000],
		["below $250,000", 250_000],
		["less than 1m", 1_000_000],
	])("parses upper bound from %s", (phrase, expected) => {
		expect(extractValueBounds(phrase).max).toBe(expected);
	});

	it("reads both bounds from one query", () => {
		expect(extractValueBounds("over 100k under 500k")).toEqual({
			min: 100_000,
			max: 500_000,
		});
	});

	it("returns no bounds when the query has no comparison", () => {
		expect(extractValueBounds("Oak Street Austin")).toEqual({
			min: null,
			max: null,
		});
	});

	it("ignores a bare amount with no comparator", () => {
		// "$500,000 homes" states a value but asks for no comparison.
		expect(extractValueBounds("$500,000 homes")).toEqual({
			min: null,
			max: null,
		});
	});
});

describe("stripValuePhrases", () => {
	it("removes the comparison so its digits never become FTS tokens", () => {
		expect(buildFtsMatchQuery(stripValuePhrases("Austin over 500k"))).toBe(
			'"austin"',
		);
	});
});

describe("searchKeywordFallback", () => {
	it("paginates in SQL so totalResults is not capped at the D1 param limit", async () => {
		// T13 (2026-08-08): previously ids were folded into `id IN (...)` with a
		// hard cap of 90 (D1_MAX_BOUND_PARAMS - headroom). The fix runs
		// LIMIT/OFFSET + COUNT(*) inside SQL so any page size is supported.
		let pageValues: unknown[] = [];
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				const isCount = sql.includes("COUNT(*)");
				if (!isCount) pageValues = values;
				return Promise.resolve(isCount ? [{ total: 42 }] : [{ id: "p1" }]);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(prisma, "Oak Street", 2025, 50, 100);

		const pageLimit = pageValues[pageValues.length - 2] as number;
		const pageOffset = pageValues[pageValues.length - 1] as number;

		expect(pageLimit).toBe(50);
		expect(pageOffset).toBe(100);
		expect(result.precomputedTotal).toBe(42);
		expect(result.whereClause).toEqual({ id: { in: ["p1"] } });
	});

	it("FTS_MAX_PAGE_SIZE fits within D1's 100-param budget when year is bound", () => {
		// The data-fetch does WHERE id IN (pageIds) AND year = ? — ids + 1 for year
		// must be <= 100.
		expect(FTS_MAX_PAGE_SIZE + 1).toBeLessThanOrEqual(100);
	});

	it("binds both value bounds as null when the query has no comparison", async () => {
		let pageValues: unknown[] = [];
		let countValues: unknown[] = [];
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				if (sql.includes("COUNT(*)")) {
					countValues = values;
					return Promise.resolve([{ total: 1 }]);
				}
				pageValues = values;
				return Promise.resolve([{ id: "p1" }]);
			},
		} as unknown as PrismaClient;

		await searchKeywordFallback(prisma, "Oak Street", 2025);

		// page query: match, year, min-null, min-null, max-null, max-null,
		//   bm25 weights (name, propertyAddress, city, description), limit, offset
		expect(pageValues).toEqual([
			'"oak" AND "street"',
			2025,
			null,
			null,
			null,
			null,
			10.0,
			8.0,
			4.0,
			1.0,
			FTS_MAX_PAGE_SIZE,
			0,
		]);
		// count query has the same WHERE bindings but no ORDER BY / LIMIT / OFFSET
		expect(countValues).toEqual([
			'"oak" AND "street"',
			2025,
			null,
			null,
			null,
			null,
		]);
	});

	it("weights name and address above description in the bm25 ordering", async () => {
		// Unweighted, "condominium" filled 18 of the top 20 with description-only
		// plat text. The weights must stay in FTS column-declaration order:
		// name, property_address, city, description.
		let pageValues: unknown[] = [];
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				if (!sql.includes("COUNT(*)")) pageValues = values;
				return Promise.resolve(
					sql.includes("COUNT(*)") ? [{ total: 1 }] : [{ id: "p1" }],
				);
			},
		} as unknown as PrismaClient;

		await searchKeywordFallback(prisma, "condominium", 2025);

		// Weights are positioned after the 6 WHERE bindings; limit+offset are the last 2.
		const weights = pageValues.slice(6, -2);
		expect(weights[0]).toBe(10.0); // name
		expect(weights[3]).toBe(1.0); // description
		expect(weights[0]).toBeGreaterThan(weights[3] as number);
	});

	it("pushes the parsed bound into the FTS query so it narrows before LIMIT", async () => {
		let pageValues: unknown[] = [];
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				if (!sql.includes("COUNT(*)")) pageValues = values;
				return Promise.resolve(
					sql.includes("COUNT(*)") ? [{ total: 1 }] : [{ id: "p1" }],
				);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(
			prisma,
			"properties in Austin worth over 500k",
			2025,
		);

		// Stopwords and the comparison phrase are gone; only "austin" matches.
		expect(pageValues[0]).toBe('"austin"');
		expect(pageValues).toContain(500_000);
		expect(result.explanation).toContain("appraised over $500,000");
	});

	it("filters on value alone when the query has a bound but no search term", async () => {
		const prisma = {
			$queryRaw: () => {
				throw new Error("FTS should not be queried without search terms");
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(
			prisma,
			"all properties over 500k",
			2025,
		);

		expect(result.whereClause).toEqual({ appraisedValue: { gt: 500_000 } });
	});

	it("requires all tokens first, and says so", async () => {
		const matches: string[] = [];
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				if (!sql.includes("COUNT(*)")) matches.push(values[0] as string);
				return Promise.resolve(
					sql.includes("COUNT(*)") ? [{ total: 1 }] : [{ id: "p1" }],
				);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(prisma, "Oak Street", 2025);

		expect(matches).toEqual(['"oak" AND "street"']);
		expect(result.explanation).toContain("matching all terms");
	});

	it("relaxes to OR when requiring all tokens matches nothing", async () => {
		// "zilker park trust" is plausible but matches 0 rows as AND and 55,535
		// as OR — returning nothing would be worse than relaxing.
		const pageMatches: string[] = [];
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				const match = values[0] as string;
				if (sql.includes("COUNT(*)")) {
					// AND query has 0 total; OR query has results
					const total = match.includes("AND") ? 0 : 1;
					return Promise.resolve([{ total }]);
				}
				pageMatches.push(match);
				return Promise.resolve(match.includes("AND") ? [] : [{ id: "p9" }]);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(
			prisma,
			"zilker park trust",
			2025,
		);

		expect(pageMatches).toEqual([
			'"zilker" AND "park" AND "trust"',
			'"zilker" OR "park" OR "trust"',
		]);
		expect(result.whereClause).toEqual({ id: { in: ["p9"] } });
		expect(result.explanation).toContain("matching any term");
		expect(result.precomputedTotal).toBe(1);
	});

	it("does not spend a second query relaxing a single token", async () => {
		// AND and OR are identical for one token, so an empty result is final.
		const pageMatches: string[] = [];
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				if (!sql.includes("COUNT(*)")) pageMatches.push(values[0] as string);
				return Promise.resolve(
					sql.includes("COUNT(*)") ? [{ total: 0 }] : [],
				);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(prisma, "Pflugerville", 2025);

		expect(pageMatches).toEqual(['"pflugerville"']);
		expect(result.whereClause).toEqual({ id: { in: [] } });
		expect(result.precomputedTotal).toBe(0);
	});
});

describe("buildKeywordSearchFilters", () => {
	it("builds contains filters over the four free-text fields", () => {
		const result = buildKeywordSearchFilters("  Oak Street  ");
		expect(result.whereClause).toEqual({
			OR: [
				{ name: { contains: "Oak Street" } },
				{ propertyAddress: { contains: "Oak Street" } },
				{ city: { contains: "Oak Street" } },
				{ description: { contains: "Oak Street" } },
			],
		});
		expect(result.explanation).toContain('"Oak Street"');
	});
});
