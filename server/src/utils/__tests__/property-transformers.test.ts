import type { Property } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/logger", () => ({
	default: {
		trace: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import {
	transformPropertyToSnakeCase,
	validateProperty,
} from "../property-transformers";

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

	it("should handle negative numeric values", () => {
		const prop = createMockProperty({
			assessedValue: -100,
			appraisedValue: -999.99,
			year: -1,
		});
		const result = transformPropertyToSnakeCase(prop);

		expect(result.assessed_value).toBe(-100);
		expect(result.appraised_value).toBe(-999.99);
		expect(result.year).toBe(-1);
	});

	it("should handle very large numeric values", () => {
		const prop = createMockProperty({
			assessedValue: 999_999_999_999,
			appraisedValue: Number.MAX_SAFE_INTEGER,
			year: 9999,
		});
		const result = transformPropertyToSnakeCase(prop);

		expect(result.assessed_value).toBe(999_999_999_999);
		expect(result.appraised_value).toBe(Number.MAX_SAFE_INTEGER);
		expect(result.year).toBe(9999);
	});

	it("should handle special characters in strings", () => {
		const prop = createMockProperty({
			name: "O'Brien & Associates <LLC>",
			propertyAddress: '123 "Main" St; DROP TABLE--',
			description: "Unicode: \u00e9\u00e0\u00fc\u00f1 \u2603 \u2764",
			city: "SAN MARCOS / DEL VALLE",
		});
		const result = transformPropertyToSnakeCase(prop);

		expect(result.name).toBe("O'Brien & Associates <LLC>");
		expect(result.property_address).toBe('123 "Main" St; DROP TABLE--');
		expect(result.description).toBe(
			"Unicode: \u00e9\u00e0\u00fc\u00f1 \u2603 \u2764",
		);
		expect(result.city).toBe("SAN MARCOS / DEL VALLE");
	});

	it("should handle very long strings", () => {
		const longString = "A".repeat(10_000);
		const prop = createMockProperty({
			name: longString,
			description: longString,
		});
		const result = transformPropertyToSnakeCase(prop);

		expect(result.name).toHaveLength(10_000);
		expect(result.description).toHaveLength(10_000);
	});

	it("should handle fractional numeric values", () => {
		const prop = createMockProperty({
			assessedValue: 123456.789,
			appraisedValue: 0.01,
		});
		const result = transformPropertyToSnakeCase(prop);

		expect(result.assessed_value).toBe(123456.789);
		expect(result.appraised_value).toBe(0.01);
	});

	it("should throw on null year", () => {
		const prop = createMockProperty({ year: null as unknown as number });
		expect(() => transformPropertyToSnakeCase(prop)).toThrow(
			"Invalid year value",
		);
	});

	it("should throw on NaN year", () => {
		const prop = createMockProperty({ year: NaN });
		expect(() => transformPropertyToSnakeCase(prop)).toThrow(
			"Invalid year value",
		);
	});

	it("should throw on null appraisedValue", () => {
		const prop = createMockProperty({
			appraisedValue: null as unknown as number,
		});
		expect(() => transformPropertyToSnakeCase(prop)).toThrow(
			"Invalid appraisedValue",
		);
	});

	it("should throw on NaN appraisedValue", () => {
		const prop = createMockProperty({ appraisedValue: NaN });
		expect(() => transformPropertyToSnakeCase(prop)).toThrow(
			"Invalid appraisedValue",
		);
	});

	it("should throw on Infinity appraisedValue", () => {
		const prop = createMockProperty({ appraisedValue: Infinity });
		expect(() => transformPropertyToSnakeCase(prop)).toThrow(
			"Invalid appraisedValue",
		);
	});

	it("should throw on NaN assessedValue when non-null", () => {
		const prop = createMockProperty({ assessedValue: NaN });
		expect(() => transformPropertyToSnakeCase(prop)).toThrow(
			"Invalid assessedValue",
		);
	});

	it("should allow null assessedValue", () => {
		const prop = createMockProperty({ assessedValue: null });
		const result = transformPropertyToSnakeCase(prop);
		expect(result.assessed_value).toBeNull();
	});

	it("should include propertyId in validation error messages", () => {
		const prop = createMockProperty({
			propertyId: "TEST-123",
			year: null as unknown as number,
		});
		expect(() => transformPropertyToSnakeCase(prop)).toThrow("TEST-123");
	});
});

describe("validateProperty", () => {
	it("should not throw for valid property", () => {
		const prop = createMockProperty();
		expect(() => validateProperty(prop)).not.toThrow();
	});

	it("should throw on null year", () => {
		const prop = createMockProperty({ year: null as unknown as number });
		expect(() => validateProperty(prop)).toThrow("Invalid year value");
	});

	it("should throw on NaN appraisedValue", () => {
		const prop = createMockProperty({ appraisedValue: NaN });
		expect(() => validateProperty(prop)).toThrow("Invalid appraisedValue");
	});

	it("should throw on NaN assessedValue when non-null", () => {
		const prop = createMockProperty({ assessedValue: NaN });
		expect(() => validateProperty(prop)).toThrow("Invalid assessedValue");
	});

	it("should allow null assessedValue", () => {
		const prop = createMockProperty({ assessedValue: null });
		expect(() => validateProperty(prop)).not.toThrow();
	});
});
