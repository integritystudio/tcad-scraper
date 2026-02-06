# Technical Debt Registry

**Last Updated**: 2026-02-02

This document tracks known technical debt items that need to be addressed.

---

## Test Infrastructure Issues

### 1. Redis Cache Service Tests - ✅ RESOLVED (2026-02-06)

**File**: `server/src/lib/__tests__/redis-cache.service.test.ts`

**Status**: All 40 tests now pass (was entire suite skipped with `describe.skip()`)

**Resolution**:
- Used `vi.hoisted()` for stable mock client state across test lifecycle
- Replaced `vi.clearAllMocks()` with `vi.resetAllMocks()` in `beforeEach`
- Re-apply default resolved values after reset to prevent mock pollution
- Removed config mock (real config from env vars)
- Migrated source file from Winston to Pino logger, mocked `../logger` instead

**Commit Reference**: Mock cleanup session 2026-02-06

---

### 2. TCAD Scraper Tests - ✅ RESOLVED (2026-02-02)

**File**: `server/src/lib/__tests__/tcad-scraper.test.ts`

**Status**: All 21 tests now pass (was 16 passing, 5 skipped)

**Resolution**:
- Changed `vi.clearAllMocks()` → `vi.resetAllMocks()` to fix mock pollution
- Re-established mock behavior after reset in `beforeEach`
- Updated 2 tests to match actual implementation behavior:
  - `scrapePropertiesWithFallback` throws on error (not returns [])
  - `cleanup()` propagates browser close errors (doesn't swallow them)

**Commit Reference**: Bugfix session 2026-02-02

---

## Integration Tests (Excluded from Unit Test Suite)

The following tests require external services and are excluded from the default `npm test` command. They should be run with `npm run test:integration` when infrastructure is available.

| Test File | Requires |
|-----------|----------|
| `auth-database.integration.test.ts` | PostgreSQL via Tailscale |
| `integration.test.ts` | Redis, PostgreSQL, Built Frontend |
| `security.test.ts` | Full app infrastructure |
| `property.routes.claude.test.ts` | Anthropic API key |

These are properly excluded in both:
- `vite.config.ts` (root)
- `server/vitest.config.ts`

---

## Current Test Status

After mock cleanup session 2026-02-06:

| Metric | Value |
|--------|-------|
| Test Files Passed | 25 |
| Test Files Skipped | 0 |
| Tests Passed | 560 |
| Tests Skipped | 0 |
| Tests Failed | 0 |

**Changes since 2026-02-02**:
- redis-cache.service.test.ts: +40 tests re-enabled (all passing)
- Removed config mocks from 5 test files
- Removed winston mocks from 3 test files
- Migrated 4 source files from Winston to Pino logger

---

## Recommendations

### Short-term (Current Session)
- [x] Skip failing tests to unblock development
- [x] Document root causes
- [x] Update vitest configs to exclude integration tests

### Medium-term
- [x] ~~Refactor redis-cache.service.test.ts mock infrastructure~~ (RESOLVED 2026-02-06)
- [x] ~~Refactor tcad-scraper.test.ts Playwright mocks~~ (RESOLVED 2026-02-02)
- [x] ~~Add test for new `scrapePropertiesWithFallback` behavior~~ (test updated 2026-02-02)
- [ ] See `docs/BACKLOG.md` for remaining items

### Long-term
- [ ] Consider using testcontainers for Redis integration tests
- [ ] Add CI/CD pipeline with proper infrastructure for integration tests
- [ ] Increase test coverage to 60% target (currently ~35%)
