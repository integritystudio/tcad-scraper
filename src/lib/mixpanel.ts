import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

// Initialize Mixpanel if token is configured
if (MIXPANEL_TOKEN) {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: import.meta.env.DEV,
    track_pageview: true,
    persistence: 'localStorage',
    autocapture: true,
    record_sessions_percent: 100,
  });
} else if (import.meta.env.DEV) {
  console.warn('Mixpanel token not configured - skipping initialization');
}

export default mixpanel;
