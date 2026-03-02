# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-02
**Status**: 624/624 tests passing | TypeScript clean | Lint clean | Biome clean

---
## Open Items

### Code Review 02-27-2026 of commit 66dc363

  Low
  4. getJwtLifetime should guard exp > iat — STALE: function not found in current codebase; may have been removed in refactor
  6. Test vi.resetModules() could leak — suggest vi.isolateModules() instead — `src/__tests__/App.test.tsx:59`

### Code Review 03-02-2026 of commits 79b27ac..126a896 (Infrastructure Fixes)

#### Low

#### CR-L1: scrapePropertiesViaAPI fetches token once per call, not per retry attempt
**Priority**: P3 | **Source**: code-reviewer commit fe3d255
Token is fetched at top of method, then reused across retry loop. If TOKEN_EXPIRED occurs in attempt 1, BullMQ retries the whole job (correct flow). But if a non-token error is retried within the same call, same stale token is reused. Edge case: if TOKEN_EXPIRED surfaces as a different error type, inner retry loop hammers API with bad token. Not a current bug but fragility to note. -- `server/src/lib/tcad-scraper.ts:39-43`

### Code Review 03-02-2026 of commit f15f68c (Adaptive Prefix Algorithm)

#### MEDIUM

#### CR-M8: O(n^4) nested loop in Tier 3 allocates ~149K strings synchronously
**Priority**: P2 | **Source**: code-reviewer commit f15f68c
Tier 3 nested loop (19 × 26 × 26 × 26 = 333K iterations, ~149K after vowel/consonant filter) generates candidate strings synchronously on the event loop. While not catastrophic for a CLI tool, this blocks for 50-200ms at scale. Suggested fix: document the performance characteristic in code, or convert to lazy generator pattern to avoid materialization. -- `server/src/scripts/generate-search-terms.ts:204-223`

### BUG-3: JSDOM `<search>` element warning (P3) — No fix needed
- **File**: `src/components/__tests__/SearchBox.test.tsx`
- **Warning**: `The tag <search> is unrecognized in this browser`
- **Root cause**: JSDOM doesn't support HTML `<search>` element. Component correctly uses semantic HTML.
- **Fix**: No fix needed — console noise only. Will resolve when JSDOM adds support.

### Test Suite Cleanup (2026-02-24)

#### Low — Info

| ID | Location | Description |
|----|----------|-------------|
| TST-L1 | `server/src/lib/__tests__/tcad-scraper.test.ts:188-307` | **Weak assertions** — `humanDelay` tests assert `expect(true).toBe(true)`, user agent tests assert only `expect(scraper).toBeDefined()`. |

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).
