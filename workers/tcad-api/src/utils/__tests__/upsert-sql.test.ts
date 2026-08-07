/**
 * Contract for buildUpsertStatements: every input row lands in a statement
 * in order, each row binds a generated id (the column has no SQL default),
 * no statement exceeds D1's 100-bound-parameter limit, and the ON CONFLICT
 * update path refreshes scrape data without touching the row's identity or
 * the write-once created_at/updated_at columns.
 */

import { describe, expect, it } from "vitest";
import type { PropertyData } from "../../types/property.types";
import { buildUpsertStatements } from "../upsert-sql";

const NOW = "1786058000000";
const YEAR = 2025;
const TERM = "Ridge";
const COLUMNS_PER_ROW = 15;

function sequentialIds(): () => string {
	let n = 0;
	return () => `uuid-${++n}`;
}

function property(overrides: Partial<PropertyData> = {}): PropertyData {
	return {
		propertyId: "111295",
		name: "LIMESTONE CREEK PROPERTIES L P",
		propType: "R",
		city: "AUSTIN",
		propertyAddress: "1114 LOST CREEK BLVD",
		assessedValue: 9293415,
		appraisedValue: 9293415,
		geoId: "0111230502",
		description: "LOT A LOST CREEK POINT NO 2",
		...overrides,
	};
}

function properties(count: number): PropertyData[] {
	return Array.from({ length: count }, (_, i) =>
		property({ propertyId: String(i + 1) }),
	);
}

function countPlaceholders(sql: string): number {
	return (sql.match(/\?/g) ?? []).length;
}

describe("buildUpsertStatements", () => {
	it("returns no statements for an empty batch", () => {
		expect(buildUpsertStatements([], TERM, YEAR, NOW)).toEqual([]);
	});

	it("binds one row's values in insert-column order, id first", () => {
		const [stmt] = buildUpsertStatements(
			[property()],
			TERM,
			YEAR,
			NOW,
			sequentialIds(),
		);

		expect(stmt.params).toEqual([
			"uuid-1",
			"111295",
			"LIMESTONE CREEK PROPERTIES L P",
			"R",
			"AUSTIN",
			"1114 LOST CREEK BLVD",
			9293415,
			9293415,
			"0111230502",
			"LOT A LOST CREEK POINT NO 2",
			TERM,
			YEAR,
			NOW,
			NOW,
			NOW,
		]);
	});

	it("generates a distinct id for every row by default", () => {
		const statements = buildUpsertStatements(properties(8), TERM, YEAR, NOW);
		const ids = statements.flatMap((s) =>
			s.params.filter((_, i) => i % COLUMNS_PER_ROW === 0),
		);

		expect(new Set(ids).size).toBe(8);
		for (const id of ids) {
			expect(id).toMatch(/^[0-9a-f-]{36}$/);
		}
	});

	it("passes nullable fields through as null", () => {
		const [stmt] = buildUpsertStatements(
			[property({ city: null, assessedValue: null, geoId: null, description: null })],
			TERM,
			YEAR,
			NOW,
		);

		expect(stmt.params[4]).toBeNull(); // city
		expect(stmt.params[6]).toBeNull(); // assessed_value
		expect(stmt.params[8]).toBeNull(); // geo_id
		expect(stmt.params[9]).toBeNull(); // description
	});

	it("matches placeholder count to bound params in every statement", () => {
		for (const stmt of buildUpsertStatements(properties(15), TERM, YEAR, NOW)) {
			expect(countPlaceholders(stmt.sql)).toBe(stmt.params.length);
		}
	});

	it("splits 15 rows into micro-chunks of 6, 6, and 3", () => {
		const statements = buildUpsertStatements(properties(15), TERM, YEAR, NOW);

		expect(statements.map((s) => s.params.length / COLUMNS_PER_ROW)).toEqual([
			6, 6, 3,
		]);
	});

	it("keeps every statement within D1's 100-bound-parameter limit", () => {
		for (const stmt of buildUpsertStatements(properties(50), TERM, YEAR, NOW)) {
			expect(stmt.params.length).toBeLessThanOrEqual(100);
		}
	});

	it("covers all property ids in input order across statements", () => {
		const statements = buildUpsertStatements(properties(15), TERM, YEAR, NOW);
		const boundIds = statements.flatMap((s) =>
			s.params.filter((_, i) => i % COLUMNS_PER_ROW === 1),
		);

		expect(boundIds).toEqual(properties(15).map((p) => p.propertyId));
	});

	it("upserts on the (property_id, year) key", () => {
		const [stmt] = buildUpsertStatements([property()], TERM, YEAR, NOW);

		expect(stmt.sql).toContain("INSERT INTO properties");
		expect(stmt.sql).toContain("ON CONFLICT(property_id, year) DO UPDATE SET");
	});

	it("refreshes scrape columns but never id, created_at, or updated_at on conflict", () => {
		const [stmt] = buildUpsertStatements([property()], TERM, YEAR, NOW);
		const updateClause = stmt.sql.split("DO UPDATE SET")[1];

		expect(updateClause).toContain("scraped_at = excluded.scraped_at");
		expect(updateClause).toContain("search_term = excluded.search_term");
		expect(updateClause).not.toContain("id = excluded.id");
		expect(updateClause).not.toContain("created_at");
		expect(updateClause).not.toContain("updated_at");
	});
});
