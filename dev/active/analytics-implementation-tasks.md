# Analytics Implementation - Task List

**Last Updated:** 2025-01-07 (before context reset)
**Status:** 🟡 IN PROGRESS

## Task Status Legend
- ✅ Completed
- 🟡 In Progress
- ⏳ Blocked/Waiting
- ⬜ Not Started

---

## Phase 1: Foundation ✅ COMPLETED

### ✅ Create Analytics Library
- [x] Create `src/lib/analytics.ts`
- [x] Define TypeScript interfaces (AnalyticsEvent, EventCategory)
- [x] Implement `trackEvent()` function
- [x] Implement `trackSearch()` function
- [x] Implement `trackExampleQueryClick()` function
- [x] Implement `trackSearchResults()` function
- [x] Implement `trackPropertyView()` function
- [x] Implement `trackPageView()` function
- [x] Implement `trackError()` function
- [x] Implement `trackConversion()` function
- [x] Add Window interface extension for gtag/fbq
- [x] Add development mode logging

### ✅ Create React Hook
- [x] Create `src/hooks/useAnalytics.ts`
- [x] Import analytics functions
- [x] Wrap functions with useCallback
- [x] Export all tracking methods
- [x] Add TypeScript types

### ✅ Configure Hook Exports
- [x] Update `src/hooks/index.ts`
- [x] Add useAnalytics export

---

## Phase 2: Script Integration ⏳ BLOCKED

### ⏳ Add Google Analytics 4 Script
**Blocked:** Needs manual editing of index.html

**Tasks:**
- [ ] Open `index.html`
- [ ] Add GA4 script tag in `<head>`
- [ ] Configure with measurement ID: G-J7TL7PQH7S
- [ ] Set `send_page_view: false` for manual tracking
- [ ] Test script loads in browser

**Script to add:**
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-J7TL7PQH7S"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-J7TL7PQH7S', {
    'send_page_view': false
  });
</script>
```

### ⏳ Add Meta Pixel Script
**Blocked:** Needs Meta Pixel ID + manual editing

**Tasks:**
- [ ] Obtain Meta Pixel ID from Meta Events Manager
- [ ] Open `index.html`
- [ ] Add Meta Pixel base code in `<head>`
- [ ] Replace placeholder `YOUR_PIXEL_ID` with real ID
- [ ] Test script loads in browser

**Script to add:**
```html
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', 'YOUR_PIXEL_ID');
  fbq('track', 'PageView');
</script>
```

**Prerequisites:**
1. Create Meta Business account (if not exists)
2. Create Meta Pixel in Events Manager
3. Get Pixel ID

---

## Phase 3: Component Integration ⬜ NOT STARTED

### ⬜ PropertySearchContainer Component
**File:** `src/components/features/PropertySearch/PropertySearchContainer.tsx`

**Tasks:**
- [ ] Import `useAnalytics` hook
- [ ] Destructure needed tracking methods
- [ ] Add `logSearch()` call on search submit
- [ ] Add `logSearchResults()` call when results load
- [ ] Pass correct parameters (query, resultsCount, hasExplanation)
- [ ] Test tracking fires on search

**Example implementation:**
```typescript
import { useAnalytics } from '@/hooks';

function PropertySearchContainer() {
  const { logSearch, logSearchResults } = useAnalytics();

  const handleSearch = async (query: string) => {
    // Track search initiation
    logSearch(query);

    // Perform search
    const results = await api.searchProperties(query);

    // Track results
    logSearchResults(
      query,
      results.length,
      !!results.explanation
    );

    // ... update UI
  };
}
```

### ⬜ PropertyCard Component
**File:** `src/components/features/PropertySearch/PropertyCard.tsx`

**Tasks:**
- [ ] Import `useAnalytics` hook
- [ ] Destructure `logPropertyView` method
- [ ] Add click handler to card
- [ ] Call `logPropertyView()` with property ID and address
- [ ] Test tracking fires on card click

**Example implementation:**
```typescript
import { useAnalytics } from '@/hooks';

function PropertyCard({ property }: { property: Property }) {
  const { logPropertyView } = useAnalytics();

  const handleClick = () => {
    logPropertyView(property.id, property.propertyAddress);
    // ... open details or navigate
  };

  return (
    <div onClick={handleClick}>
      {/* Card content */}
    </div>
  );
}
```

### ⬜ ExampleQueries Component
**File:** `src/components/features/PropertySearch/ExampleQueries.tsx`

**Tasks:**
- [ ] Import `useAnalytics` hook
- [ ] Destructure `logExampleQueryClick` method
- [ ] Add click handler to example buttons
- [ ] Call `logExampleQueryClick()` with query text
- [ ] Test tracking fires on example click

**Example implementation:**
```typescript
import { useAnalytics } from '@/hooks';

function ExampleQueries() {
  const { logExampleQueryClick } = useAnalytics();

  const handleExampleClick = (query: string) => {
    logExampleQueryClick(query);
    // ... trigger search with example query
  };

  return (
    <div>
      {examples.map(query => (
        <button onClick={() => handleExampleClick(query)}>
          {query}
        </button>
      ))}
    </div>
  );
}
```

---

## Phase 4: Error Tracking ⬜ NOT STARTED

### ⬜ Create Error Boundary Component
**File:** `src/components/ErrorBoundary.tsx` (create new)

**Tasks:**
- [ ] Create ErrorBoundary class component
- [ ] Implement componentDidCatch
- [ ] Call `trackError()` with error details
- [ ] Implement fallback UI
- [ ] Test with intentional error

**Example implementation:**
```typescript
import { Component, ErrorInfo, ReactNode } from 'react';
import { trackError } from '@/lib/analytics';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    trackError(
      error.message,
      errorInfo.componentStack || 'Unknown component'
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### ⬜ Wrap App with Error Boundary
**File:** `src/main.tsx` or `src/App.tsx`

**Tasks:**
- [ ] Import ErrorBoundary
- [ ] Wrap root component with ErrorBoundary
- [ ] Test error catching works

**Example:**
```typescript
import ErrorBoundary from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

---

## Phase 5: Page View Tracking ⬜ NOT STARTED

### ⬜ Add Route Change Tracking
**File:** `src/App.tsx` or router config

**Tasks:**
- [ ] Import `trackPageView` from analytics
- [ ] Add useEffect to track route changes
- [ ] Track initial page load
- [ ] Test page views fire on navigation

**Example (if using React Router):**
```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';

function App() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location]);

  return (
    // ... app content
  );
}
```

---

## Phase 6: Testing ⬜ NOT STARTED

### ⬜ Development Testing
**Tasks:**
- [ ] Run `npm run dev`
- [ ] Open browser DevTools console
- [ ] Perform search action
- [ ] Verify console logs show analytics events
- [ ] Click property card
- [ ] Verify property view logged
- [ ] Click example query
- [ ] Verify example click logged
- [ ] Check browser Network tab
- [ ] Verify gtag requests sent
- [ ] Verify fbq requests sent

### ⬜ Google Analytics Verification
**Tasks:**
- [ ] Open GA4 Real-Time report
- [ ] Perform test actions on site
- [ ] Verify events appear in real-time
- [ ] Check event parameters
- [ ] Verify search events tracked correctly
- [ ] Verify engagement events tracked correctly

### ⬜ Meta Pixel Verification
**Tasks:**
- [ ] Open Meta Events Manager
- [ ] Go to Test Events
- [ ] Perform test actions on site
- [ ] Verify events appear in test view
- [ ] Verify Search event tracked
- [ ] Verify ViewContent event tracked
- [ ] Verify custom events tracked

### ⬜ Production Build Testing
**Tasks:**
- [ ] Run `npm run build`
- [ ] Run `npm run preview`
- [ ] Repeat all test actions
- [ ] Verify tracking works in production mode
- [ ] Verify console logs disabled in production
- [ ] Verify error logging still works

---

## Phase 7: Documentation ⬜ NOT STARTED

### ⬜ Create Analytics Documentation
**File:** `docs/ANALYTICS.md` (create new)

**Content to include:**
- [ ] Overview of tracking implementation
- [ ] List of tracked events
- [ ] Event properties and parameters
- [ ] How to add new tracking
- [ ] How to test tracking
- [ ] GA4 dashboard links
- [ ] Meta Pixel dashboard links
- [ ] Privacy policy requirements

### ⬜ Update README
**File:** `README.md`

**Tasks:**
- [ ] Add Analytics section
- [ ] Link to ANALYTICS.md
- [ ] List tracking platforms used
- [ ] Note privacy compliance

### ⬜ Update Code Comments
**Tasks:**
- [ ] Add JSDoc comments to analytics functions
- [ ] Document event properties
- [ ] Add usage examples in comments

---

## Phase 8: Enhancement (Future) ⬜ NOT STARTED

### ⬜ Advanced GA4 Configuration
**Tasks:**
- [ ] Create custom dimensions
- [ ] Configure conversion goals
- [ ] Setup enhanced measurement
- [ ] Configure user properties
- [ ] Create custom reports

### ⬜ Advanced Meta Pixel Configuration
**Tasks:**
- [ ] Configure standard events
- [ ] Setup custom conversions
- [ ] Configure event matching
- [ ] Add value parameters for ads

### ⬜ Privacy Compliance
**Tasks:**
- [ ] Add cookie consent banner (if required)
- [ ] Implement opt-out mechanism
- [ ] Configure IP anonymization
- [ ] Add privacy policy page
- [ ] Add data retention settings

### ⬜ A/B Testing Integration
**Tasks:**
- [ ] Integrate Google Optimize or similar
- [ ] Setup experiment tracking
- [ ] Configure variant assignment

### ⬜ Performance Monitoring
**Tasks:**
- [ ] Add web vitals tracking
- [ ] Track page load times
- [ ] Track API response times
- [ ] Configure performance alerts

---

## Quick Reference: Next Actions

### 1st Priority (Immediate)
1. Add GA4 script to index.html
2. Get Meta Pixel ID
3. Add Meta Pixel script to index.html

### 2nd Priority (Same Session)
1. Implement PropertySearchContainer tracking
2. Implement PropertyCard tracking
3. Implement ExampleQueries tracking
4. Test in development mode

### 3rd Priority (Follow-up)
1. Create and integrate ErrorBoundary
2. Add page view tracking
3. Test in production mode
4. Verify in GA4 and Meta dashboards

---

## Estimated Time per Phase

| Phase | Tasks | Estimated Time | Status |
|-------|-------|----------------|--------|
| Phase 1: Foundation | 18 | 1 hour | ✅ Complete |
| Phase 2: Scripts | 2 | 15 minutes | ⏳ Blocked |
| Phase 3: Components | 3 | 1-2 hours | ⬜ Not Started |
| Phase 4: Errors | 2 | 30 minutes | ⬜ Not Started |
| Phase 5: Page Views | 1 | 30 minutes | ⬜ Not Started |
| Phase 6: Testing | 3 | 1 hour | ⬜ Not Started |
| Phase 7: Docs | 3 | 30 minutes | ⬜ Not Started |
| Phase 8: Enhancement | 5 | 2-4 hours | ⬜ Future |
| **Total** | **37** | **6-9 hours** | **5% Complete** |

---

## Blockers & Dependencies

### Current Blockers
1. **Meta Pixel ID** - Need to create Meta Pixel before adding script
2. **Manual HTML editing** - Scripts must be added to index.html manually

### Dependencies
- Phase 3 depends on Phase 2 (can't test without scripts)
- Phase 6 depends on Phases 2-5 (testing needs implementation)
- Phase 7 depends on Phase 6 (docs need verified implementation)

### Prerequisites Completed
- ✅ Analytics library created
- ✅ React hook created
- ✅ TypeScript types defined
- ✅ Development mode logging added
- ✅ Hook exports configured

---

## Success Criteria

### Minimum Viable Product (MVP)
- [x] Analytics library created
- [x] React hook created
- [ ] Tracking scripts added to HTML
- [ ] Search events tracked
- [ ] Property view events tracked
- [ ] Events verified in GA4 Real-Time
- [ ] Production build works

### Full Implementation
- [ ] All MVP criteria met
- [ ] Example query clicks tracked
- [ ] Error boundary with tracking
- [ ] Page view tracking
- [ ] Meta Pixel verified
- [ ] Documentation complete
- [ ] Privacy compliance addressed

### Future Enhancements
- [ ] Custom dimensions configured
- [ ] Conversion goals setup
- [ ] A/B testing integrated
- [ ] Performance monitoring added

---

**Last Updated:** 2025-01-07 before context reset
**Overall Progress:** ~5% complete (foundation only)
**Next Session:** Start with Phase 2 (add tracking scripts)
