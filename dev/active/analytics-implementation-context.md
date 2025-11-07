# Analytics Implementation Context

**Status:** 🟡 IN PROGRESS
**Last Updated:** 2025-01-07 (before context reset)
**Session:** January 7, 2025

## Overview

Implementing Google Analytics 4 (GA4) and Meta Pixel tracking for the TCAD Scraper frontend React application. The goal is to track user interactions, search behavior, property views, and conversions.

## Implementation State

### ✅ Completed

1. **Analytics Library Created**
   - File: `src/lib/analytics.ts` (201 lines)
   - Provides utility functions for tracking events
   - Integrates with both GA4 and Meta Pixel
   - Type-safe event tracking with TypeScript interfaces

   **Key Functions:**
   - `trackEvent()` - Generic event tracking
   - `trackSearch()` - Search-specific tracking
   - `trackExampleQueryClick()` - Example query engagement
   - `trackSearchResults()` - Result display tracking
   - `trackPropertyView()` - Property detail views
   - `trackPageView()` - Page navigation
   - `trackError()` - Error tracking
   - `trackConversion()` - Conversion events

2. **React Hook Created**
   - File: `src/hooks/useAnalytics.ts` (58 lines)
   - Custom hook wrapping analytics functions
   - Memoized callbacks for performance
   - Easy integration in React components

   **Exported Methods:**
   - `track()` - Generic event tracking
   - `logSearch()` - Search tracking
   - `logExampleQueryClick()` - Example query clicks
   - `logSearchResults()` - Results display
   - `logPropertyView()` - Property views
   - `logError()` - Error tracking
   - `logConversion()` - Conversion tracking

3. **Hook Export Added**
   - File: `src/hooks/index.ts`
   - Added: `export { useAnalytics } from './useAnalytics';`
   - Maintains consistent import pattern for hooks

### 🔧 Modified Files

1. **Frontend Components**
   - `src/components/features/PropertySearch/PropertySearchContainer.tsx`
     - Added analytics tracking for searches
     - Tracking search results display
     - Integration points identified but not fully implemented

   - `src/components/features/PropertySearch/PropertyCard.tsx`
     - Prepared for property view tracking
     - Not yet implemented (needs click handlers)

   - `src/components/features/PropertySearch/ExampleQueries.tsx`
     - Prepared for example query click tracking
     - Not yet implemented (needs event handlers)

2. **HTML Files**
   - `index.html` - Modified (tracking scripts need to be added)
   - `dist/index.html` - Build output (will be updated on next build)

3. **Styling**
   - `src/App.css` - Minor modifications

### ⏳ In Progress / Not Yet Implemented

1. **Tracking Script Integration**
   - Need to add GA4 tracking script to `index.html`
   - Need to add Meta Pixel script to `index.html`
   - Scripts should be added to `<head>` section

   **Google Analytics 4:**
   ```html
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-J7TL7PQH7S"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'G-J7TL7PQH7S');
   </script>
   ```

   **Meta Pixel:**
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

2. **Component Integration**
   - Need to implement `useAnalytics` hook in components
   - Add click handlers with tracking calls
   - Add error boundaries with error tracking

   **PropertySearchContainer.tsx:**
   - Track when search is submitted
   - Track when results are displayed
   - Track search query and result count

   **PropertyCard.tsx:**
   - Track property card clicks
   - Track property detail expansions
   - Pass property ID and address to tracking

   **ExampleQueries.tsx:**
   - Track example query button clicks
   - Record which examples are most popular

3. **App-level Integration**
   - Add `useAnalytics` to `App.tsx` or root component
   - Implement page view tracking on route changes
   - Add global error boundary with tracking

## Key Decisions Made

### 1. Dual Tracking Platform
**Decision:** Integrate both GA4 and Meta Pixel
**Reason:**
- GA4 provides detailed analytics and user flow tracking
- Meta Pixel enables Meta advertising optimization
- Having both provides comprehensive marketing data

### 2. Centralized Analytics Library
**Decision:** Created `src/lib/analytics.ts` as single source of truth
**Reason:**
- Consistent tracking across application
- Easy to maintain and update tracking logic
- Type safety with TypeScript interfaces
- Can easily swap or add tracking platforms

### 3. React Hook Pattern
**Decision:** Wrapped analytics in custom React hook
**Reason:**
- Idiomatic React pattern
- Memoized callbacks prevent unnecessary re-renders
- Easy to use in components
- Follows existing hook patterns in codebase

### 4. Event Category Structure
**Decision:** Used 4 main categories: search, navigation, engagement, conversion
**Reason:**
- Aligns with standard analytics taxonomy
- Easy to filter and analyze in GA4
- Supports funnel analysis
- Clear semantic meaning

### 5. Development Mode Logging
**Decision:** Console log all events in development mode
**Reason:**
- Easy debugging during development
- Verify events fire correctly before production
- No external dependencies needed for testing
- Automatically disabled in production builds

## Files Modified

### Created Files (3)
1. `src/lib/analytics.ts` - Analytics utility library
2. `src/hooks/useAnalytics.ts` - React hook for analytics
3. `dev/active/analytics-implementation-context.md` - This file

### Modified Files (5)
1. `src/hooks/index.ts` - Added useAnalytics export
2. `src/components/features/PropertySearch/PropertySearchContainer.tsx` - Prepared for tracking
3. `src/components/features/PropertySearch/PropertyCard.tsx` - Prepared for tracking
4. `src/components/features/PropertySearch/ExampleQueries.tsx` - Prepared for tracking
5. `src/App.css` - Minor style updates

### Files Staged/Unstaged
- `index.html` - Modified (M)
- `dist/index.html` - Modified (M)
- `src/hooks/useAnalytics.ts` - Untracked (??)
- `src/lib/analytics.ts` - Untracked (??)
- Various modified component files

## Integration Points

### Current Architecture
```
index.html
  ├── GA4 Script (to be added)
  └── Meta Pixel Script (to be added)

src/lib/analytics.ts
  ├── trackEvent() - Core tracking function
  ├── trackSearch() - Calls window.gtag() and window.fbq()
  └── Other tracking functions

src/hooks/useAnalytics.ts
  └── Wraps analytics.ts functions in React hooks

Components
  ├── PropertySearchContainer
  │   └── useAnalytics() hook (to be added)
  ├── PropertyCard
  │   └── useAnalytics() hook (to be added)
  └── ExampleQueries
      └── useAnalytics() hook (to be added)
```

### External Dependencies
- **Google Analytics 4:** G-J7TL7PQH7S (tracking ID already in code)
- **Meta Pixel:** YOUR_PIXEL_ID (needs to be obtained and configured)

### Environment Configuration
- No environment variables needed currently
- Scripts loaded directly in HTML
- Development mode detection via `import.meta.env.DEV` (Vite)

## Testing Performed

### Manual Testing
1. **File Creation:** ✅ Created analytics.ts and useAnalytics.ts
2. **Type Checking:** ⏳ Not yet run (TypeScript compilation needed)
3. **Component Integration:** ⏳ Not yet implemented
4. **Runtime Testing:** ⏳ Cannot test without tracking scripts

### Tests to Run
```bash
# Type check
npm run type-check

# Build and verify
npm run build

# Test in development mode
npm run dev
# Then verify console logs appear for analytics events

# Production build test
npm run build && npm run preview
# Verify tracking scripts fire in production mode
```

## Known Issues / Blockers

### 1. Missing Tracking Scripts
**Issue:** GA4 and Meta Pixel scripts not added to index.html
**Impact:** Analytics functions will run but won't send data
**Priority:** HIGH
**Solution:** Add scripts to `index.html` `<head>` section

### 2. Meta Pixel ID Unknown
**Issue:** Placeholder `YOUR_PIXEL_ID` needs real Meta Pixel ID
**Impact:** Meta tracking won't work until configured
**Priority:** MEDIUM
**Solution:**
  - Create Meta Pixel in Meta Events Manager
  - Replace placeholder with actual Pixel ID

### 3. Component Integration Incomplete
**Issue:** Analytics hooks imported but not called in components
**Impact:** Events won't be tracked even with scripts added
**Priority:** HIGH
**Solution:** Implement tracking calls in component event handlers

### 4. No Error Boundaries
**Issue:** Error tracking won't catch unhandled errors
**Impact:** Missing visibility into production errors
**Priority:** MEDIUM
**Solution:** Add React Error Boundary with `trackError()` call

## Next Steps

### Immediate (High Priority)

1. **Add Tracking Scripts to HTML**
   ```bash
   # Edit index.html
   # Add GA4 script
   # Add Meta Pixel script (get real Pixel ID first)
   ```

2. **Implement Component Tracking**
   - PropertySearchContainer: Search submission and results
   - PropertyCard: Card clicks
   - ExampleQueries: Example query clicks

3. **Test in Development**
   ```bash
   npm run dev
   # Verify console logs show tracking events
   # Check browser Network tab for gtag/fbq requests
   ```

### Short Term

4. **Add Error Boundary**
   - Create ErrorBoundary component
   - Wrap App with ErrorBoundary
   - Call `trackError()` in componentDidCatch

5. **Add Page View Tracking**
   - Add useEffect in App.tsx or router
   - Track on route changes
   - Track initial page load

6. **Test in Production Mode**
   ```bash
   npm run build
   npm run preview
   # Verify tracking in production build
   # Check Google Analytics Real-Time report
   ```

### Medium Term

7. **Enhanced Tracking**
   - Add conversion goals in GA4
   - Setup Meta Pixel events for advertising
   - Add custom dimensions for advanced analysis
   - Track user properties (returning vs new)

8. **Analytics Documentation**
   - Document tracked events
   - Document expected event properties
   - Create analytics testing guide
   - Add to main README.md

9. **Privacy Compliance**
   - Add cookie consent banner (if required)
   - Add privacy policy link
   - Configure IP anonymization in GA4
   - Add opt-out mechanism

## Code Examples for Next Session

### Adding GA4 Script to index.html
```html
<!-- In <head> section of index.html -->
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-J7TL7PQH7S"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-J7TL7PQH7S', {
    'send_page_view': false // Manual page view tracking
  });
</script>
```

### Using Analytics in PropertySearchContainer
```typescript
import { useAnalytics } from '@/hooks';

function PropertySearchContainer() {
  const { logSearch, logSearchResults } = useAnalytics();

  const handleSearch = async (query: string) => {
    logSearch(query);

    const results = await searchProperties(query);

    logSearchResults(
      query,
      results.length,
      results.explanation !== null
    );
  };

  // ... rest of component
}
```

### Using Analytics in PropertyCard
```typescript
import { useAnalytics } from '@/hooks';

function PropertyCard({ property }: { property: Property }) {
  const { logPropertyView } = useAnalytics();

  const handleCardClick = () => {
    logPropertyView(property.id, property.propertyAddress);
    // Open property details...
  };

  return (
    <div onClick={handleCardClick}>
      {/* Card content */}
    </div>
  );
}
```

### Adding Error Boundary
```typescript
import { Component, ErrorInfo, ReactNode } from 'react';
import { trackError } from '@/lib/analytics';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    trackError(error.message, errorInfo.componentStack || '');
  }

  // ... rest of component
}
```

## Observations & Learnings

### Analytics Library Design
- Dual tracking (GA4 + Meta) requires coordinated calls
- Development mode logging is essential for debugging
- TypeScript interfaces provide excellent type safety
- Global window extension pattern works well for tracking scripts

### React Integration
- Custom hooks pattern is clean and reusable
- useCallback memoization prevents re-render issues
- Placing analytics at component level gives fine-grained control
- Need to balance granularity with performance

### Event Design
- Four categories (search, navigation, engagement, conversion) cover all needs
- Metadata object provides flexibility for additional properties
- Value field useful for numeric metrics (result count, etc.)
- Label field good for human-readable event identification

## References

### Documentation
- Google Analytics 4: https://developers.google.com/analytics/devguides/collection/ga4
- Meta Pixel: https://developers.facebook.com/docs/meta-pixel
- React Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary

### Existing Documentation
- `docs/API.md` - Backend API documentation
- `docs/CI-CD.md` - CI/CD pipeline documentation
- `README.md` - Project overview
- `docs/CLAUDE.md` - AI assistant context

### Related Files
- `src/lib/logger.ts` - Structured logging (recently implemented)
- `src/services/api.service.ts` - API service layer (could add tracking)

## Commands for Next Session

### Verify Current State
```bash
cd /Users/alyshialedlie/code/ISPublicSites/tcad-scraper

# Check git status
git status

# View analytics files
cat src/lib/analytics.ts
cat src/hooks/useAnalytics.ts

# Check if tracking scripts in HTML
grep "gtag" index.html
grep "fbq" index.html
```

### Continue Implementation
```bash
# 1. Edit index.html to add tracking scripts
# (Use editor)

# 2. Type check
npm run type-check

# 3. Test in dev mode
npm run dev
# Open browser, check console for analytics logs

# 4. Build for production
npm run build

# 5. Test production build
npm run preview
```

### Verify Tracking Works
```bash
# Open browser DevTools
# Network tab → Filter by "google-analytics" or "facebook"
# Should see requests when events fire

# Google Analytics Real-Time view
# https://analytics.google.com/
# Go to Real-Time → Events to see live events
```

## Git Status at Context Limit

### Staged Changes (from previous work)
- Deleted documentation files (old session files)
- Modified dist/index.html (build output)
- Various deleted assets

### Unstaged Changes
- Modified: `index.html`
- Modified: `src/App.css`
- Modified: Component files in PropertySearch
- Untracked: `src/hooks/useAnalytics.ts`
- Untracked: `src/lib/analytics.ts`
- Untracked: `docs/CODEBASE_ANALYSIS.md`

### Recommended Commit Strategy
```bash
# Option 1: Commit analytics work separately
git add src/lib/analytics.ts src/hooks/useAnalytics.ts src/hooks/index.ts
git commit -m "feat: add Google Analytics and Meta Pixel tracking

- Created analytics utility library with GA4 and Meta Pixel integration
- Added useAnalytics React hook for component integration
- Prepared components for tracking (not yet fully implemented)
- Supports search, engagement, and conversion tracking

Note: Tracking scripts need to be added to index.html for full functionality"

# Option 2: Include all related changes
git add src/ index.html
git commit -m "feat: implement analytics tracking foundation

- Created analytics library and React hook
- Prepared frontend components for tracking
- Updated component styling
- Ready for tracking script integration"
```

## Handoff Summary

### What's Complete
- ✅ Analytics library with 8 tracking functions
- ✅ React hook with memoized callbacks
- ✅ TypeScript types and interfaces
- ✅ Development mode logging
- ✅ Hook exports configured
- ✅ Components identified for integration

### What's Needed
- ⏳ Add GA4 tracking script to index.html
- ⏳ Add Meta Pixel script to index.html (get Pixel ID)
- ⏳ Implement hook calls in components
- ⏳ Add error boundary with error tracking
- ⏳ Test tracking in development and production
- ⏳ Document analytics events and usage

### No Blockers
- Code compiles (as far as we know)
- No merge conflicts
- No dependency issues
- Clear next steps defined

### Estimated Time to Complete
- Add tracking scripts: 15 minutes
- Implement component tracking: 1-2 hours
- Add error boundary: 30 minutes
- Testing and verification: 1 hour
- Documentation: 30 minutes
- **Total: ~3-4 hours**

## Context for AI Continuation

### If Session Resumes
This task is **IN PROGRESS** and ready for continuation. The foundation is complete, but integration is needed.

**Priority order:**
1. Add tracking scripts to index.html (can't test without this)
2. Implement component tracking calls
3. Test in development mode
4. Add error boundary
5. Test in production mode

### Key Files to Edit Next
1. `index.html` - Add tracking scripts
2. `src/components/features/PropertySearch/PropertySearchContainer.tsx` - Implement search tracking
3. `src/components/features/PropertySearch/PropertyCard.tsx` - Implement card tracking
4. `src/components/features/PropertySearch/ExampleQueries.tsx` - Implement example click tracking
5. `src/App.tsx` (or create ErrorBoundary.tsx) - Add error tracking

### Testing Checklist
- [ ] Tracking scripts load in browser
- [ ] Console logs appear in dev mode
- [ ] Network requests sent to GA4
- [ ] Network requests sent to Meta Pixel
- [ ] Events appear in GA4 Real-Time report
- [ ] Events appear in Meta Events Manager
- [ ] Error tracking captures errors
- [ ] Production build works correctly

---

**Last Updated:** 2025-01-07 before context reset
**Status:** Foundation complete, integration in progress
**Ready for:** Adding tracking scripts and component integration
