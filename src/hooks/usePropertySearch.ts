import { useState, useCallback, useEffect } from 'react';
import { Property, AnswerStatistics, AnswerType, AnswerBoxState } from '../types';
import { getApiBaseUrl } from '../lib/api-config';
import mixpanel from '../lib/mixpanel';

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
    answer?: string;
    answerType?: AnswerType;
    statistics?: AnswerStatistics;
  };
}

interface UsePropertySearchReturn {
  results: Property[];
  loading: boolean;
  error: string;
  totalResults: number;
  explanation: string;
  answer: string;
  answerType: AnswerType | null;
  answerState: AnswerBoxState;
  statistics: AnswerStatistics | undefined;
  search: (query: string, limit?: number) => Promise<void>;
  clearResults: () => void;
  initialLoad: boolean;
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
  const [initialLoad, setInitialLoad] = useState(true);
  const [answer, setAnswer] = useState('');
  const [answerType, setAnswerType] = useState<AnswerType | null>(null);
  const [answerState, setAnswerState] = useState<AnswerBoxState>('idle');
  const [statistics, setStatistics] = useState<AnswerStatistics | undefined>(undefined);

  const search = useCallback(async (query: string, limit = 50) => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setAnswerState('loading');

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

      // Track search event
      mixpanel.track('Search', {
        search_query: query,
        results_count: data.pagination.total,
      });

      // Set answer-related state
      setAnswer(data.query?.answer || '');
      setAnswerType(data.query?.answerType || null);
      setStatistics(data.query?.statistics);

      // Determine answer state
      if (data.query?.answer) {
        if (data.pagination.total === 0) {
          setAnswerState('no-results');
        } else {
          setAnswerState('success');
        }
      } else {
        setAnswerState('idle');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setResults([]);
      setAnswerState('error');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError('');
    setExplanation('');
    setTotalResults(0);
    setAnswer('');
    setAnswerType(null);
    setAnswerState('idle');
    setStatistics(undefined);
  }, []);

  // Load initial properties on mount
  useEffect(() => {
    const loadInitialProperties = async () => {
      setLoading(true);
      try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/properties?limit=50`);

        if (!response.ok) {
          throw new Error('Failed to load properties');
        }

        const data = await response.json();

        if (data && data.data && data.pagination) {
          setResults(data.data);
          setTotalResults(data.pagination.total);
          setExplanation('Showing all properties');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load properties';
        setError(errorMessage);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };

    loadInitialProperties();
  }, []);

  return {
    results,
    loading,
    error,
    totalResults,
    explanation,
    answer,
    answerType,
    answerState,
    statistics,
    search,
    clearResults,
    initialLoad,
  };
};
