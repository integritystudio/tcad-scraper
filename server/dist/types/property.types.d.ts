/**
 * TCAD Property Type Definitions with Schema.org Alignment
 *
 * This file provides TypeScript interfaces that align with Schema.org vocabulary
 * for maximum SEO value and semantic clarity. The types are designed to work
 * across frontend, backend, and provide excellent structured data for search engines.
 *
 * Schema.org Types Used:
 * - Place (https://schema.org/Place)
 * - RealEstateListing (https://schema.org/RealEstateListing)
 * - PropertyValue (https://schema.org/PropertyValue)
 * - PostalAddress (https://schema.org/PostalAddress)
 * - MonetaryAmount (https://schema.org/MonetaryAmount)
 * - GeoCoordinates (https://schema.org/GeoCoordinates)
 * - Organization (https://schema.org/Organization)
 * - Person (https://schema.org/Person)
 */
import { z } from 'zod';
/**
 * Database representation of a property matching Prisma schema
 * Maps to Schema.org: Place + RealEstateListing hybrid
 */
export interface PropertyDatabase {
    id: string;
    propertyId: string;
    name: string;
    propType: string;
    city: string | null;
    propertyAddress: string;
    assessedValue: number | null;
    appraisedValue: number;
    geoId: string | null;
    description: string | null;
    searchTerm: string | null;
    scrapedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Property type enumeration based on common TCAD classifications
 * Maps to Schema.org: @type values for subtypes of Place/Residence
 */
export declare enum PropertyType {
    SINGLE_FAMILY = "Single Family",
    CONDO = "Condo",
    TOWNHOUSE = "Townhouse",
    MULTI_FAMILY = "Multi Family",
    COMMERCIAL = "Commercial",
    INDUSTRIAL = "Industrial",
    LAND = "Land",
    AGRICULTURAL = "Agricultural",
    MIXED_USE = "Mixed Use"
}
/**
 * API representation with Schema.org alignment
 * Enhanced with semantic annotations for structured data
 * Maps to Schema.org: RealEstateListing
 */
export interface PropertyAPI {
    '@context'?: 'https://schema.org';
    '@type'?: 'RealEstateListing' | 'Place' | 'Residence';
    '@id'?: string;
    id: string;
    propertyId: string;
    owner: PropertyOwner;
    propertyType: string;
    legalDescription?: string;
    address: PropertyAddress;
    geography?: PropertyGeography;
    valuation: PropertyValuation;
    metadata: PropertyMetadata;
}
/**
 * Property owner information
 * Maps to Schema.org: Person or Organization
 */
export interface PropertyOwner {
    '@type'?: 'Person' | 'Organization';
    name: string;
    type?: 'individual' | 'entity';
}
/**
 * Property address with full Schema.org PostalAddress alignment
 */
export interface PropertyAddress {
    '@type'?: 'PostalAddress';
    streetAddress: string;
    addressLocality?: string;
    addressRegion: string;
    addressCountry: string;
    postalCode?: string;
    formatted: string;
    shortFormat?: string;
}
/**
 * Geographic information for the property
 * Maps to Schema.org: GeoCoordinates + geo properties
 */
export interface PropertyGeography {
    '@type'?: 'GeoCoordinates';
    geoId?: string;
    latitude?: number;
    longitude?: number;
    elevation?: number;
    neighborhood?: string;
    schoolDistrict?: string;
    taxDistrict?: string;
    censusTract?: string;
}
/**
 * Property valuation information
 * Maps to Schema.org: PriceSpecification / PropertyValue
 */
export interface PropertyValuation {
    '@type'?: 'PropertyValue';
    assessedValue?: MonetaryAmount;
    appraisedValue: MonetaryAmount;
    landValue?: MonetaryAmount;
    improvementValue?: MonetaryAmount;
    taxableValue?: MonetaryAmount;
    exemptions?: TaxExemption[];
    valuationDate?: string;
    valuationMethod?: string;
}
/**
 * Monetary amount with currency
 * Maps to Schema.org: MonetaryAmount
 */
export interface MonetaryAmount {
    '@type'?: 'MonetaryAmount';
    value: number;
    currency: string;
    formatted?: string;
    abbreviated?: string;
}
/**
 * Tax exemption information
 */
export interface TaxExemption {
    type: string;
    amount: MonetaryAmount;
    percentage?: number;
}
/**
 * Property metadata for tracking and management
 */
export interface PropertyMetadata {
    searchTerm?: string;
    dataSource: string;
    scrapedAt: string;
    createdAt: string;
    updatedAt: string;
    dataFreshness?: 'current' | 'stale' | 'historical';
    lastVerified?: string;
}
export declare const scrapeRequestSchema: z.ZodObject<{
    searchTerm: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    searchTerm: string;
    userId?: string | undefined;
}, {
    searchTerm: string;
    userId?: string | undefined;
}>;
export declare const propertyFilterSchema: z.ZodObject<{
    searchTerm: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    propType: z.ZodOptional<z.ZodString>;
    minValue: z.ZodOptional<z.ZodNumber>;
    maxValue: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    propType?: string | undefined;
    city?: string | undefined;
    searchTerm?: string | undefined;
    minValue?: number | undefined;
    maxValue?: number | undefined;
}, {
    propType?: string | undefined;
    city?: string | undefined;
    searchTerm?: string | undefined;
    minValue?: number | undefined;
    maxValue?: number | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const naturalLanguageSearchSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    offset?: number | undefined;
}, {
    query: string;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const historyQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
}, {
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const monitorRequestSchema: z.ZodObject<{
    searchTerm: z.ZodString;
    frequency: z.ZodDefault<z.ZodEnum<["hourly", "daily", "weekly"]>>;
}, "strip", z.ZodTypeAny, {
    searchTerm: string;
    frequency: "hourly" | "daily" | "weekly";
}, {
    searchTerm: string;
    frequency?: "hourly" | "daily" | "weekly" | undefined;
}>;
export type ScrapeRequestBody = z.infer<typeof scrapeRequestSchema>;
export type PropertyFilters = z.infer<typeof propertyFilterSchema>;
export type NaturalLanguageSearchBody = z.infer<typeof naturalLanguageSearchSchema>;
export type HistoryQueryParams = z.infer<typeof historyQuerySchema>;
export type MonitorRequestBody = z.infer<typeof monitorRequestSchema>;
/**
 * Search parameters for querying properties
 */
export interface PropertySearchParams {
    query?: string;
    propertyTypes?: PropertyType[];
    cities?: string[];
    priceRange?: {
        min?: number;
        max?: number;
    };
    owner?: string;
    propertyId?: string;
    geoId?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'appraisedValue' | 'assessedValue' | 'address' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
}
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
    '@context'?: 'https://schema.org';
    '@type'?: 'SearchResultsPage';
    results: PropertyAPI[];
    pagination: PaginationMeta;
    aggregations?: {
        propertyTypes: Array<{
            type: string;
            count: number;
        }>;
        cities: Array<{
            city: string;
            count: number;
        }>;
        priceRanges: Array<{
            range: string;
            count: number;
        }>;
    };
}
export interface JobStatusResponse {
    id: string;
    status: string;
    progress: number;
    resultCount?: number;
    error?: string | null;
    createdAt: Date;
    completedAt: Date | null;
}
export interface StatsResponse {
    totalProperties: number;
    totalJobs: number;
    recentJobs: number;
    cityDistribution: Array<{
        city: string;
        _count: number;
    }>;
    propertyTypeDistribution: Array<{
        propType: string;
        _count: number;
        _avg: {
            appraisedValue: number | null;
        };
    }>;
}
/**
 * Transform database property to API format with Schema.org alignment
 */
export declare function transformPropertyToAPI(dbProperty: PropertyDatabase, includeSchemaContext?: boolean): PropertyAPI;
export declare function isPropertyDatabase(obj: any): obj is PropertyDatabase;
export declare function isPropertyAPI(obj: any): obj is PropertyAPI;
//# sourceMappingURL=property.types.d.ts.map