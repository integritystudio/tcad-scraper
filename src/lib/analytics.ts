/**
 * Analytics utility functions for tracking user events
 * Integrates with Google Analytics and Meta Pixel
 */

// Extend the Window interface to include tracking functions
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export type EventCategory =
  | 'search'
  | 'navigation'
  | 'engagement'
  | 'conversion';

export interface AnalyticsEvent {
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
}

/**
 * Track a custom event to both GA and Meta Pixel
 */
export const trackEvent = (event: AnalyticsEvent): void => {
  const { category, action, label, value, metadata } = event;

  // Google Analytics 4 event
  if (window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
      ...metadata,
    });
  }

  // Meta Pixel custom event
  if (window.fbq) {
    window.fbq('trackCustom', action, {
      category,
      label,
      value,
      ...metadata,
    });
  }

  // Console log in development
  if (import.meta.env.DEV) {
    console.log('Analytics Event:', { category, action, label, value, metadata });
  }
};

/**
 * Track a search event
 */
export const trackSearch = (query: string, resultsCount?: number): void => {
  trackEvent({
    category: 'search',
    action: 'property_search',
    label: query,
    value: resultsCount,
    metadata: {
      search_term: query,
      results_count: resultsCount,
    },
  });

  // GA search event
  if (window.gtag) {
    window.gtag('event', 'search', {
      search_term: query,
    });
  }

  // Meta Pixel search event
  if (window.fbq) {
    window.fbq('track', 'Search', {
      search_string: query,
      content_category: 'property',
    });
  }
};

/**
 * Track when a user clicks an example query
 */
export const trackExampleQueryClick = (query: string): void => {
  trackEvent({
    category: 'engagement',
    action: 'example_query_clicked',
    label: query,
    metadata: {
      query_text: query,
    },
  });
};

/**
 * Track when search results are displayed
 */
export const trackSearchResults = (
  query: string,
  resultsCount: number,
  hasExplanation: boolean
): void => {
  trackEvent({
    category: 'search',
    action: 'search_results_displayed',
    label: query,
    value: resultsCount,
    metadata: {
      query: query,
      results_count: resultsCount,
      has_explanation: hasExplanation,
    },
  });
};

/**
 * Track when a user views property details
 */
export const trackPropertyView = (propertyId: string, propertyAddress?: string): void => {
  trackEvent({
    category: 'engagement',
    action: 'property_viewed',
    label: propertyAddress || propertyId,
    metadata: {
      property_id: propertyId,
      property_address: propertyAddress,
    },
  });

  // Meta Pixel content view
  if (window.fbq) {
    window.fbq('track', 'ViewContent', {
      content_name: propertyAddress || propertyId,
      content_category: 'property',
      content_ids: [propertyId],
      content_type: 'product',
    });
  }
};

/**
 * Track page view (automatically called on route change)
 */
export const trackPageView = (path: string): void => {
  if (window.gtag) {
    window.gtag('config', 'G-J7TL7PQH7S', {
      page_path: path,
    });
  }

  if (window.fbq) {
    window.fbq('track', 'PageView');
  }
};

/**
 * Track errors
 */
export const trackError = (errorMessage: string, errorContext?: string): void => {
  trackEvent({
    category: 'engagement',
    action: 'error_occurred',
    label: errorMessage,
    metadata: {
      error_message: errorMessage,
      error_context: errorContext,
    },
  });
};

/**
 * Track custom conversion events
 */
export const trackConversion = (conversionType: string, value?: number): void => {
  trackEvent({
    category: 'conversion',
    action: conversionType,
    value: value,
  });

  // Meta Pixel conversion
  if (window.fbq) {
    window.fbq('track', 'Lead', {
      content_name: conversionType,
      value: value,
      currency: 'USD',
    });
  }
};
