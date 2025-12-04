import { describe, expect, it } from "vitest";
import type {
	PaginatedPropertyResponse,
	PropertyAPI,
} from "../../types/property.types";
import {
	generateBreadcrumbJsonLd,
	generateOrganizationJsonLd,
	generatePageJsonLd,
	generatePropertyCollectionJsonLd,
	generatePropertyJsonLd,
	generatePropertyListJsonLd,
	injectJsonLdScript,
	validateJsonLd,
} from "../json-ld.utils";

describe("JSON-LD Utils", () => {
	const mockProperty: PropertyAPI = {
		"@type": "RealEstateListing",
		propertyId: "TEST-123",
		address: {
			formatted: "123 Main St, Austin, TX 78701",
			shortFormat: "123 Main St",
			streetAddress: "123 Main St",
			addressLocality: "Austin",
			addressRegion: "TX",
			addressCountry: "US",
			postalCode: "78701",
		},
		propertyType: "Residential",
		owner: {
			"@type": "Person",
			name: "John Doe",
		},
		valuation: {
			appraisedValue: {
				value: 500000,
				currency: "USD",
				formatted: "$500,000",
			},
			assessedValue: {
				value: 450000,
				currency: "USD",
				formatted: "$450,000",
			},
		},
		geography: {
			latitude: 30.2672,
			longitude: -97.7431,
			neighborhood: "Downtown",
		},
		legalDescription: "Lot 5, Block 3, Downtown Addition",
		metadata: {
			createdAt: "2024-01-01T00:00:00Z",
			updatedAt: "2024-01-02T00:00:00Z",
			scrapedAt: "2024-01-01T00:00:00Z",
			dataFreshness: "fresh" as const,
		},
	};

	describe("generatePropertyJsonLd", () => {
		it("should generate valid property JSON-LD with all fields", () => {
			const result = generatePropertyJsonLd(
				mockProperty,
				"TCAD",
				"https://example.com",
			);

			expect(result).toMatchObject({
				"@context": "https://schema.org",
				"@type": "RealEstateListing",
				"@id": "https://example.com/properties/TEST-123",
				identifier: "TEST-123",
				name: "123 Main St, Austin, TX 78701 - TCAD Property",
			});
		});

		it("should include address information", () => {
			const result = generatePropertyJsonLd(mockProperty) as any;

			expect(result.address).toEqual({
				"@type": "PostalAddress",
				streetAddress: "123 Main St",
				addressLocality: "Austin",
				addressRegion: "TX",
				addressCountry: "US",
				postalCode: "78701",
			});
		});

		it("should include geographic coordinates when available", () => {
			const result = generatePropertyJsonLd(mockProperty) as any;

			expect(result.geo).toEqual({
				"@type": "GeoCoordinates",
				latitude: 30.2672,
				longitude: -97.7431,
			});
		});

		it("should include owner/seller information", () => {
			const result = generatePropertyJsonLd(mockProperty) as any;

			expect(result.seller).toEqual({
				"@type": "Person",
				name: "John Doe",
			});
		});

		it("should include pricing offers", () => {
			const result = generatePropertyJsonLd(mockProperty) as any;

			expect(result.offers).toMatchObject({
				"@type": "Offer",
				price: 500000,
				priceCurrency: "USD",
			});
		});

		it("should include both appraised and assessed values in price specifications", () => {
			const result = generatePropertyJsonLd(mockProperty) as any;

			expect(result.offers.priceSpecification).toHaveLength(2);
			expect(result.offers.priceSpecification[0]).toMatchObject({
				"@type": "PriceSpecification",
				price: 500000,
				name: "Appraised Value",
			});
			expect(result.offers.priceSpecification[1]).toMatchObject({
				"@type": "PriceSpecification",
				price: 450000,
				name: "Assessed Value",
			});
		});

		it("should work without optional fields", () => {
			const minimalProperty: PropertyAPI = {
				propertyId: "MIN-123",
				address: {
					formatted: "456 Oak Ave",
					streetAddress: "456 Oak Ave",
					addressLocality: "Austin",
					addressRegion: "TX",
					addressCountry: "US",
				},
				propertyType: "Commercial",
				valuation: {
					appraisedValue: {
						value: 1000000,
						currency: "USD",
						formatted: "$1,000,000",
					},
				},
				metadata: {
					createdAt: "2024-01-01T00:00:00Z",
					updatedAt: "2024-01-01T00:00:00Z",
					scrapedAt: "2024-01-01T00:00:00Z",
					dataFreshness: "fresh" as const,
				},
			};

			const result = generatePropertyJsonLd(minimalProperty) as any;

			expect(result["@type"]).toBe("RealEstateListing");
			expect(result.identifier).toBe("MIN-123");
			expect(result.geo).toBeUndefined();
			expect(result.seller).toBeUndefined();
		});
	});

	describe("generatePropertyListJsonLd", () => {
		const mockResponse: PaginatedPropertyResponse = {
			results: [mockProperty],
			pagination: {
				total: 1,
				offset: 0,
				limit: 20,
				hasMore: false,
			},
		};

		it("should generate valid ItemList JSON-LD", () => {
			const result = generatePropertyListJsonLd(mockResponse);

			expect(result).toMatchObject({
				"@context": "https://schema.org",
				"@type": "ItemList",
				numberOfItems: 1,
			});
		});

		it("should include search query in name when provided", () => {
			const result = generatePropertyListJsonLd(
				mockResponse,
				"Austin homes",
			) as any;

			expect(result.name).toBe('Property Search Results for "Austin homes"');
		});

		it("should use default name when no search query", () => {
			const result = generatePropertyListJsonLd(mockResponse) as any;

			expect(result.name).toBe("Travis County Properties");
		});

		it("should include list items with correct positions", () => {
			const result = generatePropertyListJsonLd(mockResponse) as any;

			expect(result.itemListElement).toHaveLength(1);
			expect(result.itemListElement[0]).toMatchObject({
				"@type": "ListItem",
				position: 1,
			});
		});

		it("should include item details for each property", () => {
			const result = generatePropertyListJsonLd(mockResponse) as any;

			expect(result.itemListElement[0].item).toMatchObject({
				"@type": "RealEstateListing",
				"@id": "https://example.com/properties/TEST-123",
				identifier: "TEST-123",
				name: "123 Main St, Austin, TX 78701",
			});
		});

		it("should include nextItem when hasMore is true", () => {
			const responseWithMore: PaginatedPropertyResponse = {
				...mockResponse,
				pagination: {
					...mockResponse.pagination,
					hasMore: true,
				},
			};

			const result = generatePropertyListJsonLd(responseWithMore) as any;

			expect(result.nextItem).toBeDefined();
			expect(result.nextItem).toContain("offset=20");
		});

		it("should not include nextItem when hasMore is false", () => {
			const result = generatePropertyListJsonLd(mockResponse) as any;

			expect(result.nextItem).toBeUndefined();
		});

		it("should include search action", () => {
			const result = generatePropertyListJsonLd(mockResponse) as any;

			expect(result.potentialAction).toMatchObject({
				"@type": "SearchAction",
				"query-input": "required name=search_term_string",
			});
		});
	});

	describe("generateOrganizationJsonLd", () => {
		it("should generate valid WebSite JSON-LD with defaults", () => {
			const result = generateOrganizationJsonLd() as any;

			expect(result["@context"]).toBe("https://schema.org");
			expect(result["@type"]).toBe("WebSite");
			expect(result.name).toBeDefined();
			expect(result.url).toBeDefined();
		});

		it("should use custom website URL", () => {
			const result = generateOrganizationJsonLd("https://custom.com") as any;

			expect(result.url).toBe("https://custom.com");
		});

		it("should use custom organization name", () => {
			const result = generateOrganizationJsonLd(
				"https://example.com",
				"Custom TCAD",
			) as any;

			expect(result.name).toBe("Custom TCAD");
		});

		it("should include description", () => {
			const result = generateOrganizationJsonLd() as any;

			expect(result.description).toBeDefined();
			expect(typeof result.description).toBe("string");
		});
	});

	describe("generateBreadcrumbJsonLd", () => {
		it("should generate valid BreadcrumbList JSON-LD", () => {
			const items = [
				{ name: "Home", url: "/" },
				{ name: "Properties", url: "/properties" },
				{ name: "Details" },
			];

			const result = generateBreadcrumbJsonLd(items) as any;

			expect(result["@context"]).toBe("https://schema.org");
			expect(result["@type"]).toBe("BreadcrumbList");
			expect(result.itemListElement).toHaveLength(3);
		});

		it("should set correct position for each item", () => {
			const items = [
				{ name: "Home", url: "/" },
				{ name: "Properties", url: "/properties" },
			];

			const result = generateBreadcrumbJsonLd(items) as any;

			expect(result.itemListElement[0].position).toBe(1);
			expect(result.itemListElement[1].position).toBe(2);
		});

		it("should include URLs when provided", () => {
			const items = [
				{ name: "Home", url: "/" },
				{ name: "Properties", url: "/properties" },
			];

			const result = generateBreadcrumbJsonLd(
				items,
				"https://example.com",
			) as any;

			expect(result.itemListElement[0].item).toBe("https://example.com/");
			expect(result.itemListElement[1].item).toBe(
				"https://example.com/properties",
			);
		});

		it("should omit item field when URL not provided", () => {
			const items = [{ name: "Home", url: "/" }, { name: "Current Page" }];

			const result = generateBreadcrumbJsonLd(items) as any;

			expect(result.itemListElement[0].item).toBeDefined();
			expect(result.itemListElement[1].item).toBeUndefined();
		});

		it("should handle empty items array", () => {
			const result = generateBreadcrumbJsonLd([]) as any;

			expect(result.itemListElement).toHaveLength(0);
		});
	});

	describe("generatePropertyCollectionJsonLd", () => {
		const mockProperties: PropertyAPI[] = [
			mockProperty,
			{
				...mockProperty,
				propertyId: "TEST-456",
				valuation: {
					appraisedValue: {
						value: 750000,
						currency: "USD",
						formatted: "$750,000",
					},
				},
			},
		];

		it("should generate valid CollectionPage JSON-LD", () => {
			const result = generatePropertyCollectionJsonLd(
				mockProperties,
				"Austin Properties",
				"city",
			) as any;

			expect(result["@context"]).toBe("https://schema.org");
			expect(result["@type"]).toBe("CollectionPage");
			expect(result.name).toBe("Austin Properties");
		});

		it("should include correct number of items", () => {
			const result = generatePropertyCollectionJsonLd(
				mockProperties,
				"Austin Properties",
				"city",
			) as any;

			expect(result.description).toBe("Collection of 2 properties");
			expect(result.mainEntity.numberOfItems).toBe(2);
		});

		it("should limit list items to 10", () => {
			const manyProperties = Array(15)
				.fill(mockProperty)
				.map((p, i) => ({
					...p,
					propertyId: `TEST-${i}`,
				}));

			const result = generatePropertyCollectionJsonLd(
				manyProperties,
				"Large Collection",
				"custom",
			) as any;

			expect(result.mainEntity.itemListElement).toHaveLength(10);
		});

		it("should calculate aggregate statistics correctly", () => {
			const result = generatePropertyCollectionJsonLd(
				mockProperties,
				"Austin Properties",
				"city",
			) as any;

			expect(result.aggregateRating).toMatchObject({
				"@type": "AggregateOffer",
				lowPrice: 500000,
				highPrice: 750000,
				priceCurrency: "USD",
				offerCount: 2,
				averagePrice: 625000,
			});
		});

		it("should include city metadata for city collections", () => {
			const result = generatePropertyCollectionJsonLd(
				mockProperties,
				"Austin",
				"city",
			) as any;

			expect(result.about).toEqual({
				"@type": "City",
				name: "Austin",
			});
		});

		it("should omit city metadata for non-city collections", () => {
			const result = generatePropertyCollectionJsonLd(
				mockProperties,
				"Residential",
				"type",
			) as any;

			expect(result.about).toBeUndefined();
		});

		it("should include modification date", () => {
			const result = generatePropertyCollectionJsonLd(
				mockProperties,
				"Test Collection",
				"custom",
			) as any;

			expect(result.dateModified).toBeDefined();
			expect(new Date(result.dateModified)).toBeInstanceOf(Date);
		});

		it("should include item URLs", () => {
			const result = generatePropertyCollectionJsonLd(
				mockProperties,
				"Austin Properties",
				"city",
				"https://example.com",
			) as any;

			expect(result.mainEntity.itemListElement[0].item.url).toBe(
				"https://example.com/properties/TEST-123",
			);
		});
	});

	describe("injectJsonLdScript", () => {
		it("should generate valid script tag", () => {
			const jsonLd = {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: "Test",
			};

			const result = injectJsonLdScript(jsonLd);

			expect(result).toContain('<script type="application/ld+json">');
			expect(result).toContain("</script>");
		});

		it("should include properly formatted JSON", () => {
			const jsonLd = {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: "Test",
			};

			const result = injectJsonLdScript(jsonLd);

			expect(result).toContain('"@context": "https://schema.org"');
			expect(result).toContain('"@type": "WebSite"');
			expect(result).toContain('"name": "Test"');
		});

		it("should handle complex nested objects", () => {
			const jsonLd = {
				"@context": "https://schema.org",
				"@type": "RealEstateListing",
				address: {
					"@type": "PostalAddress",
					streetAddress: "123 Main St",
				},
			};

			const result = injectJsonLdScript(jsonLd);

			expect(result).toContain("PostalAddress");
			expect(result).toContain("123 Main St");
		});
	});

	describe("generatePageJsonLd", () => {
		it("should generate property page scripts", () => {
			const result = generatePageJsonLd("property", mockProperty);

			expect(result).toHaveLength(2);
			expect(result[0]).toContain("RealEstateListing");
			expect(result[1]).toContain("BreadcrumbList");
		});

		it("should generate listing page scripts", () => {
			const data: PaginatedPropertyResponse = {
				results: [mockProperty],
				pagination: {
					total: 1,
					offset: 0,
					limit: 20,
					hasMore: false,
				},
			};

			const result = generatePageJsonLd("listing", data);

			expect(result).toHaveLength(2);
			expect(result[0]).toContain("ItemList");
			expect(result[1]).toContain("BreadcrumbList");
		});

		it("should generate home page scripts", () => {
			const result = generatePageJsonLd("home", null);

			expect(result).toHaveLength(1);
			expect(result[0]).toContain("WebSite");
		});

		it("should include proper breadcrumbs for property page", () => {
			const result = generatePageJsonLd("property", mockProperty);

			expect(result[1]).toContain("Home");
			expect(result[1]).toContain("Properties");
			expect(result[1]).toContain("123 Main St");
		});

		it("should include proper breadcrumbs for listing page", () => {
			const data: PaginatedPropertyResponse = {
				results: [mockProperty],
				pagination: {
					total: 1,
					offset: 0,
					limit: 20,
					hasMore: false,
				},
			};

			const result = generatePageJsonLd("listing", data);

			expect(result[1]).toContain("Search Results");
		});

		it("should use custom website URL", () => {
			const result = generatePageJsonLd("home", null, "https://custom.com");

			expect(result[0]).toContain("https://custom.com");
		});
	});

	describe("validateJsonLd", () => {
		it("should return no errors for valid JSON-LD", () => {
			const validJsonLd = {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: "Test",
			};

			const errors = validateJsonLd(validJsonLd);

			expect(errors).toHaveLength(0);
		});

		it("should detect missing @context", () => {
			const invalidJsonLd = {
				"@type": "WebSite",
				name: "Test",
			};

			const errors = validateJsonLd(invalidJsonLd);

			expect(errors).toContain("Missing @context field");
		});

		it("should detect missing @type", () => {
			const invalidJsonLd = {
				"@context": "https://schema.org",
				name: "Test",
			};

			const errors = validateJsonLd(invalidJsonLd);

			expect(errors).toContain("Missing @type field");
		});

		it("should validate RealEstateListing requires address", () => {
			const invalidJsonLd = {
				"@context": "https://schema.org",
				"@type": "RealEstateListing",
				name: "Test Property",
			};

			const errors = validateJsonLd(invalidJsonLd);

			expect(errors).toContain("RealEstateListing requires address field");
		});

		it("should validate RealEstateListing requires offers or price", () => {
			const invalidJsonLd = {
				"@context": "https://schema.org",
				"@type": "RealEstateListing",
				address: {
					"@type": "PostalAddress",
					streetAddress: "123 Main St",
				},
			};

			const errors = validateJsonLd(invalidJsonLd);

			expect(errors).toContain(
				"RealEstateListing requires offers or price field",
			);
		});

		it("should validate PostalAddress requires streetAddress", () => {
			const invalidJsonLd = {
				"@context": "https://schema.org",
				"@type": "Thing",
				address: {
					"@type": "PostalAddress",
					addressLocality: "Austin",
				},
			};

			const errors = validateJsonLd(invalidJsonLd);

			expect(errors).toContain("PostalAddress requires streetAddress");
		});

		it("should validate PostalAddress requires locality or region", () => {
			const invalidJsonLd = {
				"@context": "https://schema.org",
				"@type": "Thing",
				address: {
					"@type": "PostalAddress",
					streetAddress: "123 Main St",
				},
			};

			const errors = validateJsonLd(invalidJsonLd);

			expect(errors).toContain(
				"PostalAddress requires addressLocality or addressRegion",
			);
		});

		it("should accept valid RealEstateListing with price instead of offers", () => {
			const validJsonLd = {
				"@context": "https://schema.org",
				"@type": "RealEstateListing",
				address: {
					"@type": "PostalAddress",
					streetAddress: "123 Main St",
					addressLocality: "Austin",
				},
				price: 500000,
			};

			const errors = validateJsonLd(validJsonLd);

			expect(errors).not.toContain(
				"RealEstateListing requires offers or price field",
			);
		});

		it("should handle array @type with RealEstateListing", () => {
			const jsonLd = {
				"@context": "https://schema.org",
				"@type": ["Place", "RealEstateListing"],
				name: "Test",
			};

			const errors = validateJsonLd(jsonLd);

			expect(errors).toContain("RealEstateListing requires address field");
		});

		it("should accumulate multiple errors", () => {
			const invalidJsonLd = {
				name: "Test",
			};

			const errors = validateJsonLd(invalidJsonLd);

			expect(errors.length).toBeGreaterThanOrEqual(2);
			expect(errors).toContain("Missing @context field");
			expect(errors).toContain("Missing @type field");
		});
	});
});
