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

## TD-3: Deprecated Sentry `startTransaction` Wrapper

**File**: `server/src/lib/sentry.service.ts:304`

**Problem**: Uses deprecated `startTransaction` API. Sentry v8 replaced it with `startSpan`.

**Fix**: Replace `startTransaction()` with `Sentry.startSpan()` API

**Priority**: Low - wrapper already logs deprecation warning, functional

---

## TD-5: 27 Skipped API Integration Tests

**File**: `server/src/__tests__/api.test.ts`

**Problem**: Entire test suite wrapped in `describe.skip()` (line 34). Requires running backend + Redis + PostgreSQL.

**Fix**: Move to integration test suite or add testcontainers setup

**Priority**: Medium - these test real API endpoints but need infrastructure

---

## TD-6: ESLint Has 29 Errors

**Problem**: `npm run lint` reports 29 errors (all `no-console` in scripts/tests)

**Fix**: Add eslint-disable for legitimate CLI scripts, fix remaining

**Priority**: Low - all errors are console statements in scripts (see TD-2)

---

## TD-7: 3 `.bind() as any` in property.routes.ts

**File**: `server/src/routes/property.routes.ts` (lines 137, 202, 295)

**Problem**: TypeScript can't infer bound method types; `as any` is used to work around it.

**Fix**: Use arrow function wrappers or typed bind helpers

**Priority**: Low - documented exception, 3 occurrences

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

## TD-9: Remaining Config Mocks in 2 Test Files

**Files**:
- `src/lib/__tests__/tcad-scraper.test.ts` - mocks `../../config` + `winston`
- `src/lib/__tests__/claude.service.json-parsing.test.ts` - mocks `../../config`

**Problem**: These test files still use `vi.mock("../../config")` instead of relying on real config from setup.ts env vars. `tcad-scraper.test.ts` also still mocks Winston directly.

**Fix**: Same pattern as other files - remove config mock, use real config from env vars set in setup.ts. Migrate source file if it still uses Winston.

**Priority**: Low - tests pass, no functional impact

---

## TD-10: Root `vite.config.ts` Was Running Server Tests with Wrong Setup

**File**: `vite.config.ts` (project root)

**Problem**: Root vitest config previously included `server/src/**/*.test.ts` but used the frontend setup file (`src/setupTests.ts`) and `jsdom` environment. Server tests need `server/src/__tests__/setup.ts` and `node` environment. This was masked when tests mocked the config module directly.

**Status**: Fixed (2026-02-06) - Removed server test includes from root config. Server tests run via `cd server && npm test`.

**Note**: Run server tests from the `server/` directory, not the project root:
```bash
cd server && npm test        # Server: 560 tests
cd .. && npx vitest run      # Frontend: 128 tests
```

---

## Completed Items (2026-02-06)

- **Redis cache tests**: 40 tests re-enabled (was `describe.skip`)
- **Config mocks**: Removed from 5 test files (auth, claude, scraper.queue, xcontroller, token-refresh)
- **Winston mocks**: Removed from 3 test files (scheduler, scraper.queue, token-refresh)
- **Winston → Pino migration**: 4 source files (scraper.queue, token-refresh, scrape-scheduler, redis-cache.service)
- **Typed mock objects**: 3 test files (scrape-scheduler, token-refresh, scraper.queue)
- **Test setup**: Added auth env vars + LOG_LEVEL=silent
- **Root vitest config**: Separated frontend/server test runs (TD-10)
