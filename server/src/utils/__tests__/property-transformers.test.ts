import { describe, expect, it } from "vitest";
import type { Property } from "@prisma/client";
import { transformPropertyToSnakeCase } from "../property-transformers";

function createMockProperty(overrides: Partial<Property> = {}): Property {
	return {
		id: "uuid-123",
		propertyId: "PROP-456",
		name: "John Smith",
		propType: "R",
		city: "AUSTIN",
		propertyAddress: "123 Main St",
		assessedValue: 480000,
		appraisedValue: 500000,
		geoId: "GEO789",
		description: "Residential lot",
		searchTerm: "Smith",
		year: 2025,
		scrapedAt: new Date("2025-06-15T12:00:00.000Z"),
		createdAt: new Date("2025-06-15T12:00:00.000Z"),
		updatedAt: new Date("2025-06-15T12:00:00.000Z"),
		...overrides,
	};
}

describe("transformPropertyToSnakeCase", () => {
	it("should transform all camelCase fields to snake_case", () => {
		const prop = createMockProperty();
		const result = transformPropertyToSnakeCase(prop);

		expect(result).toEqual({
			id: "uuid-123",
			property_id: "PROP-456",
			name: "John Smith",
			prop_type: "R",
			city: "AUSTIN",
			property_address: "123 Main St",
			assessed_value: 480000,
			appraised_value: 500000,
			geo_id: "GEO789",
			description: "Residential lot",
			search_term: "Smith",
			year: 2025,
			scraped_at: "2025-06-15T12:00:00.000Z",
			created_at: "2025-06-15T12:00:00.000Z",
			updated_at: "2025-06-15T12:00:00.000Z",
		});
	});

	it("should handle nullable fields as null", () => {
		const prop = createMockProperty({
			city: null,
			assessedValue: null,
			geoId: null,
			description: null,
			searchTerm: null,
		});
		const result = transformPropertyToSnakeCase(prop);

		expect(result.city).toBeNull();
		expect(result.assessed_value).toBeNull();
		expect(result.geo_id).toBeNull();
		expect(result.description).toBeNull();
		expect(result.search_term).toBeNull();
	});

	it("should convert Date objects to ISO strings", () => {
		const date = new Date("2026-01-15T08:30:00.000Z");
		const prop = createMockProperty({
			scrapedAt: date,
			createdAt: date,
			updatedAt: date,
		});
		const result = transformPropertyToSnakeCase(prop);

		expect(result.scraped_at).toBe("2026-01-15T08:30:00.000Z");
		expect(result.created_at).toBe("2026-01-15T08:30:00.000Z");
		expect(result.updated_at).toBe("2026-01-15T08:30:00.000Z");
	});

	it("should preserve zero values", () => {
		const prop = createMockProperty({
			assessedValue: 0,
			appraisedValue: 0,
			year: 0,
		});
		const result = transformPropertyToSnakeCase(prop);

		expect(result.assessed_value).toBe(0);
		expect(result.appraised_value).toBe(0);
		expect(result.year).toBe(0);
	});

	it("should preserve empty string fields", () => {
		const prop = createMockProperty({
			name: "",
			propertyAddress: "",
		});
		const result = transformPropertyToSnakeCase(prop);

		expect(result.name).toBe("");
		expect(result.property_address).toBe("");
	});
});
