# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-26
**Status**: 617/617 tests passing | TypeScript clean | Lint clean | Biome clean

---
## Open Items

### Code Review 02-27-2026 of commit 66dc363


  Medium
  1. ensureInitialized() concurrency comment — synchronous so safe in Node.js, but needs a comment explaining the guarantee
  2. ensureInitialized() throw path is subtle but correct — just needs a clarifying comment
  3. startAutoRefreshInterval swallows init errors silently — should call ensureInitialized() at start, or log in the .catch()
  Low
  4. getJwtLifetime should guard exp > iat — negative/zero result could slip through
  5. config.scraper.tcadApiKey still exists in config — unused dead field, needs removal or deprecation comment
  6. Test vi.resetModules() could leak — suggest vi.isolateModules() instead
  7. Warn message misleading — says "unauthenticated" but Worker now rejects all unauthenticated requests
  8. /health/token returns 200 even when unhealthy — should return 503

### Code Review 03-02-2026 of commits 79b27ac..126a896 (Infrastructure Fixes)

#### Medium

#### CR-M1: deduplicateByPropertyId silently drops properties with empty propertyId
**Priority**: P2 | **Source**: code-reviewer commit 79b27ac
PropertyData.propertyId is typed as string (non-optional), but mapTCADResultToPropertyData maps r.pid?.toString() ?? "" — so empty string is valid at runtime. The deduplication logic's `if (prop.propertyId)` guard silently drops these without logging. Suggested fix: track dropped count and log warning. -- `server/src/queues/scraper.queue.ts:19-22`

#### CR-M2: waitForToken timeout race with fetch timeout margin only 5 seconds
**Priority**: P2 | **Source**: code-reviewer commit fe3d255
FETCH_TIMEOUT_MS (10s) + network variance can exceed DEFAULT_WAIT_TIMEOUT_MS (15s) before AbortSignal fires. Only 5s margin. Under slow network, timeout fires before fetch abort, creating unhandled rejection race. Suggested fix: widen margin to 8-10s by increasing DEFAULT_WAIT_TIMEOUT_MS to 20s, and document the relationship as a contract. -- `server/src/services/token-refresh.service.ts:11-14`

#### CR-M3: Mid-pagination truncation fallthrough does not log which page triggered it
**Priority**: P2 | **Source**: code-reviewer commit d6bab93
Early return on partial results preserves data correctly, but operator cannot distinguish truncation shortfall from API returning fewer results. Suggested fix: add logger import to tcad-api-client.ts, or add warning in tcad-scraper.ts when response.results.length < response.totalCount. -- `server/src/lib/tcad-api-client.ts:175-179`

#### Low

#### CR-L1: scrapePropertiesViaAPI fetches token once per call, not per retry attempt
**Priority**: P3 | **Source**: code-reviewer commit fe3d255
Token is fetched at top of method, then reused across retry loop. If TOKEN_EXPIRED occurs in attempt 1, BullMQ retries the whole job (correct flow). But if a non-token error is retried within the same call, same stale token is reused. Edge case: if TOKEN_EXPIRED surfaces as a different error type, inner retry loop hammers API with bad token. Not a current bug but fragility to note. -- `server/src/lib/tcad-scraper.ts:39-43`

### Code Review 03-02-2026 of commits 8031b03..126a896 (Term Selection Optimization)

#### HIGH

#### CR-H1: Blacklist doubles on every hourly refresh
**Priority**: P1 | **Source**: code-reviewer commit 8031b03
The `deduplicator` instance is created once and reused across hourly refreshes. On each `loadUsedTermsFromDatabase` call, `markTermFailed` is called 3 times per blacklisted term. Since the deduplicator is not recreated on refresh (guarded by `if (!this.deduplicator)`), the failure counts accumulate: 3 → 6 → 9 → 12... After 2 cycles a properly blacklisted term is now at count=9, making the in-memory state diverge from intent. Fix: either check `isBlacklisted` before marking, or add `forceBlacklist(term)` method that sets count idempotently. -- `server/src/scripts/continuous-batch-scraper.ts:1257-1259`

#### MEDIUM

#### CR-M4: `successRate: 0` equality check on Float field is fragile
**Priority**: P2 | **Source**: code-reviewer commit 8031b03
Prisma schema defines `successRate` as Float. Query uses `{ successRate: 0 }` which filters `WHERE success_rate = 0`. If `updateAnalytics` ever produces `NaN` or `Infinity` (e.g., future bug in `newSuccessRate = newSuccessfulSearches / newTotalSearches` without guard), those rows silently escape the blacklist query. Fix: use safer filter `{ successRate: { lte: 0 } }` to catch 0.0 and any negative values. -- `server/src/services/search-term-optimizer.ts:450`

#### CR-M5: `maxSearches: 5` threshold overlap with `getOverSearchedTerms(5)`
**Priority**: P2 | **Source**: code-reviewer commit 799976b
`getOptimizedTerms` with `maxSearches: 5` uses `totalSearches: { lte: maxSearches }` (includes 5), while `getOverSearchedTerms(5)` uses `gte: 5` (also includes 5). A term searched exactly 5 times is simultaneously suggested by optimizer and marked as used by over-searched loading, causing wasted query work. Fix: change optimizer filter to `lt` (strictly less than) and document semantic as "fewer than N searches". -- `server/src/services/search-term-optimizer.ts:257` and `server/src/scripts/continuous-batch-scraper.ts:1428`

#### CR-M6: `failedTerms` Map has no size bound or eviction
**Priority**: P2 | **Source**: code-reviewer auditor commit 8031b03
`failedTerms: Map<string, number>` grows unbounded. Blacklisted terms (count >= 3) are never deleted from the map, only cleared on `markTermSucceeded`. At scale (thousands of terms), this is O(n) memory with no eviction. Low immediate risk but worth documenting. Mitigation: cap map size or use DB as authoritative blacklist source and skip in-memory representation. -- `server/src/lib/search-term-deduplicator.ts:21`

#### CR-M7: `markTermFailed` x3 is tightly coupled protocol, not an abstraction
**Priority**: P2 | **Source**: code-reviewer commit 8031b03
Calling `markTermFailed` three times to reach blacklist threshold is knowledge that belongs in the `SearchTermDeduplicator` class, not at call sites. Tightly coupled to `MAX_CONSECUTIVE_FAILURES = 3`. If constant changes to 5, call sites break silently. Fix: add `forceBlacklist(term)` method that sets count to `MAX_CONSECUTIVE_FAILURES` idempotently. This also resolves the doubling bug (CR-H1). -- `server/src/scripts/continuous-batch-scraper.ts:1257-1259`

#### LOW

#### CR-L2: `getOverSearchedTerms` has no result size limit
**Priority**: P3 | **Source**: code-reviewer commit 799976b
Unlike `getOptimizedTerms` which uses `take: maxTermsToReturn`, `getOverSearchedTerms` issues unbounded `findMany` with no `take`. As analytics table grows, result set grows and loads all into memory. Acceptable at current scale but worth documenting expected scale threshold. -- `server/src/services/search-term-optimizer.ts:435-441`

#### CR-L3: No test coverage for `getOverSearchedTerms` and `getBlacklistedTerms`
**Priority**: P3 | **Source**: code-reviewer commit 799976b
The two new SearchTermOptimizer methods have zero test coverage. `SearchTermDeduplicator` tests cover blacklist methods adequately, but optimizer tests should add: (1) `getBlacklistedTerms` returns only `successRate === 0` and `totalSearches >= minSearches`, (2) `getOverSearchedTerms` returns only `totalSearches >= minSearches`, (3) `getOptimizedTerms` with `maxSearches` respects threshold. -- `server/src/services/__tests__/search-term-optimizer.test.ts`

### BUG-3: JSDOM `<search>` element warning (P3) — No fix needed
- **File**: `src/components/__tests__/SearchBox.test.tsx`
- **Warning**: `The tag <search> is unrecognized in this browser`
- **Root cause**: JSDOM doesn't support HTML `<search>` element. Component correctly uses semantic HTML.
- **Fix**: No fix needed — console noise only. Will resolve when JSDOM adds support.

### Test Suite Cleanup (2026-02-24)

> Migrated from AlephAuto backlog. Critical (TST-C1..C4) and High (TST-H1..H12) items already completed.

#### Medium — Redundancy and Noise

| ID | Location | Description |
|----|----------|-------------|
| TST-M1 | `server/vitest.config.ts:68-70` | **`mockReset + clearMocks` redundant** — `mockReset: true` supersedes `clearMocks: true`. Drop `clearMocks`. |
| TST-M2 | `server/src/__tests__/integration.test.ts:117-129` | **`if (!hasFrontend) return` instead of `test.skipIf`** — Tests silently pass with no assertion. 3 of 4 frontend tests use wrong pattern. (1 of 3 fixed in TST-H6.) |
| TST-M3 | `server/src/__tests__/factories.ts:22-24` | **`resetFactoryCounter` exported but never called** — Counter accumulates across tests, latent isolation issue. Call in global `beforeEach` or use `crypto.randomUUID()`. |
| TST-M4 | `server/src/__tests__/test-utils.ts:62-123` | **`skipIfRedisUnavailable` throws errors to "skip"** — Reports as failure, not skip. Functions unused — all tests use `isRedisAvailable` directly. Remove. |
| TST-M5 | `server/src/__tests__/security.test.ts:196-199` | **Documentation-only test** — `expect(true).toBe(true)` with "This is a note" comment. Delete test case. |
| TST-M6 | `src/__tests__/App.test.tsx:63-88` | **Two tests assert same thing** — Both render `<App>` and check `PropertySearchContainer`. Neither observes loading state. Collapse into one. |
| TST-M7 | `src/utils/__tests__/formatters.test.ts:78-103` | **"Type safety" block duplicates "edge cases"** for null/undefined — Same calls, zero runtime value from TS annotations. Remove block. |

#### Low — Info

| ID | Location | Description |
|----|----------|-------------|
| TST-L1 | `server/src/lib/__tests__/tcad-scraper.test.ts:188-307` | **Weak assertions** — `humanDelay` tests assert `expect(true).toBe(true)`, user agent tests assert only `expect(scraper).toBeDefined()`. |

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).
