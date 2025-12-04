/**
 * React hook for analytics tracking
 */
import { useCallback } from "react";
import {
	type AnalyticsEvent,
	trackConversion,
	trackError,
	trackEvent,
	trackExampleQueryClick,
	trackPageView,
	trackPropertyView,
	trackSearch,
	trackSearchResults,
} from "../lib/analytics";

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
		[],
	);

	const logPropertyView = useCallback(
		(propertyId: string, propertyAddress?: string) => {
			trackPropertyView(propertyId, propertyAddress);
		},
		[],
	);

	const logError = useCallback(
		(errorMessage: string, errorContext?: string) => {
			trackError(errorMessage, errorContext);
		},
		[],
	);

	const logConversion = useCallback(
		(conversionType: string, value?: number) => {
			trackConversion(conversionType, value);
		},
		[],
	);

	const logPageView = useCallback((path: string, title?: string) => {
		trackPageView(path, title);
	}, []);

	return {
		track,
		logSearch,
		logExampleQueryClick,
		logSearchResults,
		logPropertyView,
		logPageView,
		logError,
		logConversion,
	};
};
