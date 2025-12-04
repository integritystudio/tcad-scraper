/**
 * JSON-LD Structured Data Utilities for TCAD Properties
 *
 * This module provides utilities to generate Schema.org compliant JSON-LD
 * structured data for maximum SEO value. It supports various contexts including
 * individual property pages, property listings, and search results.
 *
 * @see https://schema.org/RealEstateListing
 * @see https://developers.google.com/search/docs/appearance/structured-data
 */

import type {
	PaginatedPropertyResponse,
	PropertyAPI,
} from "../types/property.types";

// ============================================================================
// Type Definitions for JSON-LD
// ============================================================================

export interface JsonLdBase {
	"@context": "https://schema.org";
	"@type": string | string[];
	"@id"?: string;
}

export interface BreadcrumbItem {
	"@type": "ListItem";
	position: number;
	name: string;
	item?: string;
}

export interface SearchAction {
	"@type": "SearchAction";
	target: {
		"@type": "EntryPoint";
		urlTemplate: string;
	};
	"query-input": string;
}

export interface RealEstateListingJsonLd extends JsonLdBase {
	"@type": "RealEstateListing" | string;
	identifier: string;
	name: string;
	description: string;
	address: {
		"@type": "PostalAddress";
		streetAddress?: string;
		addressLocality?: string;
		addressRegion: string;
		addressCountry: string;
		postalCode?: string;
	};
	geo?: {
		"@type": "GeoCoordinates";
		latitude: number;
		longitude: number;
	};
	additionalType?: string;
	seller?: {
		"@type": string;
		name: string;
	};
	offers: Record<string, unknown>;
	url?: string;
	provider?: {
		"@type": "Organization";
		name: string;
		url?: string;
		sameAs?: string[];
	};
	containedInPlace?: {
		"@type": string;
		name: string;
	};
	datePosted?: string;
	dateModified?: string;
	potentialAction?: Array<{
		"@type": string;
		target?: string;
		name?: string;
	}>;
}

// ============================================================================
// Individual Property JSON-LD
// ============================================================================

/**
 * Generate JSON-LD for a single property detail page
 * This provides the most comprehensive structured data for SEO
 */
export function generatePropertyJsonLd(
	property: PropertyAPI,
	organizationName = "Travis County Appraisal District",
	websiteUrl = "https://example.com",
): RealEstateListingJsonLd {
	const jsonLd: RealEstateListingJsonLd = {
		"@context": "https://schema.org",
		"@type": property["@type"] || "RealEstateListing",
		"@id": `${websiteUrl}/properties/${property.propertyId}`,

		// Core property information
		identifier: property.propertyId,
		name: `${property.address.formatted} - TCAD Property`,
		description:
			property.legalDescription ||
			`${property.propertyType} property located at ${property.address.formatted}`,

		// Address with full PostalAddress structure
		address: {
			"@type": "PostalAddress",
			...(property.address.streetAddress && {
				streetAddress: property.address.streetAddress,
			}),
			...(property.address.addressLocality && {
				addressLocality: property.address.addressLocality,
			}),
			addressRegion: property.address.addressRegion,
			addressCountry: property.address.addressCountry,
			...(property.address.postalCode && {
				postalCode: property.address.postalCode,
			}),
		},

		// Geographic coordinates if available
		...(property.geography?.latitude &&
			property.geography?.longitude && {
				geo: {
					"@type": "GeoCoordinates",
					latitude: property.geography.latitude,
					longitude: property.geography.longitude,
				},
			}),

		// Property type categorization
		additionalType: property.propertyType,

		// Owner/Seller information
		...(property.owner && {
			seller: {
				"@type": property.owner["@type"] || "Person",
				name: property.owner.name,
			},
		}),

		// Pricing and valuation
		offers: {
			"@type": "Offer",
			price: property.valuation.appraisedValue.value,
			priceCurrency: property.valuation.appraisedValue.currency,

			// Additional price specifications
			priceSpecification: [
				{
					"@type": "PriceSpecification",
					price: property.valuation.appraisedValue.value,
					priceCurrency: property.valuation.appraisedValue.currency,
					name: "Appraised Value",
					description: "Market value as determined by TCAD",
				},
				...(property.valuation.assessedValue
					? [
							{
								"@type": "PriceSpecification",
								price: property.valuation.assessedValue.value,
								priceCurrency: property.valuation.assessedValue.currency,
								name: "Assessed Value",
								description: "Tax assessed value for property tax calculations",
							},
						]
					: []),
			],

			// Seller/offerer information
			seller: {
				"@type": "Organization",
				name: organizationName,
				url: websiteUrl,
			},

			// Validity dates based on data freshness
			validFrom: property.metadata.scrapedAt,
			...(property.metadata.dataFreshness === "stale" && {
				validThrough: new Date(
					Date.now() + 30 * 24 * 60 * 60 * 1000,
				).toISOString(),
			}),
		},

		// Additional property details
		...(property.geography?.neighborhood && {
			containedInPlace: {
				"@type": "Place",
				name: property.geography.neighborhood,
			},
		}),

		// Data provider information
		provider: {
			"@type": "Organization",
			name: organizationName,
			url: websiteUrl,
			sameAs: ["https://www.traviscad.org"],
		},

		// Metadata
		datePosted: property.metadata.createdAt,
		dateModified: property.metadata.updatedAt,

		// Potential actions
		potentialAction: [
			{
				"@type": "ViewAction",
				target: `${websiteUrl}/properties/${property.propertyId}`,
				name: "View Property Details",
			},
		],
	};

	return jsonLd;
}

// ============================================================================
// Property Listing/Search Results JSON-LD
// ============================================================================

/**
 * Generate JSON-LD for a property listing or search results page
 * Implements ItemList for better search result presentation
 */
export function generatePropertyListJsonLd(
	response: PaginatedPropertyResponse,
	searchQuery?: string,
	websiteUrl = "https://example.com",
): object {
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: searchQuery
			? `Property Search Results for "${searchQuery}"`
			: "Travis County Properties",
		description: `Browse ${response.pagination.total} properties in Travis County`,
		numberOfItems: response.pagination.total,

		// Individual property items
		itemListElement: response.results.map((property, index) => ({
			"@type": "ListItem",
			position: response.pagination.offset + index + 1,
			item: {
				"@type": property["@type"] || "RealEstateListing",
				"@id": `${websiteUrl}/properties/${property.propertyId}`,
				identifier: property.propertyId,
				name: property.address.formatted,
				description: `${property.propertyType} - ${property.valuation.appraisedValue.formatted}`,

				address: {
					"@type": "PostalAddress",
					streetAddress: property.address.streetAddress,
					addressLocality: property.address.addressLocality,
					addressRegion: property.address.addressRegion,
					addressCountry: property.address.addressCountry,
				},

				offers: {
					"@type": "Offer",
					price: property.valuation.appraisedValue.value,
					priceCurrency: property.valuation.appraisedValue.currency,
				},

				url: `${websiteUrl}/properties/${property.propertyId}`,
			},
		})),

		// Pagination information
		...(response.pagination.hasMore && {
			nextItem: `${websiteUrl}/search?offset=${response.pagination.offset + response.pagination.limit}`,
		}),

		// Search action for the listing
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${websiteUrl}/search?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};

	return jsonLd;
}

// ============================================================================
// Website/Organization JSON-LD
// ============================================================================

/**
 * Generate JSON-LD for the website/organization
 * Should be included on the homepage
 */
export function generateOrganizationJsonLd(
	websiteUrl = "https://example.com",
	organizationName = "TCAD Property Search",
): object {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"@id": websiteUrl,
		name: organizationName,
		description:
			"Search and browse Travis County Appraisal District property records",
		url: websiteUrl,

		// Publisher/operator
		publisher: {
			"@type": "Organization",
			name: organizationName,
			url: websiteUrl,
			logo: {
				"@type": "ImageObject",
				url: `${websiteUrl}/logo.png`,
				width: 600,
				height: 60,
			},
		},

		// Site search box
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${websiteUrl}/search?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},

		// Related entities
		about: {
			"@type": "Thing",
			name: "Travis County Property Records",
			description:
				"Official property appraisal and tax assessment records for Travis County, Texas",
		},

		// Geographic service area
		areaServed: {
			"@type": "AdministrativeArea",
			name: "Travis County",
			containedInPlace: {
				"@type": "State",
				name: "Texas",
				containedInPlace: {
					"@type": "Country",
					name: "United States",
				},
			},
		},
	};
}

// ============================================================================
// Breadcrumb JSON-LD
// ============================================================================

/**
 * Generate breadcrumb JSON-LD for navigation
 */
export function generateBreadcrumbJsonLd(
	items: Array<{ name: string; url?: string }>,
	websiteUrl = "https://example.com",
): object {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			...(item.url && {
				item: `${websiteUrl}${item.url}`,
			}),
		})),
	};
}

// ============================================================================
// Property Collection JSON-LD
// ============================================================================

/**
 * Generate JSON-LD for a collection of properties (e.g., by city or type)
 */
export function generatePropertyCollectionJsonLd(
	properties: PropertyAPI[],
	collectionName: string,
	collectionType: "city" | "type" | "custom",
	websiteUrl = "https://example.com",
): object {
	const totalValue = properties.reduce(
		(sum, p) => sum + p.valuation.appraisedValue.value,
		0,
	);

	const avgValue = totalValue / properties.length;

	return {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		name: collectionName,
		description: `Collection of ${properties.length} properties`,

		// Main entity of the page
		mainEntity: {
			"@type": "ItemList",
			numberOfItems: properties.length,
			itemListElement: properties.slice(0, 10).map((property, index) => ({
				"@type": "ListItem",
				position: index + 1,
				item: {
					"@type": property["@type"] || "RealEstateListing",
					identifier: property.propertyId,
					name: property.address.formatted,
					offers: {
						"@type": "Offer",
						price: property.valuation.appraisedValue.value,
						priceCurrency: property.valuation.appraisedValue.currency,
					},
					url: `${websiteUrl}/properties/${property.propertyId}`,
				},
			})),
		},

		// Aggregate statistics
		aggregateRating: {
			"@type": "AggregateOffer",
			lowPrice: Math.min(
				...properties.map((p) => p.valuation.appraisedValue.value),
			),
			highPrice: Math.max(
				...properties.map((p) => p.valuation.appraisedValue.value),
			),
			priceCurrency: "USD",
			offerCount: properties.length,
			averagePrice: avgValue,
		},

		// Collection metadata
		...(collectionType === "city" && {
			about: {
				"@type": "City",
				name: collectionName,
			},
		}),

		dateModified: new Date().toISOString(),
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Inject JSON-LD script into HTML head
 */
export function injectJsonLdScript(jsonLd: object): string {
	return `<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>`;
}

/**
 * Generate multiple JSON-LD scripts for a page
 */
export function generatePageJsonLd(
	type: "property" | "listing" | "home",
	data: PropertyAPI | PaginatedPropertyResponse | Record<string, unknown>,
	websiteUrl = "https://example.com",
): string[] {
	const scripts: string[] = [];

	switch (type) {
		case "property":
			// Individual property page
			scripts.push(
				injectJsonLdScript(
					generatePropertyJsonLd(data as PropertyAPI, undefined, websiteUrl),
				),
			);
			scripts.push(
				injectJsonLdScript(
					generateBreadcrumbJsonLd(
						[
							{ name: "Home", url: "/" },
							{ name: "Properties", url: "/properties" },
							{ name: (data as PropertyAPI).address.shortFormat || "Property" },
						],
						websiteUrl,
					),
				),
			);
			break;

		case "listing":
			// Property listing/search results
			scripts.push(
				injectJsonLdScript(
					generatePropertyListJsonLd(
						data as PaginatedPropertyResponse,
						undefined,
						websiteUrl,
					),
				),
			);
			scripts.push(
				injectJsonLdScript(
					generateBreadcrumbJsonLd(
						[{ name: "Home", url: "/" }, { name: "Search Results" }],
						websiteUrl,
					),
				),
			);
			break;

		case "home":
			// Homepage
			scripts.push(injectJsonLdScript(generateOrganizationJsonLd(websiteUrl)));
			break;
	}

	return scripts;
}

/**
 * Validate JSON-LD structure
 * Returns validation errors if any
 */
export function validateJsonLd(jsonLd: Record<string, unknown>): string[] {
	const errors: string[] = [];

	// Check for required @context
	if (!jsonLd["@context"]) {
		errors.push("Missing @context field");
	}

	// Check for required @type
	if (!jsonLd["@type"]) {
		errors.push("Missing @type field");
	}

	// Validate RealEstateListing specific fields
	if (
		jsonLd["@type"] === "RealEstateListing" ||
		(Array.isArray(jsonLd["@type"]) &&
			jsonLd["@type"].includes("RealEstateListing"))
	) {
		if (!jsonLd.address) {
			errors.push("RealEstateListing requires address field");
		}
		if (!jsonLd.offers && !jsonLd.price) {
			errors.push("RealEstateListing requires offers or price field");
		}
	}

	// Validate PostalAddress
	if (
		jsonLd.address &&
		typeof jsonLd.address === "object" &&
		jsonLd.address !== null
	) {
		const address = jsonLd.address as Record<string, unknown>;
		if (address["@type"] === "PostalAddress") {
			if (!address.streetAddress) {
				errors.push("PostalAddress requires streetAddress");
			}
			if (!address.addressLocality && !address.addressRegion) {
				errors.push("PostalAddress requires addressLocality or addressRegion");
			}
		}
	}

	return errors;
}

export default {
	generatePropertyJsonLd,
	generatePropertyListJsonLd,
	generateOrganizationJsonLd,
	generateBreadcrumbJsonLd,
	generatePropertyCollectionJsonLd,
	generatePageJsonLd,
	validateJsonLd,
	injectJsonLdScript,
};
