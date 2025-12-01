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

// ============================================================================
// Database Level Types (Prisma/Backend)
// ============================================================================

/**
 * Database representation of a property matching Prisma schema
 * Maps to Schema.org: Place + RealEstateListing hybrid
 */
export interface PropertyDatabase {
  id: string;
  propertyId: string;           // TCAD unique identifier
  name: string;                 // Owner/taxpayer name
  propType: string;             // Property classification
  city: string | null;
  propertyAddress: string;
  assessedValue: number | null;  // Tax assessed value
  appraisedValue: number;        // Market appraised value
  geoId: string | null;          // Geographic identifier
  description: string | null;    // Legal description
  searchTerm: string | null;
  scrapedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Property type enumeration based on common TCAD classifications
 * Maps to Schema.org: @type values for subtypes of Place/Residence
 */
export enum PropertyType {
  SINGLE_FAMILY = 'Single Family',
  CONDO = 'Condo',
  TOWNHOUSE = 'Townhouse',
  MULTI_FAMILY = 'Multi Family',
  COMMERCIAL = 'Commercial',
  INDUSTRIAL = 'Industrial',
  LAND = 'Land',
  AGRICULTURAL = 'Agricultural',
  MIXED_USE = 'Mixed Use'
}

// ============================================================================
// API Level Types (Frontend/API Response)
// ============================================================================

/**
 * API representation with Schema.org alignment
 * Enhanced with semantic annotations for structured data
 * Maps to Schema.org: RealEstateListing
 */
export interface PropertyAPI {
  // Core identification
  '@context'?: 'https://schema.org';
  '@type'?: 'RealEstateListing' | 'Place' | 'Residence';
  '@id'?: string;               // Unique URI for this property

  id: string;
  propertyId: string;           // Schema.org: identifier

  // Ownership (Schema.org: seller/owner)
  owner: PropertyOwner;

  // Property details (Schema.org: name, description)
  propertyType: string;         // Schema.org: additionalType
  legalDescription?: string;    // Schema.org: description

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
  '@type'?: 'Person' | 'Organization';
  name: string;                 // Schema.org: name
  type?: 'individual' | 'entity'; // Determines Person vs Organization
}

/**
 * Property address with full Schema.org PostalAddress alignment
 */
export interface PropertyAddress {
  '@type'?: 'PostalAddress';
  streetAddress: string;        // Schema.org: streetAddress
  addressLocality?: string;     // Schema.org: addressLocality (city)
  addressRegion: string;        // Schema.org: addressRegion (state)
  addressCountry: string;       // Schema.org: addressCountry
  postalCode?: string;          // Schema.org: postalCode

  // Formatted versions
  formatted: string;            // Full formatted address
  shortFormat?: string;         // Abbreviated format for display
}

/**
 * Geographic information for the property
 * Maps to Schema.org: GeoCoordinates + geo properties
 */
export interface PropertyGeography {
  '@type'?: 'GeoCoordinates';
  geoId?: string;               // TCAD geographic identifier
  latitude?: number;            // Schema.org: latitude
  longitude?: number;           // Schema.org: longitude
  elevation?: number;           // Schema.org: elevation

  // Additional geographic context
  neighborhood?: string;        // Schema.org: containedInPlace
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
  valuationDate?: string;       // ISO 8601 date
  valuationMethod?: string;
}

/**
 * Monetary amount with currency
 * Maps to Schema.org: MonetaryAmount
 */
export interface MonetaryAmount {
  '@type'?: 'MonetaryAmount';
  value: number;                // Schema.org: value
  currency: string;             // Schema.org: currency (e.g., "USD")

  // Display helpers
  formatted?: string;           // e.g., "$450,000"
  abbreviated?: string;         // e.g., "$450K"
}

/**
 * Tax exemption information
 */
export interface TaxExemption {
  type: string;                 // e.g., "Homestead", "Senior", "Veteran"
  amount: MonetaryAmount;
  percentage?: number;          // If percentage-based exemption
}

/**
 * Property metadata for tracking and management
 */
export interface PropertyMetadata {
  searchTerm?: string;          // Search term that found this property
  dataSource: string;           // e.g., "TCAD"
  scrapedAt: string;           // ISO 8601 datetime
  createdAt: string;           // ISO 8601 datetime
  updatedAt: string;           // ISO 8601 datetime
  dataFreshness?: 'current' | 'stale' | 'historical';
  lastVerified?: string;        // ISO 8601 datetime
}

// ============================================================================
// Legacy Validation Schemas (Preserved for backward compatibility)
// ============================================================================

export const scrapeRequestSchema = z.object({
  searchTerm: z.string().min(4, 'Search term must be at least 4 characters').max(100),
  userId: z.string().optional(),
});

export const propertyFilterSchema = z.object({
  searchTerm: z.string().optional(),
  city: z.string().optional(),
  propType: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
});

export const naturalLanguageSearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const monitorRequestSchema = z.object({
  searchTerm: z.string().min(1),
  frequency: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
});

// Legacy type exports
export type ScrapeRequestBody = z.infer<typeof scrapeRequestSchema>;
export type PropertyFilters = z.infer<typeof propertyFilterSchema>;
export type NaturalLanguageSearchBody = z.infer<typeof naturalLanguageSearchSchema>;
export type HistoryQueryParams = z.infer<typeof historyQuerySchema>;
export type MonitorRequestBody = z.infer<typeof monitorRequestSchema>;

// ============================================================================
// Enhanced Search and Filter Types
// ============================================================================

/**
 * Search parameters for querying properties
 */
export interface PropertySearchParams {
  query?: string;               // Full text search
  propertyTypes?: PropertyType[];
  cities?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  owner?: string;
  propertyId?: string;
  geoId?: string;

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  sortBy?: 'appraisedValue' | 'assessedValue' | 'address' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
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
  '@context'?: 'https://schema.org';
  '@type'?: 'SearchResultsPage';

  results: PropertyAPI[];
  pagination: PaginationMeta;

  // Aggregations for filtering
  aggregations?: {
    propertyTypes: Array<{ type: string; count: number }>;
    cities: Array<{ city: string; count: number }>;
    priceRanges: Array<{ range: string; count: number }>;
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

// ============================================================================
// Natural Language Answer Types
// ============================================================================

/**
 * Type of answer generated for quantitative queries
 */
export type AnswerType = 'count' | 'statistical' | 'descriptive';

/**
 * Statistics for property search results
 * Used when answering quantitative questions
 */
export interface AnswerStatistics {
  avgValue?: number;
  totalValue?: number;
  priceRange?: {
    min: number;
    max: number;
  };
  topCity?: {
    name: string;
    count: number;
  };
  propertyTypes?: Array<{
    type: string;
    count: number;
  }>;
}

/**
 * Enhanced query response with natural language answer
 */
export interface NaturalLanguageQueryResponse {
  original: string;
  explanation: string;
  answer?: string;
  answerType?: AnswerType;
  statistics?: AnswerStatistics;
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

// ============================================================================
// Transformation Utilities
// ============================================================================

/**
 * Transform database property to API format with Schema.org alignment
 */
export function transformPropertyToAPI(
  dbProperty: PropertyDatabase,
  includeSchemaContext = true
): PropertyAPI {
  const [streetAddress] = dbProperty.propertyAddress.split(',').map(s => s.trim());

  return {
    ...(includeSchemaContext && {
      '@context': 'https://schema.org',
      '@type': getSchemaType(dbProperty.propType),
      '@id': `/properties/${dbProperty.propertyId}`
    }),

    id: dbProperty.id,
    propertyId: dbProperty.propertyId,

    owner: {
      '@type': dbProperty.name.includes('LLC') || dbProperty.name.includes('INC')
        ? 'Organization'
        : 'Person',
      name: dbProperty.name,
      type: dbProperty.name.includes('LLC') || dbProperty.name.includes('INC')
        ? 'entity'
        : 'individual'
    },

    propertyType: dbProperty.propType,
    legalDescription: dbProperty.description || undefined,

    address: {
      '@type': 'PostalAddress',
      streetAddress,
      addressLocality: dbProperty.city || 'Austin',
      addressRegion: 'TX',
      addressCountry: 'US',
      formatted: dbProperty.propertyAddress,
      shortFormat: `${streetAddress}, ${dbProperty.city || 'Austin'}`
    },

    geography: dbProperty.geoId ? {
      '@type': 'GeoCoordinates',
      geoId: dbProperty.geoId
    } : undefined,

    valuation: {
      '@type': 'PropertyValue',
      assessedValue: dbProperty.assessedValue ? {
        '@type': 'MonetaryAmount',
        value: dbProperty.assessedValue,
        currency: 'USD',
        formatted: formatCurrency(dbProperty.assessedValue)
      } : undefined,
      appraisedValue: {
        '@type': 'MonetaryAmount',
        value: dbProperty.appraisedValue,
        currency: 'USD',
        formatted: formatCurrency(dbProperty.appraisedValue)
      }
    },

    metadata: {
      searchTerm: dbProperty.searchTerm || undefined,
      dataSource: 'TCAD',
      scrapedAt: dbProperty.scrapedAt.toISOString(),
      createdAt: dbProperty.createdAt.toISOString(),
      updatedAt: dbProperty.updatedAt.toISOString(),
      dataFreshness: getDataFreshness(dbProperty.scrapedAt)
    }
  };
}

/**
 * Get appropriate Schema.org type based on property type
 */
function getSchemaType(propType: string): 'RealEstateListing' | 'Place' | 'Residence' {
  const commercialTypes = ['Commercial', 'Industrial', 'Mixed Use'];
  const residentialTypes = ['Single Family', 'Condo', 'Townhouse', 'Multi Family'];

  if (commercialTypes.includes(propType)) {
    return 'Place';
  } else if (residentialTypes.includes(propType)) {
    return 'Residence';
  }
  return 'RealEstateListing';
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Determine data freshness based on scrape date
 */
function getDataFreshness(scrapedAt: Date): 'current' | 'stale' | 'historical' {
  const daysSinceUpdate = (Date.now() - scrapedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate < 7) return 'current';
  if (daysSinceUpdate < 30) return 'stale';
  return 'historical';
}

// ============================================================================
// Type Guards
// ============================================================================

export function isPropertyDatabase(obj: unknown): obj is PropertyDatabase {
  return obj !== null &&
    typeof obj === 'object' &&
    'propertyId' in obj &&
    typeof obj.propertyId === 'string' &&
    'name' in obj &&
    typeof obj.name === 'string' &&
    'propType' in obj &&
    typeof obj.propType === 'string' &&
    'propertyAddress' in obj &&
    typeof obj.propertyAddress === 'string' &&
    'appraisedValue' in obj &&
    typeof obj.appraisedValue === 'number';
}

export function isPropertyAPI(obj: unknown): obj is PropertyAPI {
  return obj !== null &&
    typeof obj === 'object' &&
    'propertyId' in obj &&
    typeof obj.propertyId === 'string' &&
    'owner' in obj &&
    'address' in obj &&
    'valuation' in obj;
}