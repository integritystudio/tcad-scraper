import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
	CITY_MATCH_MIN_ROWS,
	FTS_MAX_PAGE_SIZE,
	FTS_OR_RELAX_MAX_MATCHES,
} from "../../utils/constants";
import {
	buildFtsMatchQuery,
	buildKeywordSearchFilters,
	extractSortIntent,
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

		const result = await searchKeywordFallback(
			prisma,
			"Oak Street",
			2025,
			50,
			100,
		);

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
		//   bm25 weights (name, propertyAddress, city, description,
		//                 ownerName, nameSecondary, dba), limit, offset
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
			9.0,
			9.0,
			9.0,
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
		// Column order: name, property_address, city, description, owner_name, name_secondary, dba
		const weights = pageValues.slice(6, -2);
		expect(weights[0]).toBe(10.0); // name (primary owner, highest)
		expect(weights[3]).toBe(1.0); // description (lowest)
		expect(weights[4]).toBe(9.0); // owner_name (secondary owner identity)
		expect(weights[5]).toBe(9.0); // name_secondary (co-owner)
		expect(weights[6]).toBe(9.0); // dba
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
		expect(result.explanation).toContain("owner names, DBA");
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

		// Only the OR expression is ever ranked: the AND count came back 0, and
		// ranking a match set already known to be empty is a wasted D1 query.
		expect(pageMatches).toEqual(['"zilker" OR "park" OR "trust"']);
		expect(result.whereClause).toEqual({ id: { in: ["p9"] } });
		expect(result.explanation).toContain("matching any term");
		expect(result.precomputedTotal).toBe(1);
	});

	it("still relaxes to a plain OR match when the OR set is at the safety bound", async () => {
		// The bound is inclusive: a set exactly at FTS_OR_RELAX_MAX_MATCHES is
		// still safe to rank in one query, with no per-token probing needed.
		const rankedMatches: string[] = [];
		const totals: Record<string, number> = {
			'"foo" AND "bar"': 0,
			'"foo" OR "bar"': FTS_OR_RELAX_MAX_MATCHES,
		};
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				const match = values[0] as string;
				const isCount = sql.includes("COUNT(*)");
				if (!isCount) rankedMatches.push(match);
				if (isCount) return Promise.resolve([{ total: totals[match] ?? 0 }]);
				return Promise.resolve(
					match === '"foo" OR "bar"' ? [{ id: "p-or" }] : [],
				);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(prisma, "foo bar", 2025);

		expect(result.whereClause).toEqual({ id: { in: ["p-or"] } });
		expect(result.precomputedTotal).toBe(FTS_OR_RELAX_MAX_MATCHES);
		expect(result.explanation).toContain("matching any term");
		// Ranked exactly the AND attempt and the full OR set — no per-token
		// counts were needed because the full set was already within budget.
		// The AND count is 0, so it is never ranked — only the OR expression is.
		expect(rankedMatches).toEqual(['"foo" OR "bar"']);
	});

	it("reports an over-threshold OR set as too broad instead of ranking a token subset", async () => {
		// Keeping the rarest tokens was tried and reverted: in this corpus the
		// frequent tokens carry the meaning, so it kept the noise and dropped the
		// intent. It must now refuse outright, and must not spend a COUNT per
		// token to decide (the count for "austin" alone measured 10.6s).
		const rankedMatches: string[] = [];
		const countedMatches: string[] = [];
		const totals: Record<string, number> = {
			'"common" AND "rare"': 0,
			'"common" OR "rare"': 172_464, // the measured production failure
		};
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				const match = values[0] as string;
				if (sql.includes("COUNT(*)")) {
					countedMatches.push(match);
					return Promise.resolve([{ total: totals[match] ?? 0 }]);
				}
				rankedMatches.push(match);
				return Promise.resolve([]);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(prisma, "common rare", 2025);

		expect(result.whereClause).toEqual({ id: { in: [] } });
		expect(result.precomputedTotal).toBe(0);
		expect(result.explanation).toContain("172,464");
		// Nothing ranked, and only the two combined expressions counted — no
		// per-token probing.
		expect(rankedMatches).toEqual([]);
		expect(countedMatches).toEqual([
			'"common" AND "rare"',
			'"common" OR "rare"',
		]);
	});

	it("returns an explicit empty result instead of a slow scan when every token individually exceeds the bound", async () => {
		// Mirrors "austin"/"tx" in the real corpus: every candidate token is
		// too broad on its own, so there is nothing left that is both safe to
		// rank and worth returning. Must not fall through to the ~40s LIKE
		// `contains` scan in the outer catch.
		const rankedMatches: string[] = [];
		const totals: Record<string, number> = {
			'"huge" AND "massive"': 0,
			'"huge" OR "massive"': 999_999,
			'"huge"': 600_000,
			'"massive"': 700_000,
		};
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				const match = values[0] as string;
				const isCount = sql.includes("COUNT(*)");
				if (!isCount) rankedMatches.push(match);
				return Promise.resolve(isCount ? [{ total: totals[match] ?? 0 }] : []);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(prisma, "huge massive", 2025);

		expect(result.whereClause).toEqual({ id: { in: [] } });
		expect(result.precomputedTotal).toBe(0);
		expect(result.explanation).toContain("matched too many properties to rank");
		expect(result.explanation).toContain("999,999");
		expect(result.explanation).toContain(
			FTS_OR_RELAX_MAX_MATCHES.toLocaleString(),
		);
		// Nothing was ever ranked: the AND count came back 0 so it was not
		// ranked, and every OR candidate proved too broad on its own.
		expect(rankedMatches).toEqual([]);
	});

	it("does not spend a second query relaxing a single token", async () => {
		// AND and OR are identical for one token, so an empty result is final.
		const pageMatches: string[] = [];
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				if (!sql.includes("COUNT(*)")) pageMatches.push(values[0] as string);
				return Promise.resolve(sql.includes("COUNT(*)") ? [{ total: 0 }] : []);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(prisma, "Pflugerville", 2025);

		// Counted, found empty, and never ranked — one query, not two.
		expect(pageMatches).toEqual([]);
		expect(result.whereClause).toEqual({ id: { in: [] } });
		expect(result.precomputedTotal).toBe(0);
	});
});

describe("buildKeywordSearchFilters", () => {
	it("tokenizes the query and ANDs per-token OR clauses across all seven text columns", () => {
		const result = buildKeywordSearchFilters("  Oak Street  ");
		const colsFor = (t: string) => ({
			OR: [
				{ name: { contains: t } },
				{ propertyAddress: { contains: t } },
				{ city: { contains: t } },
				{ description: { contains: t } },
				{ ownerName: { contains: t } },
				{ nameSecondary: { contains: t } },
				{ dba: { contains: t } },
			],
		});
		expect(result.whereClause).toEqual({
			AND: [colsFor("oak"), colsFor("street")],
		});
		// Explanation cites the original (un-lowercased) query.
		expect(result.explanation).toContain('"Oak Street"');
	});

	it("produces a single OR clause (no AND wrapper) for a one-token query", () => {
		const result = buildKeywordSearchFilters("Austin");
		expect(result.whereClause).toEqual({
			OR: [
				{ name: { contains: "austin" } },
				{ propertyAddress: { contains: "austin" } },
				{ city: { contains: "austin" } },
				{ description: { contains: "austin" } },
				{ ownerName: { contains: "austin" } },
				{ nameSecondary: { contains: "austin" } },
				{ dba: { contains: "austin" } },
			],
		});
	});
});

describe("extractSortIntent", () => {
	it.each([
		["ten most valuable properties in Austin", "desc"],
		["most expensive properties", "desc"],
		["highest appraised properties in Manor", "desc"],
		["priciest homes", "desc"],
		["cheapest properties in Austin", "asc"],
		["least valuable properties", "asc"],
		["lowest valued properties", "asc"],
	])("reads the ordering out of %s", (query, direction) => {
		expect(extractSortIntent(query)?.direction).toBe(direction);
	});

	it("reads no ordering from a plain text search", () => {
		expect(extractSortIntent("oak street trust")).toBeNull();
	});

	it("does not read size superlatives as value orderings", () => {
		// "largest" is ambiguous between appraised value and acreage, so it is
		// deliberately left to the text path rather than guessed at.
		expect(extractSortIntent("largest properties in Austin")).toBeNull();
	});
});

describe("searchKeywordFallback — superlative queries", () => {
	/**
	 * Counts keyed by the exact `city` equality the resolver tries. Mirrors
	 * production for year 2025: AUSTIN dominates, and "TX" exists as a literal
	 * 25-row artifact that must not be mistaken for the city.
	 */
	function cityPrisma(
		counts: Record<string, number>,
		ftsCalls: string[] = [],
	): PrismaClient {
		return {
			property: {
				count: ({ where }: { where: { city: string } }) =>
					Promise.resolve(counts[where.city] ?? 0),
			},
			$queryRaw: (_s: TemplateStringsArray, ...values: unknown[]) => {
				ftsCalls.push(values[0] as string);
				return Promise.resolve([]);
			},
		} as unknown as PrismaClient;
	}

	it("answers the reported query with a city equality and an ordering, running no FTS at all", async () => {
		// The production failure: this query drove the OR relaxation to 172,464
		// rows, blew D1's CPU limit, then fell to a ~40s LIKE scan returning 0.
		// It is not a text search — it is an ordering over an indexed column.
		const ftsCalls: string[] = [];
		const prisma = cityPrisma(
			{ AUSTIN: 157_677, TX: 25, "AUSTIN TX": 0 },
			ftsCalls,
		);

		const result = await searchKeywordFallback(
			prisma,
			"ten most valuable properties in Austin, TX",
			2025,
		);

		expect(result.whereClause).toEqual({ city: "AUSTIN" });
		expect(result.orderBy).toEqual({ appraisedValue: "desc" });
		expect(result.precomputedTotal).toBeUndefined();
		expect(result.explanation).toContain("AUSTIN");
		// The whole point: no bm25 query is issued, so no ranked noise exists.
		expect(ftsCalls).toEqual([]);
	});

	it("prefers the highest-count city candidate over a low-count artifact", async () => {
		// "TX" is a real 25-row city value. Picking it would silently answer a
		// different question over 25 unrelated rows.
		const prisma = cityPrisma({ AUSTIN: 157_677, TX: 25, "AUSTIN TX": 0 });
		const result = await searchKeywordFallback(
			prisma,
			"most valuable in Austin TX",
			2025,
		);
		expect(result.whereClause).toEqual({ city: "AUSTIN" });
	});

	it("resolves a two-word city that no single token could match", async () => {
		const prisma = cityPrisma({ DEL: 0, VALLE: 0, "DEL VALLE": 3_516 });
		const result = await searchKeywordFallback(
			prisma,
			"most valuable properties in Del Valle",
			2025,
		);
		expect(result.whereClause).toEqual({ city: "DEL VALLE" });
	});

	it("orders the whole roll year when the superlative has no subject", async () => {
		const ftsCalls: string[] = [];
		const prisma = cityPrisma({}, ftsCalls);
		const result = await searchKeywordFallback(
			prisma,
			"the ten most valuable properties",
			2025,
		);
		expect(result.whereClause).toEqual({});
		expect(result.orderBy).toEqual({ appraisedValue: "desc" });
		expect(ftsCalls).toEqual([]);
	});

	it("carries a value bound alongside the city and the ordering", async () => {
		const prisma = cityPrisma({ AUSTIN: 157_677 });
		const result = await searchKeywordFallback(
			prisma,
			"most valuable properties in Austin over 500k",
			2025,
		);
		expect(result.whereClause).toEqual({
			AND: [{ city: "AUSTIN" }, { appraisedValue: { gt: 500_000 } }],
		});
		expect(result.orderBy).toEqual({ appraisedValue: "desc" });
	});

	it("reports the query unsupported rather than ranking a non-city subject", async () => {
		// Ordering one 98-row FTS page by value would report "most valuable"
		// over an arbitrary slice of the matches, which is a different answer.
		const ftsCalls: string[] = [];
		const prisma = cityPrisma({}, ftsCalls);
		const result = await searchKeywordFallback(
			prisma,
			"most valuable properties on Congress Ave",
			2025,
		);
		expect(result.whereClause).toEqual({ id: { in: [] } });
		expect(result.precomputedTotal).toBe(0);
		expect(result.explanation).toContain("does not name a city");
		expect(ftsCalls).toEqual([]);
	});

	it("maps an ascending superlative to ascending appraised value", async () => {
		const prisma = cityPrisma({ AUSTIN: 157_677 });
		const result = await searchKeywordFallback(
			prisma,
			"cheapest properties in Austin",
			2025,
		);
		expect(result.orderBy).toEqual({ appraisedValue: "asc" });
		expect(result.explanation).toContain("least valuable first");
	});
});

describe("searchKeywordFallback — AND-path breadth guard", () => {
	it("refuses to rank a single broad token instead of tripping D1's CPU limit", async () => {
		// "properties in Austin" reduces to the one token `"austin"`, which is
		// its own AND expression at 171,187 rows. The OR guard never sees it,
		// so the AND path has to count first too.
		const ranked: string[] = [];
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				if (sql.includes("COUNT(*)"))
					return Promise.resolve([{ total: 171_187 }]);
				ranked.push(values[0] as string);
				return Promise.resolve([]);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(
			prisma,
			"properties in Austin",
			2025,
		);

		expect(ranked).toEqual([]);
		expect(result.whereClause).toEqual({ id: { in: [] } });
		expect(result.precomputedTotal).toBe(0);
		expect(result.explanation).toContain("171,187");
	});
});

describe("searchKeywordFallback — regression guards", () => {
	// The AND guard is `andTotal > FTS_OR_RELAX_MAX_MATCHES`. The over-bound
	// case is covered above; without this, flipping that to `>=` would refuse a
	// set that is exactly rankable and no test would notice.
	it("still ranks an AND match sitting exactly on the safety bound", async () => {
		const ranked: string[] = [];
		const prisma = {
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				if (sql.includes("COUNT(*)")) {
					return Promise.resolve([{ total: FTS_OR_RELAX_MAX_MATCHES }]);
				}
				ranked.push(values[0] as string);
				return Promise.resolve([{ id: "p1" }]);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(prisma, "oak street", 2025);

		expect(ranked).toEqual(['"oak" AND "street"']);
		expect(result.whereClause).toEqual({ id: { in: ["p1"] } });
		expect(result.precomputedTotal).toBe(FTS_OR_RELAX_MAX_MATCHES);
	});

	// Regression for the production incident. The city-resolves case is covered
	// above; this is the variant where the subject resolves to no city, so the
	// structured path cannot answer it either. It must still refuse rather than
	// fall through to ranking the 172,464-row OR set that reset the connection.
	it("refuses the query that tripped D1's CPU limit, without ranking, when no city resolves", async () => {
		const ranked: string[] = [];
		const prisma = {
			property: { count: () => Promise.resolve(0) },
			$queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
				const sql = Array.from(strings).join("?");
				if (sql.includes("COUNT(*)"))
					return Promise.resolve([{ total: 172_464 }]);
				ranked.push(values[0] as string);
				return Promise.resolve([]);
			},
		} as unknown as PrismaClient;

		const result = await searchKeywordFallback(
			prisma,
			"ten most valuable properties in Austin, TX",
			2025,
		);

		expect(ranked).toEqual([]);
		expect(result.whereClause).toEqual({ id: { in: [] } });
		expect(result.precomputedTotal).toBe(0);
		expect(result.explanation).toContain("does not name a city");
	});
});

describe("resolveCityFilter — CITY_MATCH_MIN_ROWS floor", () => {
	const cityPrisma = (rows: number) =>
		({
			property: { count: () => Promise.resolve(rows) },
			$queryRaw: () => Promise.resolve([]),
		}) as unknown as PrismaClient;

	// The floor exists to reject the literal 25-row city "TX" and the tail of
	// single-row typos. The highest-count-wins test above cannot exercise it,
	// because AUSTIN outranks TX on count whether or not the floor is applied —
	// deleting the floor entirely would leave that test green.
	it("rejects a sole city candidate that sits below the floor", async () => {
		const result = await searchKeywordFallback(
			cityPrisma(CITY_MATCH_MIN_ROWS - 1),
			"most valuable properties in Tx",
			2025,
		);

		expect(result.whereClause).toEqual({ id: { in: [] } });
		expect(result.precomputedTotal).toBe(0);
		expect(result.explanation).toContain("does not name a city");
	});

	it("accepts a city candidate sitting exactly on the floor", async () => {
		const result = await searchKeywordFallback(
			cityPrisma(CITY_MATCH_MIN_ROWS),
			"most valuable properties in Manor",
			2025,
		);

		expect(result.whereClause).toEqual({ city: "MANOR" });
		expect(result.orderBy).toEqual({ appraisedValue: "desc" });
	});
});

describe("buildKeywordSearchFilters — regression guards", () => {
	/** Every distinct value handed to a `contains` filter, at any depth. */
	const containsValues = (clause: unknown): string[] => {
		const out: string[] = [];
		const walk = (node: unknown) => {
			if (Array.isArray(node)) return node.forEach(walk);
			if (node && typeof node === "object") {
				for (const [k, v] of Object.entries(node)) {
					if (k === "contains") out.push(v as string);
					else walk(v);
				}
			}
		};
		walk(clause);
		return [...new Set(out)];
	};

	// The original defect: the whole sentence became one LIKE '%...%' pattern,
	// which cannot match any row and guaranteed a full scan returning 0.
	it("never uses the whole query as a single contains pattern", async () => {
		const query = "ten most valuable properties in Austin, TX";
		const values = containsValues(buildKeywordSearchFilters(query).whereClause);

		expect(values).not.toContain(query);
		expect(values).toEqual(["austin", "tx"]);
	});

	// Stopword removal can empty the token set; the fallback must degrade to the
	// raw tokens, not back to the whole sentence.
	it("falls back to raw tokens when every token is a stopword", () => {
		const query = "show me all the properties";
		const values = containsValues(buildKeywordSearchFilters(query).whereClause);

		expect(values).not.toContain(query);
		expect(values).toEqual(["show", "me", "all", "the", "properties"]);
	});
});
