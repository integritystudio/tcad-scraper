/**
 * Shared property data transformation utilities.
 * Transforms Prisma camelCase models to snake_case for frontend API responses.
 */

import type { Property } from "@prisma/client";

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

export function transformPropertyToSnakeCase(prop: Property): SnakeCaseProperty {
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
