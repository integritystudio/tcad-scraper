"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitorRequestSchema = exports.historyQuerySchema = exports.naturalLanguageSearchSchema = exports.propertyFilterSchema = exports.scrapeRequestSchema = exports.PropertyType = void 0;
exports.transformPropertyToAPI = transformPropertyToAPI;
exports.isPropertyDatabase = isPropertyDatabase;
exports.isPropertyAPI = isPropertyAPI;
const zod_1 = require("zod");
/**
 * Property type enumeration based on common TCAD classifications
 * Maps to Schema.org: @type values for subtypes of Place/Residence
 */
var PropertyType;
(function (PropertyType) {
    PropertyType["SINGLE_FAMILY"] = "Single Family";
    PropertyType["CONDO"] = "Condo";
    PropertyType["TOWNHOUSE"] = "Townhouse";
    PropertyType["MULTI_FAMILY"] = "Multi Family";
    PropertyType["COMMERCIAL"] = "Commercial";
    PropertyType["INDUSTRIAL"] = "Industrial";
    PropertyType["LAND"] = "Land";
    PropertyType["AGRICULTURAL"] = "Agricultural";
    PropertyType["MIXED_USE"] = "Mixed Use";
})(PropertyType || (exports.PropertyType = PropertyType = {}));
// ============================================================================
// Legacy Validation Schemas (Preserved for backward compatibility)
// ============================================================================
exports.scrapeRequestSchema = zod_1.z.object({
    searchTerm: zod_1.z.string().min(4, 'Search term must be at least 4 characters').max(100),
    userId: zod_1.z.string().optional(),
});
exports.propertyFilterSchema = zod_1.z.object({
    searchTerm: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    propType: zod_1.z.string().optional(),
    minValue: zod_1.z.coerce.number().optional(),
    maxValue: zod_1.z.coerce.number().optional(),
    limit: zod_1.z.coerce.number().min(1).max(1000).default(100),
    offset: zod_1.z.coerce.number().min(0).default(0),
});
exports.naturalLanguageSearchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1),
    limit: zod_1.z.number().min(1).max(1000).optional(),
    offset: zod_1.z.number().min(0).optional(),
});
exports.historyQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    offset: zod_1.z.coerce.number().min(0).default(0),
});
exports.monitorRequestSchema = zod_1.z.object({
    searchTerm: zod_1.z.string().min(1),
    frequency: zod_1.z.enum(['hourly', 'daily', 'weekly']).default('daily'),
});
// ============================================================================
// Transformation Utilities
// ============================================================================
/**
 * Transform database property to API format with Schema.org alignment
 */
function transformPropertyToAPI(dbProperty, includeSchemaContext = true) {
    const [streetAddress, ...addressParts] = dbProperty.propertyAddress.split(',').map(s => s.trim());
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
function getSchemaType(propType) {
    const commercialTypes = ['Commercial', 'Industrial', 'Mixed Use'];
    const residentialTypes = ['Single Family', 'Condo', 'Townhouse', 'Multi Family'];
    if (commercialTypes.includes(propType)) {
        return 'Place';
    }
    else if (residentialTypes.includes(propType)) {
        return 'Residence';
    }
    return 'RealEstateListing';
}
/**
 * Format currency for display
 */
function formatCurrency(value) {
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
function getDataFreshness(scrapedAt) {
    const daysSinceUpdate = (Date.now() - scrapedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7)
        return 'current';
    if (daysSinceUpdate < 30)
        return 'stale';
    return 'historical';
}
// ============================================================================
// Type Guards
// ============================================================================
function isPropertyDatabase(obj) {
    return obj &&
        typeof obj.propertyId === 'string' &&
        typeof obj.name === 'string' &&
        typeof obj.propType === 'string' &&
        typeof obj.propertyAddress === 'string' &&
        typeof obj.appraisedValue === 'number';
}
function isPropertyAPI(obj) {
    return obj &&
        typeof obj.propertyId === 'string' &&
        obj.owner &&
        obj.address &&
        obj.valuation;
}
//# sourceMappingURL=property.types.js.map