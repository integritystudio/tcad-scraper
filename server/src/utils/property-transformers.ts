/**
 * Shared property data transformation utilities.
 * Transforms Prisma camelCase models to snake_case for frontend API responses.
 *
 * NOTE: trace logging in transformPropertyToSnakeCase is called per property
 * (418K+ per full scrape). Only enable trace level for targeted debugging.
 */

import type { Property } from "@prisma/client";
import logger from "../lib/logger";

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
}

export function validateProperty(prop: Property): void {
	if (prop.year == null || !Number.isFinite(prop.year)) {
		throw new Error(
			`Invalid year value: ${prop.year} for property ${prop.propertyId}`,
		);
	}
	if (prop.appraisedValue == null || !Number.isFinite(prop.appraisedValue)) {
		throw new Error(
			`Invalid appraisedValue: ${prop.appraisedValue} for property ${prop.propertyId}`,
		);
	}
	if (prop.assessedValue != null && !Number.isFinite(prop.assessedValue)) {
		throw new Error(
			`Invalid assessedValue: ${prop.assessedValue} for property ${prop.propertyId}`,
		);
	}
}

export function transformPropertyToSnakeCase(
	prop: Property,
): SnakeCaseProperty {
	logger.trace({ propertyId: prop.propertyId }, "transformPropertyToSnakeCase");
	validateProperty(prop);
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
		scraped_at: prop.scrapedAt.toISOString(),
		created_at: prop.createdAt.toISOString(),
		updated_at: prop.updatedAt.toISOString(),
	};
}
