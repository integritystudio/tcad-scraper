/**
 * Property data transformation utilities.
 * Transforms Prisma camelCase models to snake_case for API responses.
 * Ported from server/src/utils/property-transformers.ts — logger removed (Workers use console).
 */

import type { Property } from "@prisma/client";
import { epochToISO } from "./epoch-dates";

export interface SnakeCaseProperty {
	id: string;
	property_id: string;
	name: string;
	prop_type: string;
	city: string | null;
	property_address: string;
	assessed_value: number | null;
	appraised_value: number;
	geo_id: string | null;
	description: string | null;
	search_term: string | null;
	year: number;
	scraped_at: string;
	created_at: string;
	updated_at: string;
	// Full TCAD raw-field capture (migration 0003) — null for rows scraped
	// before the migration.
	p_version: number | null;
	p_roll_corr: number | null;
	p_account_id: number | null;
	latitude: number | null;
	longitude: number | null;
	as_code: string | null;
	block: string | null;
	tract: string | null;
	lot: string | null;
	mh_space_num: string | null;
	condo_unit: string | null;
	additional_legal: string | null;
	legal_acreage: number | null;
	auto_build_legal: number | null;
	simple_geo: string | null;
	ref_id1: string | null;
	ref_id2: string | null;
	mass_created_from: number | null;
	template_property: number | null;
	template_desc: string | null;
	dba: string | null;
	alt_dba: string | null;
	mortgage_co_id: string | null;
	mortgage_co_acct_id: string | null;
	effective_size_acres: number | null;
	map_id: string | null;
	mapsco: string | null;
	prop_reference: number | null;
	reference_desc: string | null;
	active: string | null;
	inactive: number | null;
	inactive_dt: string | null;
	prop_create_dt: string | null;
	appr_company_id: string | null;
	market_area: string | null;
	use_cd: string | null;
	zoning: string | null;
	sic_cd: string | null;
	land_value: number | null;
	improvement_value: number | null;
	land_homesite_pct: number | null;
	structure_homesite_pct: number | null;
	owner_id: number | null;
	owner_pct: number | null;
	owner_name: string | null;
	name_secondary: string | null;
	first_name: string | null;
	last_name: string | null;
	spouse_first_name: string | null;
	spouse_last_name: string | null;
	confidential_name: string | null;
	addr_delivery_line: string | null;
	addr_unit_designator: string | null;
	addr_city: string | null;
	addr_zip: string | null;
	addr_state: string | null;
	web_suppression: number | null;
	primary_situs: number | null;
	street_num: string | null;
	street_name: string | null;
	full_situs: string | null;
	street_prefix: string | null;
	street_suffix: string | null;
	street_secondary: string | null;
	state: string | null;
	zip: string | null;
	country: string | null;
	international: number | null;
	value_ready: number | null;
	tax_office_ref: string | null;
	confidential: number | null;
	arb_hearing: string | null;
	relative_score: number | null;
}

/** Epoch-ms string column to ISO 8601, preserving null. */
function epochToISOOrNull(epoch: string | null): string | null {
	return epoch === null ? null : epochToISO(epoch);
}

export function transformPropertyToSnakeCase(
	prop: Property,
): SnakeCaseProperty {
	return {
		id: prop.id,
		property_id: prop.propertyId,
		name: prop.name,
		prop_type: prop.propType,
		city: prop.city,
		property_address: prop.propertyAddress,
		assessed_value: prop.assessedValue,
		appraised_value: prop.appraisedValue,
		geo_id: prop.geoId,
		description: prop.description,
		search_term: prop.searchTerm,
		year: prop.year,
		scraped_at: epochToISO(prop.scrapedAt),
		created_at: epochToISO(prop.createdAt),
		updated_at: epochToISO(prop.updatedAt),
		p_version: prop.pVersion,
		p_roll_corr: prop.pRollCorr,
		p_account_id: prop.pAccountId,
		latitude: prop.latitude,
		longitude: prop.longitude,
		as_code: prop.asCode,
		block: prop.block,
		tract: prop.tract,
		lot: prop.lot,
		mh_space_num: prop.mhSpaceNum,
		condo_unit: prop.condoUnit,
		additional_legal: prop.additionalLegal,
		legal_acreage: prop.legalAcreage,
		auto_build_legal: prop.autoBuildLegal,
		simple_geo: prop.simpleGeo,
		ref_id1: prop.refId1,
		ref_id2: prop.refId2,
		mass_created_from: prop.massCreatedFrom,
		template_property: prop.templateProperty,
		template_desc: prop.templateDesc,
		dba: prop.dba,
		alt_dba: prop.altDba,
		mortgage_co_id: prop.mortgageCoId,
		mortgage_co_acct_id: prop.mortgageCoAcctId,
		effective_size_acres: prop.effectiveSizeAcres,
		map_id: prop.mapId,
		mapsco: prop.mapsco,
		prop_reference: prop.propReference,
		reference_desc: prop.referenceDesc,
		active: prop.active,
		inactive: prop.inactive,
		inactive_dt: epochToISOOrNull(prop.inactiveDt),
		prop_create_dt: epochToISOOrNull(prop.propCreateDt),
		appr_company_id: prop.apprCompanyId,
		market_area: prop.marketArea,
		use_cd: prop.useCd,
		zoning: prop.zoning,
		sic_cd: prop.sicCd,
		land_value: prop.landValue,
		improvement_value: prop.improvementValue,
		land_homesite_pct: prop.landHomesitePct,
		structure_homesite_pct: prop.structureHomesitePct,
		owner_id: prop.ownerId,
		owner_pct: prop.ownerPct,
		owner_name: prop.ownerName,
		name_secondary: prop.nameSecondary,
		first_name: prop.firstName,
		last_name: prop.lastName,
		spouse_first_name: prop.spouseFirstName,
		spouse_last_name: prop.spouseLastName,
		confidential_name: prop.confidentialName,
		addr_delivery_line: prop.addrDeliveryLine,
		addr_unit_designator: prop.addrUnitDesignator,
		addr_city: prop.addrCity,
		addr_zip: prop.addrZip,
		addr_state: prop.addrState,
		web_suppression: prop.webSuppression,
		primary_situs: prop.primarySitus,
		street_num: prop.streetNum,
		street_name: prop.streetName,
		full_situs: prop.fullSitus,
		street_prefix: prop.streetPrefix,
		street_suffix: prop.streetSuffix,
		street_secondary: prop.streetSecondary,
		state: prop.state,
		zip: prop.zip,
		country: prop.country,
		international: prop.international,
		value_ready: prop.valueReady,
		tax_office_ref: prop.taxOfficeRef,
		confidential: prop.confidential,
		arb_hearing: prop.arbHearing,
		relative_score: prop.relativeScore,
	};
}
