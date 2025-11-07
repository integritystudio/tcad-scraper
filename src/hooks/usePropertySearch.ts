import { useState, useCallback } from 'react';
import { Property } from '../types';
import { getApiBaseUrl } from '../lib/api-config';

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

interface UsePropertySearchReturn {
  results: Property[];
  loading: boolean;
  error: string;
  totalResults: number;
  explanation: string;
  search: (query: string, limit?: number) => Promise<void>;
  clearResults: () => void;
}

/**
 * Hook for property search functionality
 * Handles API calls, loading states, and error handling
 */
export const usePropertySearch = (): UsePropertySearchReturn => {
  const [results, setResults] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalResults, setTotalResults] = useState(0);
  const [explanation, setExplanation] = useState('');

  const search = useCallback(async (query: string, limit = 50) => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/properties/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Search failed' }));
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
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError('');
    setExplanation('');
    setTotalResults(0);
  }, []);

  return {
    results,
    loading,
    error,
    totalResults,
    explanation,
    search,
    clearResults,
  };
};
