# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-08
**Status**: 560 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint configured

---

## Open Items

### TD-5: 27 Skipped API Integration Tests
**Priority**: Medium | **File**: `server/src/__tests__/api.test.ts`

Entire test suite in `describe.skip()` (line 34). Requires running backend + Redis + PostgreSQL.

**Fix**: Move to integration test suite or add testcontainers setup.

### TD-8: Remaining `as any` in Test Files
**Priority**: Low | **86 occurrences across 11 test files**

Largest: `json-ld.utils.test.ts` (30), `xcontroller.middleware.test.ts` (25), `property.controller.test.ts` (6), `metrics.middleware.test.ts` (5), `tcad-scraper.test.ts` (5), `token-refresh-mock-repro.test.ts` (4), `auth.test.ts` (3), `deduplication.test.ts` (3)

No production impact. Fix with typed mock factories or `vi.mocked()` patterns.

### TD-2: console.* Statements in Scripts/Tests
**Priority**: Low | **62 occurrences across 11 files**

Largest: `analyze-search-terms.ts` (27), `migrate-to-logger.ts` (8), `auth-database.integration.test.ts` (8), `get-fresh-token.ts` (4), `test-utils.ts` (4)

Scripts intentionally use console for CLI output. Replace with Pino in scripts; remove from tests.

---

## Completed Items

- **TD-3**: Replaced deprecated `startTransaction` with typed `startSpan<T>()` wrapper (`43c92f9`, `1f90485`)
- **TD-6**: Added `npm run lint` script using Biome (`43c92f9`)
- **TD-7**: Made `asyncHandler` generic, eliminated 3 `as any` casts in property routes (`43c92f9`)
- **TD-9**: All config mocks removed from both test files (`811ff05`)
- **TD-10**: Separated frontend/server test runs in root vitest config (`ffd324b`)
- **Redis cache tests**: 40 tests re-enabled (was `describe.skip`) (`85c3e5c`)
- **Config mocks**: Removed from 5 test files (auth, claude, scraper.queue, xcontroller, token-refresh)
- **Winston mocks**: Removed from 3 test files (scheduler, scraper.queue, token-refresh)
- **Winston → Pino migration**: 4 source files (scraper.queue, token-refresh, scrape-scheduler, redis-cache.service)
- **Typed mock objects**: 3 test files (scrape-scheduler, token-refresh, scraper.queue)
- **Test setup**: Added auth env vars + LOG_LEVEL=silent
