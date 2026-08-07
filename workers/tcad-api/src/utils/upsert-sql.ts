/**
 * Multi-row upsert SQL for the properties table, micro-chunked to stay
 * under D1's 100-bound-parameter-per-statement limit.
 *
 * Raw SQL is safe alongside Prisma here: every date column stores an
 * epoch-ms string, which D1's JS binding passes through untouched (only
 * ISO 8601 TEXT gets auto-converted to Date).
 */

import type { PropertyData } from "../types/property.types";
import { UPSERT_MICRO_CHUNK_SIZE } from "./constants";

export interface UpsertStatement {
	sql: string;
	params: (string | number | null)[];
}

const INSERT_COLUMNS = [
	// id has no SQL default (Prisma generates it client-side), so inserts
	// must bind one; the ON CONFLICT path leaves existing ids untouched.
	"id",
	"property_id",
	"name",
	"prop_type",
	"city",
	"property_address",
	"assessed_value",
	"appraised_value",
	"geo_id",
	"description",
	"search_term",
	"year",
	"scraped_at",
	"created_at",
	"updated_at",
] as const;

// Mirrors the previous Prisma upsert's update path: created_at and
// updated_at are write-once; everything else refreshes on re-scrape.
const UPDATE_COLUMNS = [
	"name",
	"prop_type",
	"city",
	"property_address",
	"assessed_value",
	"appraised_value",
	"geo_id",
	"description",
	"search_term",
	"scraped_at",
] as const;

const ROW_PLACEHOLDER = `(${INSERT_COLUMNS.map(() => "?").join(", ")})`;

const UPDATE_CLAUSE = UPDATE_COLUMNS.map(
	(col) => `${col} = excluded.${col}`,
).join(", ");

function rowParams(
	prop: PropertyData,
	searchTerm: string,
	year: number,
	now: string,
	newId: () => string,
): (string | number | null)[] {
	return [
		newId(),
		prop.propertyId,
		prop.name,
		prop.propType,
		prop.city,
		prop.propertyAddress,
		prop.assessedValue,
		prop.appraisedValue,
		prop.geoId,
		prop.description,
		searchTerm,
		year,
		now,
		now,
		now,
	];
}

export function buildUpsertStatements(
	properties: PropertyData[],
	searchTerm: string,
	year: number,
	now: string,
	newId: () => string = () => crypto.randomUUID(),
): UpsertStatement[] {
	const statements: UpsertStatement[] = [];
	for (let i = 0; i < properties.length; i += UPSERT_MICRO_CHUNK_SIZE) {
		const rows = properties.slice(i, i + UPSERT_MICRO_CHUNK_SIZE);
		const sql = `INSERT INTO properties (${INSERT_COLUMNS.join(", ")}) VALUES ${rows
			.map(() => ROW_PLACEHOLDER)
			.join(", ")} ON CONFLICT(property_id, year) DO UPDATE SET ${UPDATE_CLAUSE}`;
		statements.push({
			sql,
			params: rows.flatMap((p) => rowParams(p, searchTerm, year, now, newId)),
		});
	}
	return statements;
}
