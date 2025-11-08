import {
  generatePropertyJsonLd,
  generatePropertyListJsonLd,
  generateOrganizationJsonLd,
} from '../json-ld.utils';
import { PropertyAPI, PaginatedPropertyResponse } from '../../types/property.types';

describe('JSON-LD Utils', () => {
  const mockProperty: PropertyAPI = {
    '@type': 'RealEstateListing',
    propertyId: 'TEST-123',
    address: {
      formatted: '123 Main St, Austin, TX 78701',
      streetAddress: '123 Main St',
      addressLocality: 'Austin',
      addressRegion: 'TX',
      addressCountry: 'US',
      postalCode: '78701',
    },
    propertyType: 'Residential',
    owner: {
      '@type': 'Person',
      name: 'John Doe',
    },
    valuation: {
      appraisedValue: {
        value: 500000,
        currency: 'USD',
        formatted: '$500,000',
      },
      assessedValue: {
        value: 450000,
        currency: 'USD',
        formatted: '$450,000',
      },
    },
    geography: {
      latitude: 30.2672,
      longitude: -97.7431,
      neighborhood: 'Downtown',
    },
    legalDescription: 'Lot 5, Block 3, Downtown Addition',
    metadata: {
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      scrapedAt: '2024-01-01T00:00:00Z',
      dataFreshness: 'fresh' as const,
    },
  };

  describe('generatePropertyJsonLd', () => {
    it('should generate valid property JSON-LD with all fields', () => {
      const result = generatePropertyJsonLd(mockProperty, 'TCAD', 'https://example.com');

      expect(result).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        '@id': 'https://example.com/properties/TEST-123',
        identifier: 'TEST-123',
        name: '123 Main St, Austin, TX 78701 - TCAD Property',
      });
    });

    it('should include address information', () => {
      const result = generatePropertyJsonLd(mockProperty) as any;

      expect(result.address).toEqual({
        '@type': 'PostalAddress',
        streetAddress: '123 Main St',
        addressLocality: 'Austin',
        addressRegion: 'TX',
        addressCountry: 'US',
        postalCode: '78701',
      });
    });

    it('should include geographic coordinates when available', () => {
      const result = generatePropertyJsonLd(mockProperty) as any;

      expect(result.geo).toEqual({
        '@type': 'GeoCoordinates',
        latitude: 30.2672,
        longitude: -97.7431,
      });
    });

    it('should include owner/seller information', () => {
      const result = generatePropertyJsonLd(mockProperty) as any;

      expect(result.seller).toEqual({
        '@type': 'Person',
        name: 'John Doe',
      });
    });

    it('should include pricing offers', () => {
      const result = generatePropertyJsonLd(mockProperty) as any;

      expect(result.offers).toMatchObject({
        '@type': 'Offer',
        price: 500000,
        priceCurrency: 'USD',
      });
    });

    it('should include both appraised and assessed values in price specifications', () => {
      const result = generatePropertyJsonLd(mockProperty) as any;

      expect(result.offers.priceSpecification).toHaveLength(2);
      expect(result.offers.priceSpecification[0]).toMatchObject({
        '@type': 'PriceSpecification',
        price: 500000,
        name: 'Appraised Value',
      });
      expect(result.offers.priceSpecification[1]).toMatchObject({
        '@type': 'PriceSpecification',
        price: 450000,
        name: 'Assessed Value',
      });
    });

    it('should work without optional fields', () => {
      const minimalProperty: PropertyAPI = {
        propertyId: 'MIN-123',
        address: {
          formatted: '456 Oak Ave',
          streetAddress: '456 Oak Ave',
          addressLocality: 'Austin',
          addressRegion: 'TX',
          addressCountry: 'US',
        },
        propertyType: 'Commercial',
        valuation: {
          appraisedValue: {
            value: 1000000,
            currency: 'USD',
            formatted: '$1,000,000',
          },
        },
        metadata: {
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          scrapedAt: '2024-01-01T00:00:00Z',
          dataFreshness: 'fresh' as const,
        },
      };

      const result = generatePropertyJsonLd(minimalProperty) as any;

      expect(result['@type']).toBe('RealEstateListing');
      expect(result.identifier).toBe('MIN-123');
      expect(result.geo).toBeUndefined();
      expect(result.seller).toBeUndefined();
    });
  });

  describe('generatePropertyListJsonLd', () => {
    const mockResponse: PaginatedPropertyResponse = {
      results: [mockProperty],
      pagination: {
        total: 1,
        offset: 0,
        limit: 20,
        hasMore: false,
      },
    };

    it('should generate valid ItemList JSON-LD', () => {
      const result = generatePropertyListJsonLd(mockResponse);

      expect(result).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        numberOfItems: 1,
      });
    });

    it('should include search query in name when provided', () => {
      const result = generatePropertyListJsonLd(mockResponse, 'Austin homes') as any;

      expect(result.name).toBe('Property Search Results for "Austin homes"');
    });

    it('should use default name when no search query', () => {
      const result = generatePropertyListJsonLd(mockResponse) as any;

      expect(result.name).toBe('Travis County Properties');
    });

    it('should include list items with correct positions', () => {
      const result = generatePropertyListJsonLd(mockResponse) as any;

      expect(result.itemListElement).toHaveLength(1);
      expect(result.itemListElement[0]).toMatchObject({
        '@type': 'ListItem',
        position: 1,
      });
    });

    it('should include item details for each property', () => {
      const result = generatePropertyListJsonLd(mockResponse) as any;

      expect(result.itemListElement[0].item).toMatchObject({
        '@type': 'RealEstateListing',
        '@id': 'https://example.com/properties/TEST-123',
        identifier: 'TEST-123',
        name: '123 Main St, Austin, TX 78701',
      });
    });

    it('should include nextItem when hasMore is true', () => {
      const responseWithMore: PaginatedPropertyResponse = {
        ...mockResponse,
        pagination: {
          ...mockResponse.pagination,
          hasMore: true,
        },
      };

      const result = generatePropertyListJsonLd(responseWithMore) as any;

      expect(result.nextItem).toBeDefined();
      expect(result.nextItem).toContain('offset=20');
    });

    it('should not include nextItem when hasMore is false', () => {
      const result = generatePropertyListJsonLd(mockResponse) as any;

      expect(result.nextItem).toBeUndefined();
    });

    it('should include search action', () => {
      const result = generatePropertyListJsonLd(mockResponse) as any;

      expect(result.potentialAction).toMatchObject({
        '@type': 'SearchAction',
        'query-input': 'required name=search_term_string',
      });
    });
  });

  describe('generateOrganizationJsonLd', () => {
    it('should generate valid WebSite JSON-LD with defaults', () => {
      const result = generateOrganizationJsonLd() as any;

      expect(result['@context']).toBe('https://schema.org');
      expect(result['@type']).toBe('WebSite');
      expect(result.name).toBeDefined();
      expect(result.url).toBeDefined();
    });

    it('should use custom website URL', () => {
      const result = generateOrganizationJsonLd('https://custom.com') as any;

      expect(result.url).toBe('https://custom.com');
    });

    it('should use custom organization name', () => {
      const result = generateOrganizationJsonLd('https://example.com', 'Custom TCAD') as any;

      expect(result.name).toBe('Custom TCAD');
    });

    it('should include description', () => {
      const result = generateOrganizationJsonLd() as any;

      expect(result.description).toBeDefined();
      expect(typeof result.description).toBe('string');
    });
  });
});
