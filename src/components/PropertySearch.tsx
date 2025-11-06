import { useState, useMemo } from 'react';
import { Property } from '../types';
import { getApiBaseUrl } from '../lib/api-config';
import './PropertySearch.css';

interface SearchResult {
  data: Property[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  query?: {
    original: string;
    explanation: string;
  };
}

export default function PropertySearch() {
  // Load API URL from secure server-passed configuration
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [totalResults, setTotalResults] = useState(0);

  const exampleQueries = [
    'properties in Austin worth over $500k',
    'commercial properties owned by Smith',
    'show me the most expensive residential properties',
    'properties on Congress Ave',
    'find properties appraised between $300k and $600k',
  ];

  const handleSearch = async (query?: string) => {
    const searchText = query || searchQuery;
    if (!searchText.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/properties/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchText, limit: 50 }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Search failed' }));
        throw new Error(errorData.message || 'Search failed');
      }

      const data: SearchResult = await response.json();

      if (!data || !data.data || !data.pagination) {
        throw new Error('Received invalid data from server');
      }

      setResults(data.data);
      setTotalResults(data.pagination.total);
      setExplanation(data.query?.explanation || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="property-search">
      <div className="search-hero">
        <div className="search-header">
          <h1>TCAD Property Explorer</h1>
          <p className="subtitle">Search 122,000+ Travis County properties using natural language</p>
        </div>

        <div className="search-container">
          <div className="search-box">
            <div className="search-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask anything... e.g., 'properties in Austin worth over $500k'"
              className="search-input"
              disabled={loading}
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading || !searchQuery.trim()}
              className="search-button"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="example-queries">
            <span className="example-label">Try:</span>
            {exampleQueries.map((example, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSearchQuery(example);
                  handleSearch(example);
                }}
                className="example-chip"
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {explanation && (
        <div className="search-explanation">
          <div className="explanation-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
          <span>{explanation}</span>
          <span className="result-count">({totalResults} results)</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="results-section">
          <div className="results-grid">
            {results.map((property) => (
              <div key={property.id} className="property-card">
                <div className="property-header">
                  <h3 className="property-owner">{property.name}</h3>
                  <span className="property-type-badge">{property.prop_type}</span>
                </div>
                <div className="property-address">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {property.property_address}
                  {property.city && `, ${property.city}`}
                </div>
                <div className="property-details">
                  <div className="detail-item">
                    <span className="detail-label">Appraised Value</span>
                    <span className="detail-value">{formatCurrency(property.appraised_value)}</span>
                  </div>
                  {property.assessed_value && (
                    <div className="detail-item">
                      <span className="detail-label">Assessed Value</span>
                      <span className="detail-value">{formatCurrency(property.assessed_value)}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Property ID</span>
                    <span className="detail-value mono">{property.property_id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {results.length < totalResults && (
            <div className="load-more">
              <p>Showing {results.length} of {totalResults} results</p>
              <button className="load-more-button">Load More</button>
            </div>
          )}
        </div>
      )}

      {!loading && !error && results.length === 0 && searchQuery && (
        <div className="no-results">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <h3>No properties found</h3>
          <p>Try adjusting your search query or using one of the examples above</p>
        </div>
      )}
    </div>
  );
}
