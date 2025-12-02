import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel
mixpanel.init('125ec36aa2e3ca596fab8f7d8bf9e902', {
  debug: import.meta.env.DEV,
  track_pageview: true,
  persistence: 'localStorage',
  autocapture: true,
  record_sessions_percent: 100,
});

export default mixpanel;
