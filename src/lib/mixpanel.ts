import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

// Track whether Mixpanel was successfully initialized
let isInitialized = false;

// Initialize Mixpanel if token is configured
if (MIXPANEL_TOKEN) {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: import.meta.env.DEV,
    track_pageview: true,
    persistence: 'localStorage',
    autocapture: true,
    record_sessions_percent: 100,
  });
  isInitialized = true;
} else if (import.meta.env.DEV) {
  console.warn('Mixpanel token not configured - skipping initialization');
}

// Create a safe wrapper that only calls mixpanel methods if initialized
const safeMixpanel = {
  track: (eventName: string, properties?: Record<string, unknown>) => {
    if (isInitialized) {
      mixpanel.track(eventName, properties);
    }
  },
  identify: (id: string) => {
    if (isInitialized) {
      mixpanel.identify(id);
    }
  },
  people: {
    set: (properties: Record<string, unknown>) => {
      if (isInitialized) {
        mixpanel.people.set(properties);
      }
    },
  },
  register: (properties: Record<string, unknown>) => {
    if (isInitialized) {
      mixpanel.register(properties);
    }
  },
  reset: () => {
    if (isInitialized) {
      mixpanel.reset();
    }
  },
};

export default safeMixpanel;
