import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { D1_MAX_BOUND_PARAMS } from "../../utils/constants";
import {
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
	it("caps the FTS LIMIT inside D1's bound-parameter budget", async () => {
		// Incident 2026-08-08: a 1000-row LIMIT overflowed D1's 100-param cap
		// when the ids were folded into Prisma's `id IN (...)` clause.
		let boundValues: unknown[] = [];
		const prisma = {
			$queryRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
				boundValues = values;
				return Promise.resolve([{ id: "p1" }]);
			},
		} as unknown as PrismaClient;

		const filters = await searchKeywordFallback(prisma, "Oak Street", 2025);

		const limit = boundValues[boundValues.length - 1] as number;
		expect(limit).toBeLessThan(D1_MAX_BOUND_PARAMS);
		expect(filters.whereClause).toEqual({ id: { in: ["p1"] } });
	});

	it("binds both value bounds as null when the query has no comparison", async () => {
		let boundValues: unknown[] = [];
		const prisma = {
			$queryRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
				boundValues = values;
				return Promise.resolve([{ id: "p1" }]);
			},
		} as unknown as PrismaClient;

		await searchKeywordFallback(prisma, "Oak Street", 2025);

		// match, year, min, min, max, max, then the four bm25 column weights in
		// FTS declaration order, then LIMIT. Nulls make the bound checks no-ops.
		expect(boundValues).toEqual([
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
			90,
		]);
	});

	it("weights name and address above description in the bm25 ordering", async () => {
		// Unweighted, "condominium" filled 18 of the top 20 with description-only
		// plat text. The weights must stay in FTS column-declaration order:
		// name, property_address, city, description.
		let boundValues: unknown[] = [];
		const prisma = {
			$queryRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
				boundValues = values;
				return Promise.resolve([{ id: "p1" }]);
			},
		} as unknown as PrismaClient;

		await searchKeywordFallback(prisma, "condominium", 2025);

		const weights = boundValues.slice(-5, -1);
		expect(weights).toEqual([10.0, 8.0, 4.0, 1.0]);
		expect(weights[0]).toBeGreaterThan(weights[3] as number);
	});

	it("pushes the parsed bound into the FTS query so it narrows before LIMIT", async () => {
		let boundValues: unknown[] = [];
		const prisma = {
			$queryRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
				boundValues = values;
				return Promise.resolve([{ id: "p1" }]);
			},
		} as unknown as PrismaClient;

		const filters = await searchKeywordFallback(
			prisma,
			"properties in Austin worth over 500k",
			2025,
		);

		// Stopwords and the comparison phrase are gone; only "austin" matches.
		expect(boundValues[0]).toBe('"austin"');
		expect(boundValues).toContain(500_000);
		expect(filters.explanation).toContain("appraised over $500,000");
	});

	it("filters on value alone when the query has a bound but no search term", async () => {
		const prisma = {
			$queryRaw: () => {
				throw new Error("FTS should not be queried without search terms");
			},
		} as unknown as PrismaClient;

		const filters = await searchKeywordFallback(
			prisma,
			"all properties over 500k",
			2025,
		);

		expect(filters.whereClause).toEqual({ appraisedValue: { gt: 500_000 } });
	});

	it("requires all tokens first, and says so", async () => {
		// "oak street" matches 14 rows as AND vs 12,153 as OR on production D1,
		// so an OR-only set fills its 90 slots with single-token hits.
		const matches: string[] = [];
		const prisma = {
			$queryRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
				matches.push(values[0] as string);
				return Promise.resolve([{ id: "p1" }]);
			},
		} as unknown as PrismaClient;

		const filters = await searchKeywordFallback(prisma, "Oak Street", 2025);

		expect(matches).toEqual(['"oak" AND "street"']);
		expect(filters.explanation).toContain("matching all terms");
	});

	it("relaxes to OR when requiring all tokens matches nothing", async () => {
		// "zilker park trust" is plausible but matches 0 rows as AND and 55,535
		// as OR — returning nothing would be worse than relaxing.
		const matches: string[] = [];
		const prisma = {
			$queryRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
				matches.push(values[0] as string);
				return Promise.resolve(matches.length === 1 ? [] : [{ id: "p9" }]);
			},
		} as unknown as PrismaClient;

		const filters = await searchKeywordFallback(
			prisma,
			"zilker park trust",
			2025,
		);

		expect(matches).toEqual([
			'"zilker" AND "park" AND "trust"',
			'"zilker" OR "park" OR "trust"',
		]);
		expect(filters.whereClause).toEqual({ id: { in: ["p9"] } });
		expect(filters.explanation).toContain("matching any term");
	});

	it("does not spend a second query relaxing a single token", async () => {
		// AND and OR are identical for one token, so an empty result is final.
		const matches: string[] = [];
		const prisma = {
			$queryRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
				matches.push(values[0] as string);
				return Promise.resolve([]);
			},
		} as unknown as PrismaClient;

		const filters = await searchKeywordFallback(prisma, "Pflugerville", 2025);

		expect(matches).toEqual(['"pflugerville"']);
		expect(filters.whereClause).toEqual({ id: { in: [] } });
	});
});

describe("buildKeywordSearchFilters", () => {
	it("builds contains filters over the four free-text fields", () => {
		const filters = buildKeywordSearchFilters("  Oak Street  ");
		expect(filters.whereClause).toEqual({
			OR: [
				{ name: { contains: "Oak Street" } },
				{ propertyAddress: { contains: "Oak Street" } },
				{ city: { contains: "Oak Street" } },
				{ description: { contains: "Oak Street" } },
			],
		});
		expect(filters.explanation).toContain('"Oak Street"');
	});
});
