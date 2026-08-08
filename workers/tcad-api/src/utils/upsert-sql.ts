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

/**
 * Snake-case column ↔ PropertyData key for the full TCAD capture set
 * (migration 0003). One entry per column keeps the INSERT list, the
 * ON CONFLICT update list, and param binding in lockstep.
 */
const TCAD_CAPTURE_COLUMNS = [
	["p_version", "pVersion"],
	["p_roll_corr", "pRollCorr"],
	["p_account_id", "pAccountId"],
	["latitude", "latitude"],
	["longitude", "longitude"],
	["as_code", "asCode"],
	["block", "block"],
	["tract", "tract"],
	["lot", "lot"],
	["mh_space_num", "mhSpaceNum"],
	["condo_unit", "condoUnit"],
	["additional_legal", "additionalLegal"],
	["legal_acreage", "legalAcreage"],
	["auto_build_legal", "autoBuildLegal"],
	["simple_geo", "simpleGeo"],
	["ref_id1", "refId1"],
	["ref_id2", "refId2"],
	["mass_created_from", "massCreatedFrom"],
	["template_property", "templateProperty"],
	["template_desc", "templateDesc"],
	["dba", "dba"],
	["alt_dba", "altDba"],
	["mortgage_co_id", "mortgageCoId"],
	["mortgage_co_acct_id", "mortgageCoAcctId"],
	["effective_size_acres", "effectiveSizeAcres"],
	["map_id", "mapId"],
	["mapsco", "mapsco"],
	["prop_reference", "propReference"],
	["reference_desc", "referenceDesc"],
	["active", "active"],
	["inactive", "inactive"],
	["inactive_dt", "inactiveDt"],
	["prop_create_dt", "propCreateDt"],
	["appr_company_id", "apprCompanyId"],
	["market_area", "marketArea"],
	["use_cd", "useCd"],
	["zoning", "zoning"],
	["sic_cd", "sicCd"],
	["land_value", "landValue"],
	["improvement_value", "improvementValue"],
	["land_homesite_pct", "landHomesitePct"],
	["structure_homesite_pct", "structureHomesitePct"],
	["owner_id", "ownerId"],
	["owner_pct", "ownerPct"],
	["owner_name", "ownerName"],
	["name_secondary", "nameSecondary"],
	["first_name", "firstName"],
	["last_name", "lastName"],
	["spouse_first_name", "spouseFirstName"],
	["spouse_last_name", "spouseLastName"],
	["confidential_name", "confidentialName"],
	["addr_delivery_line", "addrDeliveryLine"],
	["addr_unit_designator", "addrUnitDesignator"],
	["addr_city", "addrCity"],
	["addr_zip", "addrZip"],
	["addr_state", "addrState"],
	["web_suppression", "webSuppression"],
	["primary_situs", "primarySitus"],
	["street_num", "streetNum"],
	["street_name", "streetName"],
	["full_situs", "fullSitus"],
	["street_prefix", "streetPrefix"],
	["street_suffix", "streetSuffix"],
	["street_secondary", "streetSecondary"],
	["state", "state"],
	["zip", "zip"],
	["country", "country"],
	["international", "international"],
	["value_ready", "valueReady"],
	["tax_office_ref", "taxOfficeRef"],
	["confidential", "confidential"],
	["arb_hearing", "arbHearing"],
	["relative_score", "relativeScore"],
] as const satisfies ReadonlyArray<readonly [string, keyof PropertyData]>;

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
	...TCAD_CAPTURE_COLUMNS.map(([col]) => col),
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
	...TCAD_CAPTURE_COLUMNS.map(([col]) => col),
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
		// `?? null`: pages written to KV by a pre-0003 deploy lack these keys,
		// and D1 rejects `undefined` bindings.
		...TCAD_CAPTURE_COLUMNS.map(([, key]) => prop[key] ?? null),
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
			.join(
				", ",
			)} ON CONFLICT(property_id, year) DO UPDATE SET ${UPDATE_CLAUSE}`;
		statements.push({
			sql,
			params: rows.flatMap((p) => rowParams(p, searchTerm, year, now, newId)),
		});
	}
	return statements;
}
