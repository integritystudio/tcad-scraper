import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { D1_MAX_BOUND_PARAMS } from "../../utils/constants";
import {
	buildFtsMatchQuery,
	buildKeywordSearchFilters,
	searchKeywordFallback,
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
		expect(buildFtsMatchQuery("worth over $500k")).toBe(
			'"worth" OR "over" OR "500k"',
		);
	});

	it("returns empty string when no tokens survive", () => {
		expect(buildFtsMatchQuery("$%^&*")).toBe("");
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
