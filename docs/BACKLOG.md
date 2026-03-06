# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-06
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

### Code Review 03-06-2026 of commits 37cb776 + unstaged (2025 Backfill Scripts)

#### MEDIUM

#### ~~CR-M1: Hardcoded date strings will silently include wrong jobs when re-run on a different day~~ [FIXED in 31090b8]
**Priority**: P2 | **Source**: code-reviewer 2026-03-06
Replaced hardcoded dates with 7-day rolling window via `RECENT_JOBS_LOOKBACK_DAYS` constant across all four scripts.

#### CR-M2: `isSubstringOfSearched` and `isSupersetOfSuccessful` semantically opposite with no documentation
**Priority**: P2 | **Source**: code-reviewer 2026-03-06
Novel script filters out candidates that are **prefixes of** existing terms (e.g. skip "fort" if "fortenberry" searched). Other three scripts do **opposite**: skip candidates that are **extensions of** already-successful terms. Two different strategies, no documented rationale. Novel script's function name `isSubstringOfSearched` is also backwards (candidate is prefix, not substring). -- `backfill-2025-novel.ts:57-64`

#### CR-M3: `COUNT(*)::int` cast is correct but fragile — needs defensive comment
**Priority**: P3 | **Source**: code-reviewer 2026-03-06
All four backfill scripts use `COUNT(*)::int` to downcast from `bigint` before Prisma receives it. If cast is ever removed, type annotation `number` will silently lie. Add comment explaining why `::int` is required. -- `backfill-2025*.ts:23-27` in all four scripts

#### ~~CR-M4: `getDenseExpansions`/`getSeedExpansions` duplicated from `generate-search-terms.ts`~~ [FIXED]
**Priority**: P2 | **Source**: code-reviewer 2026-03-06
Extracted shared constants to `src/scripts/lib/backfill-constants.ts`. All 5 scripts now import from single source of truth.

#### CR-M5: Stale "GEO ID prefixes" comment on description-mining section
**Priority**: P3 | **Source**: code-reviewer 2026-03-06
Section comment says "GEO ID prefixes (4-digit)" but code actually mines `description` first-words. Stale copy-paste artifact. -- `backfill-2025-unsearched.ts:159-162`

#### LOW

#### CR-L1: `waitForQueueDrain` has no timeout — can hang indefinitely if a job stalls
**Priority**: P3 | **Source**: code-reviewer 2026-03-06
All four backfill scripts. Drain loop polls until `waiting === 0 && active === 0` with no maximum wait time. A single stuck BullMQ job blocks forever. Acceptable for CLI but worth noting: zero-batch circuit breaker only triggers after drain completes. -- `backfill-2025*.ts:141-151`

#### CR-L2: `backfill-2025.ts` missing `totalGained` session tracking present in other three
**Priority**: P3 | **Source**: code-reviewer 2026-03-06
Other three scripts log `[session: +N]` cumulative gain per batch and report `Session gained` in summary. `backfill-2025.ts` only logs per-batch delta. Minor consistency gap, harder to assess progress mid-run. -- `backfill-2025.ts:283-318`

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
