# TCAD Property Schema.org Type System Documentation

## Overview

This document describes the comprehensive TypeScript type system designed for the Travis County Appraisal District (TCAD) property scraper application. The type system aligns with Schema.org vocabulary to provide maximum SEO value and semantic clarity.

## Architecture

### Three-Layer Type System

1. **Database Layer** (`PropertyDatabase`) - Matches Prisma schema exactly
2. **API Layer** (`PropertyAPI`) - Enhanced with Schema.org properties
3. **Presentation Layer** (JSON-LD) - Full Schema.org structured data

## Schema.org Type Mapping

### Primary Schema.org Types Used

| TCAD Property Type | Schema.org Type | Use Case |
|-------------------|-----------------|----------|
| Single Family | `Residence` | Residential homes |
| Condo | `Residence` | Condominiums |
| Townhouse | `Residence` | Townhomes |
| Multi Family | `Residence` | Apartments/Duplexes |
| Commercial | `Place` | Business properties |
| Industrial | `Place` | Industrial facilities |
| Land | `RealEstateListing` | Vacant land |
| Agricultural | `Place` | Farms/Ranches |
| Mixed Use | `Place` | Mixed-use buildings |

### Property Components Schema Mapping

| Component | Schema.org Type | Properties |
|-----------|-----------------|------------|
| Address | `PostalAddress` | streetAddress, addressLocality, addressRegion, postalCode |
| Location | `GeoCoordinates` | latitude, longitude, elevation |
| Owner | `Person` / `Organization` | name, type |
| Valuation | `PropertyValue` / `MonetaryAmount` | value, currency |
| Tax Info | `PriceSpecification` | price, name, description |

## Type Definitions

### Core Types

```typescript
// Database representation (Prisma)
PropertyDatabase

// API representation (Frontend/Backend)
PropertyAPI

// Search/Filter types
PropertySearchParams
PaginatedPropertyResponse

// Supporting types
PropertyOwner
PropertyAddress
PropertyGeography
PropertyValuation
MonetaryAmount
TaxExemption
```

## Implementation Examples

### 1. Transform Database to API Format

```typescript
import { transformPropertyToAPI } from './types/property.types';

const dbProperty = await prisma.property.findUnique({
  where: { propertyId: 'TCAD-123456' }
});

const apiProperty = transformPropertyToAPI(dbProperty);
```

### 2. Generate JSON-LD for SEO

```typescript
import { generatePropertyJsonLd } from './utils/json-ld.utils';

const jsonLd = generatePropertyJsonLd(
  apiProperty,
  'Travis County Appraisal District',
  'https://example.com'
);

// Inject into HTML
const script = `<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>`;
```

### 3. API Response with Schema.org

```typescript
app.get('/api/properties/:id', async (req, res) => {
  const property = await getProperty(req.params.id);
  const apiProperty = transformPropertyToAPI(property);

  res.json({
    '@context': 'https://schema.org',
    ...apiProperty
  });
});
```

### 4. Property Listing Page

```typescript
app.get('/api/properties', async (req, res) => {
  const properties = await searchProperties(req.query);

  const response: PaginatedPropertyResponse = {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    results: properties.map(p => transformPropertyToAPI(p)),
    pagination: {
      total: totalCount,
      limit: 20,
      offset: 0,
      hasMore: true
    }
  };

  res.json(response);
});
```

## SEO Benefits

### Rich Results Eligibility

The Schema.org implementation enables:

1. **Property Rich Cards** - Enhanced search results with images, prices, and details
2. **Breadcrumb Navigation** - Clear site hierarchy in search results
3. **Site Search Box** - Direct search from Google results
4. **Knowledge Graph** - Entity recognition for properties and locations
5. **Local Search** - Enhanced local business/property listings

### Structured Data Features

- **Price Range Display** - Shows min/max prices in search results
- **Location Mapping** - Geographic coordinates for map integration
- **Owner Information** - Clear entity attribution
- **Tax Information** - Detailed financial breakdowns
- **Property Classifications** - Clear categorization for filtering

## JSON-LD Examples

### Individual Property

```json
{
  "@context": "https://schema.org",
  "@type": "RealEstateListing",
  "@id": "https://example.com/properties/TCAD-123456",
  "identifier": "TCAD-123456",
  "name": "123 Main St, Austin TX",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "Austin",
    "addressRegion": "TX",
    "addressCountry": "US",
    "postalCode": "78701"
  },
  "offers": {
    "@type": "Offer",
    "price": 450000,
    "priceCurrency": "USD"
  }
}
```

### Property Collection

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Austin Properties",
  "numberOfItems": 100,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "RealEstateListing",
        "identifier": "TCAD-123456",
        "name": "123 Main St"
      }
    }
  ]
}
```

## Validation

### Schema.org Validation Tools

1. **Google Rich Results Test**: https://search.google.com/test/rich-results
2. **Schema.org Validator**: https://validator.schema.org/
3. **Google Search Console**: Monitor rich results performance

### TypeScript Type Validation

```typescript
import { isPropertyAPI, isPropertyDatabase } from './types/property.types';

// Runtime type guards
if (isPropertyAPI(data)) {
  // Safe to use as PropertyAPI
}

// Compile-time validation with Zod
import { propertyFilterSchema } from './types/property.types';

const filters = propertyFilterSchema.parse(req.query);
```

## Best Practices

### 1. Always Include Context

```typescript
// Good
const property: PropertyAPI = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateListing',
  // ...
};

// Bad - missing context
const property = {
  propertyId: '123',
  // ...
};
```

### 2. Use Specific Schema Types

```typescript
// Good - specific type
'@type': 'Residence'  // for residential properties

// Bad - generic type
'@type': 'Thing'
```

### 3. Include All Recommended Properties

Essential properties for rich results:
- `name` - Property title
- `address` - Full postal address
- `offers.price` - Current value
- `geo` - Coordinates when available
- `image` - Property photos (when available)

### 4. Maintain Data Consistency

```typescript
// Ensure consistency between visible content and structured data
<h1>{property.address.formatted}</h1>  // Visible
"name": "123 Main St, Austin TX"       // Structured data matches
```

### 5. Update Timestamps

```typescript
metadata: {
  scrapedAt: new Date().toISOString(),
  dataFreshness: getDataFreshness(scrapedAt),
  lastVerified: new Date().toISOString()
}
```

## Migration Guide

### From Legacy Types to Schema.org Types

```typescript
// Legacy
interface OldProperty {
  property_id: string;
  owner_name: string;
  value: number;
}

// New Schema.org aligned
interface PropertyAPI {
  propertyId: string;
  owner: {
    '@type': 'Person',
    name: string;
  };
  valuation: {
    appraisedValue: {
      '@type': 'MonetaryAmount',
      value: number;
      currency: 'USD';
    };
  };
}
```

## Testing

### Unit Tests

```typescript
describe('Property Type Transformations', () => {
  it('should transform database property to API format', () => {
    const dbProperty: PropertyDatabase = mockDbProperty();
    const apiProperty = transformPropertyToAPI(dbProperty);

    expect(apiProperty['@context']).toBe('https://schema.org');
    expect(apiProperty['@type']).toMatch(/RealEstateListing|Residence|Place/);
    expect(apiProperty.address['@type']).toBe('PostalAddress');
  });
});
```

### Validation Tests

```typescript
describe('JSON-LD Validation', () => {
  it('should generate valid structured data', () => {
    const jsonLd = generatePropertyJsonLd(mockProperty);
    const errors = validateJsonLd(jsonLd);

    expect(errors).toHaveLength(0);
  });
});
```

## Performance Considerations

1. **Lazy Loading** - Include full Schema.org context only when needed
2. **Caching** - Cache transformed API responses
3. **Selective Fields** - Use `includeSchemaContext` parameter
4. **Batch Processing** - Transform multiple properties efficiently

## Future Enhancements

1. **Additional Schema Types**
   - `ApartmentComplex` for multi-family
   - `Office` for commercial properties
   - `Store` for retail properties

2. **Enhanced Geographic Data**
   - School district boundaries
   - Neighborhood polygons
   - Transit accessibility

3. **Historical Data**
   - `PriceSpecification` with date ranges
   - Value trend graphs
   - Tax history

4. **Images and Media**
   - `ImageObject` for property photos
   - `VideoObject` for virtual tours
   - `3DModel` for interactive views

## Resources

- [Schema.org Documentation](https://schema.org/)
- [Google Structured Data Guide](https://developers.google.com/search/docs/appearance/structured-data)
- [JSON-LD Specification](https://json-ld.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)