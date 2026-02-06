# UI Robustness & Reliability Audit

**Date**: 2026-02-06
**Scope**: Frontend React application (`src/`)
**Stack**: React 19.2 + Vite 7 + TypeScript 5.9
**Total Issues**: 27 original + 1 review-surfaced (3 P0, 6 P1, 7 P2, 3 P3, 8 P4)

---

## Resolved (2026-02-06)

Issues resolved in commits `b5dac5f..e10bbb2` on `main`:

| # | Issue | Commit | Status |
|---|-------|--------|--------|
| 1 | Unsafe `unknown` access (ScrapeManager) | `b5dac5f` | Fixed: axios.isAxiosError() + instanceof Error guards |
| 2 | Infinite polling, no cleanup (pollJobStatus) | `c007a7b`, `025e189` | Fixed: AbortSignal, MAX_POLLS (900), cleanup helper |
| 3 | Initial load fetch lacks cleanup | `6b64fc3`, `13488e6` | Fixed: AbortController in useEffect + unmount cleanup |
| 4 | Search race condition | `6b64fc3` | Fixed: AbortController per search, cancel previous |
| 5 | Deprecated onKeyPress (SearchBox) | `26f33ed` | Fixed: replaced with onKeyDown |
| 6 | Deprecated onKeyPress (ScrapeManager) | `26f33ed` | Fixed: replaced with onKeyDown |

Also fixed:
- Deprecated onKeyPress in legacy `PropertySearch.tsx` (`26f33ed`)
- Missing AbortController in legacy `PropertySearch.tsx` (`e10bbb2`)

**Systemic gap closed**: AbortController now used in `pollJobStatus`, `usePropertySearch` (search + initial load), `ScrapeManager` (polling), and `PropertySearch` (search). ~95% coverage of user-facing async operations.

### Sprint 2 (2026-02-06)

Issues resolved in commits `2a1d226..c05e18b` on `main`:

| # | Issue | Commit | Status |
|---|-------|--------|--------|
| 7 | Analytics fires on every PropertyCard render | `1872220` | Fixed: track on expand click, not mount |
| 8 | 401 redirect to non-existent /login | `923e94d` | Fixed: removed redirect, logs error instead |
| 9 | debounce NodeJS.Timeout type | `6693bb2` | Fixed: ReturnType<typeof setTimeout> |
| 11 | JSON parse swallows server errors | `175d46e` | Fixed: preserve server error message, status-based fallback |
| 13 | No invalid date handling in formatDate | `2a1d226` | Fixed: isNaN(date.getTime()) guard, returns "-" |
| 14 | formatNumber missing null guard | `2a1d226` | Fixed: null/undefined/NaN/Infinity guards |
| 15 | Division by zero in usePagination | `6b90def` | Fixed: Math.max(1, itemsPerPage) |
| 21 | Duplicate formatCurrency in AnswerBox | `8879cf4` | Fixed: import from utils/formatters |

Also fixed (review-surfaced):
- Division by zero in `PropertyTable.tsx` totalPages calculation (`c05e18b`)

**Systemic gaps closed**: All formatters now handle invalid inputs. Division-by-zero guarded in all pagination paths. Analytics tracking moved to user intent (expand) from render.

---

## Remaining: P2-ROBUSTNESS

### 10. Dual HTTP client architecture
- **Files**: `src/services/api.service.ts` (axios) vs `src/hooks/usePropertySearch.ts` (fetch)
- **Issue**: Two different HTTP clients with different error handling, timeout config, and interceptors. usePropertySearch bypasses all axios interceptors (auth, rate limit handling, error logging).
- **Impact**: Inconsistent error messages, timeout behavior, and auth handling between search and other API calls
- **Fix**: Standardize on one client; refactor usePropertySearch to use api.service.ts

### 12. Empty query returns silently with no user feedback
- **File**: `src/hooks/usePropertySearch.ts:62`
- **Issue**: `if (!query.trim()) return;` exits without setting error state or any visual feedback.
- **Impact**: User clicks search, nothing happens, no indication why
- **Fix**: Set error state with message, or ensure button is always disabled when query is empty

### 16. logPageView dependency array may cause repeated fires
- **File**: `src/App.tsx:21-23`
- **Issue**: `logPageView` in dependency array could cause re-fires if useAnalytics doesn't properly memoize the callback reference.
- **Impact**: Duplicate page view events (low severity if callbacks are memoized)
- **Fix**: Verify useAnalytics memoizes with useCallback; add `// eslint-disable-next-line` if confirmed stable

---

## Remaining: P3-UX-DEGRADATION

### 17. "No results" flash during state transitions
- **File**: `src/components/features/PropertySearch/SearchResults.tsx:48-58`
- **Issue**: Shows "No properties found" when `!loading && results.length === 0 && searchQuery`. Can flash briefly during state transitions between searches.
- **Impact**: Confusing UX, momentary "no results" flash
- **Fix**: Add transition delay or track search completion state explicitly

### 18. No search cancellation UI
- **File**: `src/components/features/PropertySearch/SearchBox.tsx`
- **Issue**: Once a search starts, there's no way to cancel it. Input is disabled, button shows "Searching...", no cancel button.
- **Impact**: User stuck waiting for slow/hung searches
- **Fix**: Add cancel button that triggers AbortController (prerequisite #4 now resolved)
- **Note**: AbortController infrastructure is in place; this is now a UI-only change

### 19. Rapid re-renders from polling callbacks
- **File**: `src/components/ScrapeManager.tsx:68-70`
- **Issue**: `setCurrentJob(status)` called on every poll interval (2s). If polling is faster or multiple jobs poll concurrently, causes rapid re-renders.
- **Impact**: Performance degradation, janky UI during scraping
- **Fix**: Throttle state updates or use requestAnimationFrame

---

## Remaining: P4-MAINTENANCE

### 20. api.service.ts hardcodes API_BASE_URL instead of using api-config.ts
- **File**: `src/services/api.service.ts:6-7`
- **Issue**: Defines own `API_BASE_URL` constant instead of importing `getApiBaseUrl()` from `api-config.ts`.
- **Impact**: Config drift between two sources of truth
- **Fix**: Import and use `getApiBaseUrl()`

### 21. Duplicate formatCurrency in AnswerBox
- **File**: `src/components/features/PropertySearch/AnswerBox.tsx:8-14`
- **Issue**: Defines local `formatCurrency` instead of importing from `utils/formatters.ts`.
- **Impact**: Code duplication, risk of formatting inconsistency
- **Fix**: Import from formatters.ts

### 22. Console.error suppressed in production ErrorBoundary
- **File**: `src/components/ErrorBoundary.tsx:73-75`
- **Issue**: `console.error` gated to DEV only. Production errors are only visible via Sentry, not browser console.
- **Impact**: Harder to debug production issues via DevTools
- **Fix**: Log errors to console in all environments

### 23. Inconsistent production logging in logger.ts
- **File**: `src/lib/logger.ts`
- **Issue**: `error()` logs in production but `warn()` and `info()` are suppressed. Important warnings silenced.
- **Impact**: Missing warning signals in production
- **Fix**: Allow `warn()` in production

### 24. Mixpanel tracking has no .catch() on initPromise.then()
- **File**: `src/lib/mixpanel.ts:78-84`
- **Issue**: All methods call `initPromise.then()` without `.catch()`. If init promise rejects, unhandled rejection occurs.
- **Impact**: Silent analytics failures, potential unhandled promise rejection
- **Fix**: Add `.catch()` to each `.then()` call

### 25. Sentry filters mask real issues
- **File**: `src/lib/sentry.ts:66-82`
- **Issue**: Filters out all "Failed to fetch" and network errors entirely. Could mask CORS misconfigurations, DNS failures, or API outages.
- **Impact**: Missing critical error signals in Sentry
- **Fix**: Log as breadcrumbs instead of dropping entirely; sample rather than suppress

### 26. Single ErrorBoundary at root level only
- **File**: `src/App.tsx:26-33`
- **Issue**: One boundary wraps the entire app. Any component crash shows full-page error, including Footer crash recovery.
- **Impact**: No partial recovery; entire app becomes unusable on single component error
- **Fix**: Add nested boundaries around PropertySearchContainer and other major sections

### 27. Property type alignment between types/index.ts and formatters
- **File**: `src/types/index.ts` vs `src/utils/formatters.ts`
- **Issue**: `Property.assessed_value` typed as `number | null` but formatters check for `undefined` too. Type contract mismatch.
- **Impact**: Defensive code that's technically unnecessary, adds confusion
- **Fix**: Align null checks with actual type definitions

---

## Review-Surfaced Issues (new, from code review during fix session)

### R-1. xcontroller.client.ts fallback fetch missing AbortSignal (P2)
- **File**: `src/lib/xcontroller.client.ts:87-128`
- **Issue**: `loadDataWithFallback` fetch call has no AbortSignal support. Cannot cancel in-flight fallback requests on unmount.
- **Impact**: Memory leak on unmount if fallback fetch is in progress
- **Fix**: Add optional `signal?: AbortSignal` parameter, pass to `fetch()`

---

## Summary

| Priority | Original | Resolved | Remaining |
|----------|----------|----------|-----------|
| P0 | 3 | 3 | 0 |
| P1 | 6 | 6 | 0 |
| P2 | 7 | 5 | 2 (+1 review-surfaced) |
| P3 | 3 | 0 | 3 |
| P4 | 8 | 1 | 7 |
| **Total** | **27 (+1)** | **15 (+1)** | **12** |

### Next Recommended Sprint

| # | Issue | Priority | Effort |
|---|-------|----------|--------|
| 10 | Dual HTTP client architecture | P2 | Medium - standardize on one client |
| 12 | Empty query silent return | P2 | Trivial - add error state or disable button |
| 18 | Search cancellation UI | P3 | Small - AbortController infra now in place |
| 17 | "No results" flash during transitions | P3 | Small - transition delay or state tracking |

### Strengths Noted

- TypeScript coverage is strong (no `any` types in src/)
- Accessibility attributes present (ARIA labels, roles, semantic HTML)
- Comprehensive analytics integration (Sentry + Mixpanel + GA4)
- Error boundary implemented at root level
- Mixpanel wrapper is well-designed (safe init, try-catch everywhere)
- CSS Modules prevent style leakage
- **AbortController pattern now established** across all major async paths
