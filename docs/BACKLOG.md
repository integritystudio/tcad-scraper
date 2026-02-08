# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-06

Items remaining after the mock cleanup session (2026-02-06). See `TECHNICAL_DEBT.md` for historical context.

---

## TD-2: console.* Statements in Scripts/Tests

**Files** (62 occurrences across 11 files):
- `src/scripts/analyze-search-terms.ts` (27) - CLI script output
- `src/scripts/migrate-to-logger.ts` (8) - migration helper
- `src/__tests__/auth-database.integration.test.ts` (8) - integration test
- `src/scripts/get-fresh-token.ts` (4) - CLI utility
- `src/__tests__/test-utils.ts` (4) - test helper
- `src/lib/__tests__/prisma.test.ts` (4) - test debug
- `src/__tests__/auth-database.connection.test.ts` (2)
- `src/__tests__/integration.test.ts` (2) - integration test
- `src/__tests__/ci-fixes.test.ts` (1)

**Priority**: Low - scripts intentionally use console for CLI output; tests use it for debug info

**Fix**: Replace with Pino logger in scripts; remove from tests (LOG_LEVEL=silent suppresses Pino)

---
## TD-5: 27 Skipped API Integration Tests

**File**: `server/src/__tests__/api.test.ts`

**Problem**: Entire test suite wrapped in `describe.skip()` (line 34). Requires running backend + Redis + PostgreSQL.

**Fix**: Move to integration test suite or add testcontainers setup

**Priority**: Medium - these test real API endpoints but need infrastructure

---

## TD-8: Remaining `as any` in Test Files

**Count**: 86 occurrences across 11 test files

**Largest offenders**:
- `json-ld.utils.test.ts` (30) - return type assertions
- `xcontroller.middleware.test.ts` (25) - config mutation casts
- `property.controller.test.ts` (6) - mock variable types
- `metrics.middleware.test.ts` (5) - mock casts
- `tcad-scraper.test.ts` (5) - private member access
- `token-refresh-mock-repro.test.ts` (4) - demo/reference file
- `auth.test.ts` (3) - config mutation casts
- `deduplication.test.ts` (3) - mock types

**Priority**: Low - tests only, no production impact


---

## Completed Items

- **TD-3**: Replaced deprecated `startTransaction` with typed `startSpan<T>()` wrapper
- **TD-6**: Added `npm run lint` script using Biome
- **TD-7**: Made `asyncHandler` generic, eliminated 3 `as any` casts in property routes
- **TD-9**: Remove config mock, use real values from setup.ts
- **TD-10: Removed server tests includes from root config.
- **Redis cache tests**: 40 tests re-enabled (was `describe.skip`)
- **Config mocks**: Removed from 5 test files (auth, claude, scraper.queue, xcontroller, token-refresh)
- **Winston mocks**: Removed from 3 test files (scheduler, scraper.queue, token-refresh)
- **Winston → Pino migration**: 4 source files (scraper.queue, token-refresh, scrape-scheduler, redis-cache.service)
- **Typed mock objects**: 3 test files (scrape-scheduler, token-refresh, scraper.queue)
- **Test setup**: Added auth env vars + LOG_LEVEL=silent
- **Root vitest config**: Separated frontend/server test runs (TD-10)
