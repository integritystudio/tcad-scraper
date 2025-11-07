/**
 * React hook for analytics tracking
 */
import { useCallback } from 'react';
import {
  trackEvent,
  trackSearch,
  trackExampleQueryClick,
  trackSearchResults,
  trackPropertyView,
  trackError,
  trackConversion,
  type AnalyticsEvent,
} from '../lib/analytics';

export const useAnalytics = () => {
  const track = useCallback((event: AnalyticsEvent) => {
    trackEvent(event);
  }, []);

  const logSearch = useCallback((query: string, resultsCount?: number) => {
    trackSearch(query, resultsCount);
  }, []);

  const logExampleQueryClick = useCallback((query: string) => {
    trackExampleQueryClick(query);
  }, []);

  const logSearchResults = useCallback(
    (query: string, resultsCount: number, hasExplanation: boolean) => {
      trackSearchResults(query, resultsCount, hasExplanation);
    },
    []
  );

  const logPropertyView = useCallback((propertyId: string, propertyAddress?: string) => {
    trackPropertyView(propertyId, propertyAddress);
  }, []);

  const logError = useCallback((errorMessage: string, errorContext?: string) => {
    trackError(errorMessage, errorContext);
  }, []);

  const logConversion = useCallback((conversionType: string, value?: number) => {
    trackConversion(conversionType, value);
  }, []);

  return {
    track,
    logSearch,
    logExampleQueryClick,
    logSearchResults,
    logPropertyView,
    logError,
    logConversion,
  };
};
