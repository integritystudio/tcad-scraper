# Analytics Implementation Guide

**Last Updated:** 2025-11-08
**Status:** ✅ Production Ready
**Tracking IDs:**
- Google Analytics 4: `G-J7TL7PQH7S`
- Google Tag Manager: `G-ECH51H8L2Z`
- Meta Pixel: `25629020546684786`

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tracked Events](#tracked-events)
4. [Implementation Details](#implementation-details)
5. [GA4 Dashboard Setup](#ga4-dashboard-setup)
6. [Meta Pixel Configuration](#meta-pixel-configuration)
7. [Development & Testing](#development--testing)
8. [Troubleshooting](#troubleshooting)
9. [Privacy & Compliance](#privacy--compliance)
10. [Best Practices](#best-practices)

---

## Overview

The TCAD Scraper application implements comprehensive analytics tracking using both Google Analytics 4 (GA4) and Meta Pixel to monitor user behavior, search patterns, and application performance.

### Key Features

- **Dual Platform Tracking:** GA4 for detailed analytics + Meta Pixel for marketing insights
- **User Journey Tracking:** From page view → search → results → property views
- **Error Monitoring:** Automatic tracking of React errors via ErrorBoundary
- **Development Mode:** Console logging for debugging (disabled in production)
- **Performance Optimized:** Async script loading, minimal overhead
- **Type Safe:** Full TypeScript coverage

### Implementation Status

| Component | Status | Events Tracked |
|-----------|--------|----------------|
| Analytics Library | ✅ Complete | All 7 event types |
| React Hook | ✅ Complete | Memoized callbacks |
| Tracking Scripts | ✅ Complete | GA4 + Meta Pixel |
| PropertySearchContainer | ✅ Complete | search, search_results, error |
| PropertyCard | ✅ Complete | property_view |
| ExampleQueries | ✅ Complete | example_query_click |
| App (Root) | ✅ Complete | page_view |
| ErrorBoundary | ✅ Complete | error |

---

## Architecture

### High-Level Flow

```
User Action
    ↓
React Component (uses useAnalytics hook)
    ↓
Analytics Library (src/lib/analytics.ts)
    ↓
    ├─→ Google Analytics 4 (gtag)
    └─→ Meta Pixel (fbq)
```

### File Structure

```
tcad-scraper/
├── index.html                          # Tracking scripts loaded here
├── src/
│   ├── lib/
│   │   └── analytics.ts                # Core analytics library (201 lines)
│   ├── hooks/
│   │   ├── useAnalytics.ts            # React hook wrapper (58 lines)
│   │   └── index.ts                   # Hook exports
│   ├── components/
│   │   ├── ErrorBoundary.tsx          # Error tracking component
│   │   ├── App.tsx                    # Page view tracking
│   │   └── features/PropertySearch/
│   │       ├── PropertySearchContainer.tsx  # Search tracking
│   │       ├── PropertyCard.tsx             # Property view tracking
│   │       └── ExampleQueries.tsx           # Example click tracking
└── docs/
    └── ANALYTICS.md                    # This file
```

### Dependencies

```json
{
  "runtime": [
    "Google Analytics 4 gtag.js",
    "Meta Pixel fbevents.js"
  ],
  "development": [
    "TypeScript",
    "React 18+",
    "Vite"
  ]
}
```

---

## Tracked Events

### Event Summary

| Event Name | Trigger | Frequency | Parameters |
|------------|---------|-----------|------------|
| `page_view` | App mount | Once per session | `page_title`, `page_location` |
| `search` | User submits search | Per search | `search_term` |
| `search_results` | Results returned | Per search | `result_count`, `has_explanation`, `search_term` |
| `property_view` | Property card rendered | Per property | `property_id`, `account_number` |
| `example_query_click` | Example query clicked | Per click | `query_text` |
| `error` | React error occurs | Per error | `error_message`, `component_stack`, `error_severity` |
| `engagement` | Custom interactions | Variable | Custom parameters |

### Event Details

#### 1. Page View (`page_view`)

**When:** Application first loads
**Where:** `src/App.tsx` (useEffect on mount)
**Purpose:** Track initial page loads and sessions

```typescript
// Automatically tracked on app mount
useEffect(() => {
  logPageView();
}, [logPageView]);
```

**GA4 Parameters:**
- `page_title`: "TCAD Property Analytics"
- `page_location`: Current URL
- `page_path`: URL path

#### 2. Search (`search`)

**When:** User submits a property search query
**Where:** `src/components/features/PropertySearch/PropertySearchContainer.tsx`
**Purpose:** Track what users are searching for

```typescript
const handleSearch = async () => {
  logSearch(query); // Track search initiation
  // ... search logic
};
```

**GA4 Parameters:**
- `search_term`: The user's search query

**Meta Pixel:** Tracked as custom event `Search`

#### 3. Search Results (`search_results`)

**When:** Search API returns results
**Where:** `src/components/features/PropertySearch/PropertySearchContainer.tsx`
**Purpose:** Track search success/failure and result quality

```typescript
const result = await searchProperties(query);
logSearchResults(
  query,
  result.count,
  !!result.explanation
);
```

**GA4 Parameters:**
- `search_term`: Original search query
- `result_count`: Number of properties returned
- `has_explanation`: Whether AI explanation was generated

**Business Value:** Identify unsuccessful searches (0 results) to improve search algorithm

#### 4. Property View (`property_view`)

**When:** Property card component renders
**Where:** `src/components/features/PropertySearch/PropertyCard.tsx`
**Purpose:** Track which properties users are viewing

```typescript
useEffect(() => {
  if (property.prop_id && property.account_num) {
    logPropertyView(property.prop_id, property.account_num);
  }
}, [property.prop_id, property.account_num, logPropertyView]);
```

**GA4 Parameters:**
- `property_id`: TCAD property ID
- `account_number`: TCAD account number

**Business Value:** Identify popular properties and user browsing patterns

#### 5. Example Query Click (`example_query_click`)

**When:** User clicks a pre-defined example query
**Where:** `src/components/features/PropertySearch/ExampleQueries.tsx`
**Purpose:** Track which examples help users get started

```typescript
const handleExampleClick = (query: string) => {
  logExampleQueryClick(query);
  onQuerySelect(query);
};
```

**GA4 Parameters:**
- `query_text`: The example query that was clicked

**Business Value:** Optimize example queries based on usage

#### 6. Error (`error`)

**When:** Uncaught React error occurs
**Where:** `src/components/ErrorBoundary.tsx`
**Purpose:** Monitor application stability

```typescript
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  trackError(
    error.message,
    errorInfo.componentStack || 'Unknown',
    'high'
  );
}
```

**GA4 Parameters:**
- `error_message`: Error message text
- `component_stack`: React component stack trace
- `error_severity`: 'low' | 'medium' | 'high'

**Business Value:** Proactive bug detection and user experience monitoring

#### 7. Engagement (`engagement`)

**When:** Custom user interactions
**Where:** Available for future use
**Purpose:** Track custom engagement metrics

```typescript
// Example usage (not currently implemented)
logEngagement({
  interaction_type: 'share_property',
  property_id: '12345'
});
```

---

## Implementation Details

### Analytics Library (`src/lib/analytics.ts`)

The core analytics library provides type-safe, environment-aware tracking functions.

**Key Features:**
- Environment detection (development vs production)
- Console logging in development mode
- Type-safe event parameters
- Dual platform support (GA4 + Meta)

**Core Functions:**

```typescript
// Generic event tracking
export const trackEvent = (
  eventName: string,
  parameters?: Record<string, any>
): void

// Specialized tracking functions
export const trackPageView = (): void
export const trackSearch = (searchTerm: string): void
export const trackSearchResults = (
  searchTerm: string,
  resultCount: number,
  hasExplanation: boolean
): void
export const trackPropertyView = (
  propertyId: string,
  accountNumber: string
): void
export const trackExampleQueryClick = (queryText: string): void
export const trackError = (
  errorMessage: string,
  componentStack: string,
  severity: 'low' | 'medium' | 'high'
): void
export const trackEngagement = (
  parameters: Record<string, any>
): void
```

**Environment Handling:**

```typescript
const isDevelopment = import.meta.env.DEV;

if (isDevelopment) {
  console.log(`[Analytics Event: ${eventName}]`, parameters);
}

// Only send to analytics in production or if gtag is available
if (typeof window.gtag === 'function') {
  window.gtag('event', eventName, parameters);
}
```

### React Hook (`src/hooks/useAnalytics.ts`)

Provides memoized analytics callbacks for use in React components.

**Usage:**

```typescript
import { useAnalytics } from '@/hooks';

function MyComponent() {
  const { logSearch, logSearchResults } = useAnalytics();

  const handleSearch = async (query: string) => {
    logSearch(query);
    const results = await api.search(query);
    logSearchResults(query, results.length, false);
  };

  return <SearchForm onSearch={handleSearch} />;
}
```

**Performance Optimization:**

All callbacks are memoized with `useCallback` to prevent unnecessary re-renders:

```typescript
const logSearch = useCallback((searchTerm: string) => {
  trackSearch(searchTerm);
}, []);
```

### Tracking Scripts (`index.html`)

Both tracking scripts are loaded in the `<head>` section for early initialization.

**Google Analytics 4:**

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-J7TL7PQH7S"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-J7TL7PQH7S', {
    'send_page_view': false  // Manual page view tracking
  });
</script>
```

**Why `send_page_view: false`?**
- Prevents automatic page view tracking
- Allows manual tracking in React app lifecycle
- Provides control over when page_view fires

**Meta Pixel:**

```html
<!-- Meta Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '25629020546684786');
  fbq('track', 'PageView');
</script>
```

**No-Script Fallback:**

```html
<noscript>
  <img height="1" width="1" style="display:none"
       src="https://www.facebook.com/tr?id=25629020546684786&ev=PageView&noscript=1" />
</noscript>
```

---

## GA4 Dashboard Setup

### Accessing Your Dashboard

1. **Login:** https://analytics.google.com/
2. **Select Property:** TCAD Scraper (G-J7TL7PQH7S)
3. **Navigation:** Reports → Real-time (for testing) or Reports → Events (for historical data)

### Custom Reports Configuration

#### 1. Search Performance Report

**Purpose:** Analyze search behavior and success rates

**Steps:**
1. Navigate to **Explore** → **Create new exploration**
2. **Template:** Free form
3. **Dimensions:**
   - Event name
   - search_term
   - result_count
   - has_explanation
4. **Metrics:**
   - Event count
   - Users
   - Sessions
5. **Filters:**
   - Event name = `search` OR `search_results`

**Insights:**
- Which search terms are most popular
- Success rate (searches with results > 0)
- Average results per search
- Searches that generated AI explanations

#### 2. Property Engagement Report

**Purpose:** Identify most viewed properties

**Steps:**
1. Navigate to **Explore** → **Create new exploration**
2. **Template:** Free form
3. **Dimensions:**
   - property_id
   - account_number
4. **Metrics:**
   - Event count (property_view)
   - Unique users
5. **Filters:**
   - Event name = `property_view`

**Insights:**
- Most popular properties
- Property view frequency
- User engagement patterns

#### 3. User Journey Funnel

**Purpose:** Track user flow from search to property view

**Steps:**
1. Navigate to **Explore** → **Funnel exploration**
2. **Steps:**
   - Step 1: page_view
   - Step 2: search
   - Step 3: search_results (result_count > 0)
   - Step 4: property_view
3. **Breakdown:** By date, device, location

**Insights:**
- Drop-off rates at each step
- Conversion from search to property view
- User engagement funnel

#### 4. Error Monitoring Report

**Purpose:** Track application errors and stability

**Steps:**
1. Navigate to **Explore** → **Create new exploration**
2. **Dimensions:**
   - error_message
   - error_severity
   - component_stack
3. **Metrics:**
   - Event count
   - Affected users
4. **Filters:**
   - Event name = `error`

**Insights:**
- Most common errors
- Error frequency trends
- Impact on user sessions

### Setting Up Conversion Goals

#### Goal 1: Successful Search

**Definition:** User performs search with results
**Configuration:**
1. **Admin** → **Events** → **Mark as conversion**
2. Event: `search_results`
3. Condition: `result_count > 0`

#### Goal 2: Property Engagement

**Definition:** User views at least one property
**Configuration:**
1. **Admin** → **Events** → **Mark as conversion**
2. Event: `property_view`

#### Goal 3: Example Query Usage

**Definition:** User engages with example queries
**Configuration:**
1. **Admin** → **Events** → **Mark as conversion**
2. Event: `example_query_click`

### Custom Alerts

#### Alert 1: Error Spike

**Trigger:** Error events increase by 50% over 7-day average
**Setup:**
1. **Admin** → **Custom Alerts** → **New Alert**
2. Alert condition: Event `error` count > 150% of baseline
3. Period: Daily
4. Email: Development team

#### Alert 2: Zero Results Searches

**Trigger:** Searches with 0 results exceed 30%
**Setup:**
1. Create custom metric: `zero_result_rate`
2. Formula: `search_results (result_count=0) / search`
3. Alert when > 0.30
4. Period: Weekly

### Key Metrics to Monitor

| Metric | Location | Interpretation |
|--------|----------|----------------|
| Active Users | Real-time → Overview | Current site traffic |
| Total Searches | Events → search | Search volume |
| Avg Results per Search | Custom → search_results.result_count | Search quality |
| Property Views per Session | Engagement → property_view / sessions | User engagement |
| Error Rate | Events → error / page_view | Application stability |
| Example Click Rate | example_query_click / page_view | Feature adoption |

---

## Meta Pixel Configuration

### Accessing Events Manager

1. **Login:** https://business.facebook.com/events_manager
2. **Select Pixel:** 25629020546684786
3. **View Events:** Test Events (real-time) or Activity (historical)

### Standard Events

Meta Pixel automatically receives these events from the analytics library:

| Standard Event | Custom Event Mapping | Purpose |
|----------------|---------------------|---------|
| PageView | Automatic | Track page loads |
| Search | `search` | Track property searches |
| ViewContent | `property_view` | Track property views |

### Custom Conversions

#### Conversion 1: Successful Property Search

**Purpose:** Track searches that return results
**Setup:**
1. **Events Manager** → **Custom Conversions** → **Create Custom Conversion**
2. Name: "Successful Property Search"
3. Event: `search_results`
4. Parameter: `result_count` greater than 0
5. Category: Search

#### Conversion 2: High Engagement Session

**Purpose:** Track users who view multiple properties
**Setup:**
1. Name: "High Engagement"
2. Event: `property_view`
3. Condition: Event count > 5 per session
4. Category: Engagement

### Meta Pixel Helper

**Browser Extension:** https://chrome.google.com/webstore (search "Meta Pixel Helper")

**Benefits:**
- Real-time event verification
- Pixel status monitoring
- Event parameter inspection
- Troubleshooting assistance

**Usage:**
1. Install extension
2. Navigate to http://localhost:4174/ (preview) or production URL
3. Click extension icon
4. Verify pixel is firing and events are tracked

---

## Development & Testing

### Development Mode

Analytics automatically detects development environment and enables console logging.

**Console Output Format:**

```
[Analytics Event: search] { search_term: "123 Main St" }
[Analytics Event: search_results] { search_term: "123 Main St", result_count: 5, has_explanation: true }
[Analytics Event: property_view] { property_id: "123456", account_number: "R012345" }
```

**Benefits:**
- Verify events fire correctly
- Inspect event parameters
- Debug tracking issues
- No pollution of production analytics

### Testing Workflow

#### 1. Local Development Testing

```bash
# Start dev server
npm run dev

# Open http://localhost:5173
# Open DevTools Console (F12)
# Perform actions and verify console logs
```

**Checklist:**
- [ ] Page load triggers `page_view`
- [ ] Search triggers `search` and `search_results`
- [ ] Viewing properties triggers `property_view`
- [ ] Clicking examples triggers `example_query_click`

#### 2. Production Build Testing

```bash
# Build production bundle
npm run build

# Preview production build
npm run preview

# Open http://localhost:4174
# Open DevTools Network tab
# Filter: google-analytics, facebook
```

**Checklist:**
- [ ] No console logs (production mode)
- [ ] Requests to `google-analytics.com/g/collect`
- [ ] Requests to `facebook.com/tr`
- [ ] All requests return 200 OK
- [ ] Event parameters sent correctly

#### 3. GA4 Real-Time Verification

```bash
# With preview server running:
# 1. Open https://analytics.google.com/
# 2. Select property G-J7TL7PQH7S
# 3. Navigate to Reports → Real-time → Events
# 4. Perform actions in app
# 5. Watch events appear in dashboard (5-10 second delay)
```

**Expected Events:**
- page_view (on load)
- search (on search submit)
- search_results (after API response)
- property_view (on card render)
- example_query_click (on example click)

#### 4. Meta Pixel Verification

```bash
# Install Meta Pixel Helper extension
# Navigate to preview/production site
# Click extension icon
# Verify "Pixel is active" status
# Check event list matches user actions
```

### Automated Testing

Currently, analytics are **not** unit tested to avoid polluting test analytics data.

**To add tests in the future:**

```typescript
// Mock analytics in tests
jest.mock('@/lib/analytics', () => ({
  trackSearch: jest.fn(),
  trackSearchResults: jest.fn(),
  // ... other functions
}));

// Verify tracking calls
import { trackSearch } from '@/lib/analytics';

test('tracks search on submit', () => {
  const { getByRole } = render(<SearchForm />);
  fireEvent.click(getByRole('button'));
  expect(trackSearch).toHaveBeenCalledWith('test query');
});
```

---

## Troubleshooting

### Events Not Appearing in GA4

**Symptom:** No events in Real-Time dashboard

**Checklist:**
1. ✅ Verify tracking ID: `G-J7TL7PQH7S`
2. ✅ Check Network tab for requests to `google-analytics.com`
3. ✅ Ensure requests return 200 OK (not 400/500)
4. ✅ Disable ad blockers (e.g., uBlock Origin, Privacy Badger)
5. ✅ Wait 30-60 seconds (slight delay is normal)
6. ✅ Verify `gtag.js` loaded successfully (Network → JS)
7. ✅ Check browser console for JavaScript errors

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Ad blocker blocking gtag.js | Disable or whitelist domain |
| CORS errors | Verify script loaded from correct domain |
| gtag is not a function | Check script loaded before app |
| Wrong measurement ID | Verify `G-J7TL7PQH7S` in config |

### Events Not Appearing in Meta Pixel

**Symptom:** No events in Test Events tool

**Checklist:**
1. ✅ Verify pixel ID: `25629020546684786`
2. ✅ Check Network tab for requests to `facebook.com/tr`
3. ✅ Disable privacy tools (e.g., Facebook Container)
4. ✅ Install Meta Pixel Helper extension
5. ✅ Verify `fbq` function is defined
6. ✅ Check for iOS tracking prevention

**Common Issues:**

| Issue | Solution |
|-------|----------|
| iOS 14.5+ tracking prevention | Use Aggregated Event Measurement |
| Firefox tracking protection | Disable Enhanced Tracking Protection |
| fbq is not defined | Verify pixel script loaded |
| Events delayed | Allow 5-10 minutes for processing |

### Console Logs in Production

**Symptom:** Analytics console logs appearing in production

**Cause:** Environment detection failing

**Solution:**

```typescript
// Verify environment detection
console.log('Environment:', import.meta.env.DEV ? 'development' : 'production');

// Should output: "Environment: production" in production builds
```

**Fix:** Ensure build process sets `NODE_ENV=production`:

```bash
npm run build  # Should automatically set production mode
```

### Duplicate Events

**Symptom:** Each event fires twice

**Common Causes:**
1. React StrictMode (expected in development)
2. Component mounting twice
3. Multiple useEffect calls

**Solution:**

```typescript
// Use ref to prevent duplicate tracking
const hasTracked = useRef(false);

useEffect(() => {
  if (!hasTracked.current) {
    logPageView();
    hasTracked.current = true;
  }
}, [logPageView]);
```

### Missing Event Parameters

**Symptom:** Events tracked but parameters missing

**Debug:**

```typescript
// Add logging before tracking
console.log('Tracking search with:', searchTerm);
logSearch(searchTerm);

// Verify in Network tab:
// google-analytics.com/g/collect?...&ep.search_term=...
```

**Common Issues:**
- Undefined parameters passed to tracking functions
- Parameter type mismatch (string vs number)
- Parameter name doesn't match GA4 expectations

---

## Privacy & Compliance

### GDPR Compliance

**Current Status:** ⚠️ Basic compliance (no consent banner)

**What's Implemented:**
- ✅ Analytics run client-side only
- ✅ No PII (personally identifiable information) tracked
- ✅ IP anonymization available via GA4 settings

**What's Missing:**
- ❌ Cookie consent banner
- ❌ Privacy policy update
- ❌ User opt-out mechanism

**To Add Cookie Consent:**

```typescript
// Option 1: Use cookie consent library
npm install react-cookie-consent

// Option 2: Custom implementation
const [hasConsent, setHasConsent] = useState(
  localStorage.getItem('analytics_consent') === 'true'
);

useEffect(() => {
  if (hasConsent) {
    logPageView();
  }
}, [hasConsent]);
```

### Data Retention

**Google Analytics 4:**
- Default: 2 months
- Configurable: 2-14 months
- Location: Admin → Data Settings → Data Retention

**Meta Pixel:**
- Default: 180 days
- Configurable in Events Manager

**Recommendation:** Set retention to 14 months for trend analysis

### IP Anonymization

**GA4 Configuration:**

By default, GA4 anonymizes IPs. To verify:

1. Admin → Data Streams → Web
2. Configure tag settings
3. Show more → Define internal traffic
4. Verify IP anonymization is enabled

### User Data Protection

**What We Track:**
- ✅ Anonymous session data
- ✅ Search queries (property addresses)
- ✅ Property IDs (public records)
- ✅ Click behavior

**What We Don't Track:**
- ❌ Names or email addresses
- ❌ Payment information
- ❌ Authentication tokens
- ❌ Cross-site tracking

---

## Best Practices

### Event Naming Conventions

**Follow GA4 Recommended Events:** https://support.google.com/analytics/answer/9267735

```typescript
// ✅ Good: Use standard GA4 event names
trackEvent('search', { search_term: query });
trackEvent('view_item', { item_id: propertyId });

// ❌ Bad: Custom names when standard exists
trackEvent('user_searched', { query: query });
trackEvent('looked_at_property', { id: propertyId });
```

### Parameter Naming

**Use snake_case** for all parameters:

```typescript
// ✅ Good
{ search_term: "123 Main", result_count: 5 }

// ❌ Bad
{ searchTerm: "123 Main", resultCount: 5 }
```

### Performance Optimization

**Do:**
- ✅ Load scripts asynchronously
- ✅ Use `useCallback` for memoization
- ✅ Batch related events when possible
- ✅ Avoid tracking in tight loops

**Don't:**
- ❌ Track on every keystroke (use debounce)
- ❌ Send large payloads (>8KB)
- ❌ Block rendering waiting for analytics
- ❌ Track PII or sensitive data

### Testing Strategy

**Development:**
1. Verify console logs appear
2. Check event parameters are correct
3. Test error tracking with intentional errors

**Staging/Preview:**
1. Verify network requests to analytics platforms
2. Check GA4 Real-Time dashboard
3. Use Meta Pixel Helper extension

**Production:**
1. Monitor for first 24 hours after deployment
2. Verify event counts match expectations
3. Check for error rate spikes

### Code Maintenance

**When Adding New Events:**

1. Add type definition to analytics.ts
2. Add tracking function to analytics.ts
3. Add hook wrapper to useAnalytics.ts
4. Add usage to component
5. Test in development
6. Update this documentation
7. Add to GA4 custom reports

**Example:**

```typescript
// 1. Type definition
export interface ShareEventParams {
  property_id: string;
  share_method: 'email' | 'link' | 'social';
}

// 2. Tracking function
export const trackShare = (
  propertyId: string,
  method: ShareEventParams['share_method']
): void => {
  trackEvent('share', {
    property_id: propertyId,
    share_method: method
  });
};

// 3. Hook wrapper
const logShare = useCallback(
  (propertyId: string, method: ShareEventParams['share_method']) => {
    trackShare(propertyId, method);
  },
  []
);

// 4. Component usage
<ShareButton onClick={() => logShare(property.id, 'email')} />
```

---

## Additional Resources

### Official Documentation

- **Google Analytics 4:** https://support.google.com/analytics/
- **Meta Pixel:** https://www.facebook.com/business/help/742478679120153
- **GA4 Measurement Protocol:** https://developers.google.com/analytics/devguides/collection/protocol/ga4

### Tools

- **GA4 Event Builder:** https://ga-dev-tools.google/ga4/event-builder/
- **Meta Pixel Helper:** Chrome Web Store → "Meta Pixel Helper"
- **Google Tag Assistant:** Chrome Web Store → "Tag Assistant Legacy"

### Internal Documentation

- **Implementation Context:** `dev/active/analytics-implementation-context.md`
- **Task Breakdown:** `dev/active/analytics-implementation-tasks.md`
- **Handoff Notes:** `dev/HANDOFF.md`

---

## Attribution Components

Three layout components drive traffic to IntegrityStudio.dev with integrated GA4 tracking via `outbound_click` events.

### Components

| Component | Location | Visibility | GA4 Event Metadata |
|-----------|----------|------------|-------------------|
| **HeaderBadge** | `src/components/layout/HeaderBadge/` | Always visible (hero top-right) | `element_location: header_badge` |
| **AttributionCard** | `src/components/layout/AttributionCard/` | After first search or error | `destination: integritystudio_services` / `github_repo` |
| **Footer** | `src/components/layout/Footer/` | Bottom of page | `element_location: footer` |

### Event Structure

All attribution clicks emit `outbound_click` events:

```json
{
  "category": "conversion",
  "action": "outbound_click",
  "label": "[component]_[action]",
  "metadata": {
    "element_location": "header_badge | inline_card | footer",
    "destination": "integritystudio_homepage | integritystudio_services | github"
  }
}
```

### GTM Configuration

Google Tag Manager (`G-ECH51H8L2Z`) provides additional tracking:

| GTM Event | Trigger |
|-----------|---------|
| `generate_lead` | Form submissions |
| `phone_click` | Phone link clicks |
| `email_click` | Email link clicks |
| `cta_click` | CTA button clicks |
| `outbound_click` | IntegrityStudio link clicks |
| `conversion` | Thank you page views |
| `scroll_50` / `scroll_90` | Scroll depth thresholds |

### Import Paths

```typescript
import { HeaderBadge, AttributionCard, Footer } from "@/components/layout";
```

---

## Support & Questions

For questions about this implementation:

1. Review this documentation
2. Check `dev/active/analytics-implementation-context.md` for detailed context
3. Review git history for commit messages explaining decisions
4. Consult official GA4/Meta documentation links above

---

**Document Version:** 1.0
**Last Reviewed:** 2025-11-08
**Next Review:** 2025-12-08 (monthly)
