/**
 * Test Data Factories
 *
 * Lightweight builder functions for creating consistent test fixtures.
 * Provides sensible defaults with easy per-field overrides.
 * No external dependencies — uses simple counters and string templates.
 *
 * Usage:
 *   const prop = buildProperty({ city: "Austin" });
 *   const job  = buildScrapeJobData({ searchTerm: "Smith" });
 */

import type { PropertyData, ScrapeJobData, ScrapeJobResult } from "../types";

// Monotonic counter for unique IDs within a test run
let counter = 1;
function nextId(): number {
	return counter++;
}

/** Reset counter between test suites if isolation is needed */
export function resetFactoryCounter(): void {
	counter = 1;
}

// ---------------------------------------------------------------------------
// PropertyData factory
// ---------------------------------------------------------------------------

export function buildProperty(overrides: Partial<PropertyData> = {}): PropertyData {
	const n = nextId();
	return {
		propertyId: `PROP-${n.toString().padStart(6, "0")}`,
		name: `Test Owner ${n}`,
		propType: "RES",
		city: "Austin",
		propertyAddress: `${n * 100} Oak Street, Austin TX 78701`,
		assessedValue: 250_000 + n * 1_000,
		appraisedValue: 300_000 + n * 1_000,
		geoId: `GEO-${n}`,
		description: null,
		...overrides,
	};
}

export function buildProperties(
	count: number,
	overrides: Partial<PropertyData> = {},
): PropertyData[] {
	return Array.from({ length: count }, () => buildProperty(overrides));
}

// ---------------------------------------------------------------------------
// ScrapeJobData factory
// ---------------------------------------------------------------------------

export function buildScrapeJobData(
	overrides: Partial<ScrapeJobData> = {},
): ScrapeJobData {
	const n = nextId();
	return {
		searchTerm: `search-term-${n}`,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// ScrapeJobResult factory
// ---------------------------------------------------------------------------

export function buildScrapeJobResult(
	overrides: Partial<ScrapeJobResult> = {},
): ScrapeJobResult {
	const properties = overrides.properties ?? buildProperties(2);
	return {
		count: properties.length,
		properties,
		searchTerm: "test-search",
		duration: 1_500,
		...overrides,
		// count should reflect the actual properties length if overridden
		...(overrides.count === undefined ? { count: properties.length } : {}),
	};
}
