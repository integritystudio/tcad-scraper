/**
 * Property API types shared across frontend, scripts, and shared utilities.
 *
 * Extracted from the retired server/src/types/property.types.ts (API-level
 * interfaces only — the zod validation schemas live in
 * workers/tcad-api/src/types/property.types.ts).
 */

// ============================================================================
// API Level Types (Frontend/API Response)
// ============================================================================

/**
 * API representation with Schema.org alignment
 * Enhanced with semantic annotations for structured data
 * Maps to Schema.org: RealEstateListing, Place, Residence
 * Place: https://schema.org/Place * 
 * Residence: https://schema.org/Residence
 * RealEstateListing: https://schema.org/RealEstateListing
 */
export interface PropertyAPI {
	// Core identification
	"@context"?: "https://schema.org";
	"@type"?: "RealEstateListing" | "Place" | "Residence";
	"@id"?: string; // Unique URI for this property

	id: string;
	propertyId: string; // Schema.org: identifier

	// Ownership (Schema.org: seller/owner)
	owner: PropertyOwner;

	// Property details (Schema.org: name, description)
	propertyType: string; // Schema.org: additionalType
	legalDescription?: string; // Schema.org: description

	// Location (Schema.org: address, geo)
	address: PropertyAddress;
	geography?: PropertyGeography;

	// Valuation (Schema.org: offers/priceSpecification)
	valuation: PropertyValuation;

	// Metadata
	metadata: PropertyMetadata;
}

/**
 * Property owner information
 * Maps to Schema.org: Person or Organization
 */
export interface PropertyOwner {
	"@type"?: "Person" | "Organization";
	name: string; // Schema.org: name
	type?: "individual" | "entity"; // Determines Person vs Organization
}

/**
 * Property address with full Schema.org PostalAddress alignment
 */
export interface PropertyAddress {
	"@type"?: "PostalAddress";
	streetAddress: string; // Schema.org: streetAddress
	addressLocality?: string; // Schema.org: addressLocality (city)
	addressRegion: string; // Schema.org: addressRegion (state)
	addressCountry: string; // Schema.org: addressCountry
	postalCode?: string; // Schema.org: postalCode

	// Formatted versions
	formatted: string; // Full formatted address
	shortFormat?: string; // Abbreviated format for display
}

/**
 * Geographic information for the property
 * Maps to Schema.org: GeoCoordinates + geo properties
 */
export interface PropertyGeography {
	"@type"?: "GeoCoordinates";
	geoId?: string; // TCAD geographic identifier
	latitude?: number; // Schema.org: latitude
	longitude?: number; // Schema.org: longitude
	elevation?: number; // Schema.org: elevation

	// Additional geographic context
	neighborhood?: string; // Schema.org: containedInPlace
	schoolDistrict?: string;
	taxDistrict?: string;
	censusTract?: string;
}

/**
 * Property valuation information
 * Maps to Schema.org: PriceSpecification / PropertyValue
 */
export interface PropertyValuation {
	"@type"?: "PropertyValue";

	// Assessed value for tax purposes
	assessedValue?: MonetaryAmount;

	// Market appraisal value
	appraisedValue: MonetaryAmount;

	// Additional valuation details
	landValue?: MonetaryAmount;
	improvementValue?: MonetaryAmount;

	// Tax information
	taxableValue?: MonetaryAmount;
	exemptions?: TaxExemption[];

	// Valuation metadata
	valuationDate?: string; // ISO 8601 date
	valuationMethod?: string;
}

/**
 * Monetary amount with currency
 * Maps to Schema.org: MonetaryAmount
 */
export interface MonetaryAmount {
	"@type"?: "MonetaryAmount";
	value: number; // Schema.org: value
	currency: string; // Schema.org: currency (e.g., "USD")

	// Display helpers
	formatted?: string; // e.g., "$450,000"
	abbreviated?: string; // e.g., "$450K"
}

/**
 * Tax exemption information
 */
export interface TaxExemption {
	type: string; // e.g., "Homestead", "Senior", "Veteran"
	amount: MonetaryAmount;
	percentage?: number; // If percentage-based exemption
}

/**
 * Property metadata for tracking and management
 */
export interface PropertyMetadata {
	searchTerm?: string; // Search term that found this property
	dataSource: string; // e.g., "TCAD"
	scrapedAt: string; // ISO 8601 datetime
	createdAt: string; // ISO 8601 datetime
	updatedAt: string; // ISO 8601 datetime
	dataFreshness?: "current" | "stale" | "historical";
	lastVerified?: string; // ISO 8601 datetime
}
// ============================================================================
// Response Types
// ============================================================================

export interface PaginationMeta {
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: PaginationMeta;
}

/**
 * Paginated property response with Schema.org alignment
 */
export interface PaginatedPropertyResponse {
	"@context"?: "https://schema.org";
	"@type"?: "SearchResultsPage";

	results: PropertyAPI[];
	pagination: PaginationMeta;

	// Aggregations for filtering
	aggregations?: {
		propertyTypes: Array<{ type: string; count: number }>;
		cities: Array<{ city: string; count: number }>;
		priceRanges: Array<{ range: string; count: number }>;
	};
}
