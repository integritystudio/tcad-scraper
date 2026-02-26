# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-26
**Status**: 617/617 tests passing | TypeScript clean | Lint clean | Biome clean

---

## Open Items

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
