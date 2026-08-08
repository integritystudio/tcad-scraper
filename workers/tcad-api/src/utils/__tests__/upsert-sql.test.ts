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
const COLUMNS_PER_ROW = 88;
const TCAD_CAPTURE_COLUMN_COUNT = 73;

function sequentialIds(): () => string {
	let n = 0;
	return () => `uuid-${++n}`;
}

// All-null defaults for the full TCAD capture set (migration 0003) — the
// upsert contract only cares that they bind in column order.
const NULL_CAPTURE_FIELDS = {
	pVersion: null,
	pRollCorr: null,
	pAccountId: null,
	latitude: null,
	longitude: null,
	asCode: null,
	block: null,
	tract: null,
	lot: null,
	mhSpaceNum: null,
	condoUnit: null,
	additionalLegal: null,
	legalAcreage: null,
	autoBuildLegal: null,
	simpleGeo: null,
	refId1: null,
	refId2: null,
	massCreatedFrom: null,
	templateProperty: null,
	templateDesc: null,
	dba: null,
	altDba: null,
	mortgageCoId: null,
	mortgageCoAcctId: null,
	effectiveSizeAcres: null,
	mapId: null,
	mapsco: null,
	propReference: null,
	referenceDesc: null,
	active: null,
	inactive: null,
	inactiveDt: null,
	propCreateDt: null,
	apprCompanyId: null,
	marketArea: null,
	useCd: null,
	zoning: null,
	sicCd: null,
	landValue: null,
	improvementValue: null,
	landHomesitePct: null,
	structureHomesitePct: null,
	ownerId: null,
	ownerPct: null,
	ownerName: null,
	nameSecondary: null,
	firstName: null,
	lastName: null,
	spouseFirstName: null,
	spouseLastName: null,
	confidentialName: null,
	addrDeliveryLine: null,
	addrUnitDesignator: null,
	addrCity: null,
	addrZip: null,
	addrState: null,
	webSuppression: null,
	primarySitus: null,
	streetNum: null,
	streetName: null,
	fullSitus: null,
	streetPrefix: null,
	streetSuffix: null,
	streetSecondary: null,
	state: null,
	zip: null,
	country: null,
	international: null,
	valueReady: null,
	taxOfficeRef: null,
	confidential: null,
	arbHearing: null,
	relativeScore: null,
} satisfies Partial<PropertyData>;

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
		...NULL_CAPTURE_FIELDS,
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
			...Array(TCAD_CAPTURE_COLUMN_COUNT).fill(null),
		]);
	});

	it("binds capture fields in column order after the base columns", () => {
		const [stmt] = buildUpsertStatements(
			[property({ dba: "FRANKLIN BARBECUE", latitude: 30.27, zip: "78702" })],
			TERM,
			YEAR,
			NOW,
			sequentialIds(),
		);
		const insertList = stmt.sql.slice(0, stmt.sql.indexOf(") VALUES"));

		expect(stmt.params[insertList.split(",").findIndex((c) => c.includes("dba"))]).toBe(
			"FRANKLIN BARBECUE",
		);
		expect(
			stmt.params[insertList.split(",").findIndex((c) => c.includes("latitude"))],
		).toBe(30.27);
		expect(
			stmt.params[insertList.split(",").findIndex((c) => c.trim() === "zip")],
		).toBe("78702");
	});

	it("binds null for capture fields missing from pre-0003 KV pages", () => {
		const legacyShape = {
			propertyId: "111295",
			name: "LIMESTONE CREEK PROPERTIES L P",
			propType: "R",
			city: "AUSTIN",
			propertyAddress: "1114 LOST CREEK BLVD",
			assessedValue: 9293415,
			appraisedValue: 9293415,
			geoId: "0111230502",
			description: "LOT A LOST CREEK POINT NO 2",
		} as PropertyData;
		const [stmt] = buildUpsertStatements([legacyShape], TERM, YEAR, NOW);

		expect(stmt.params).toHaveLength(COLUMNS_PER_ROW);
		expect(stmt.params.slice(-TCAD_CAPTURE_COLUMN_COUNT)).toEqual(
			Array(TCAD_CAPTURE_COLUMN_COUNT).fill(null),
		);
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

	it("splits rows into single-row micro-chunks (88 cols leaves room for 1 row)", () => {
		const statements = buildUpsertStatements(properties(15), TERM, YEAR, NOW);

		expect(statements.map((s) => s.params.length / COLUMNS_PER_ROW)).toEqual(
			Array(15).fill(1),
		);
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
