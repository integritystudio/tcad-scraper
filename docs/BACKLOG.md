# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-11 (enqueue consolidation research closed; city names verified)
**Status**: 680/680 tests passing | TypeScript clean | Lint clean

---
## Open Items


---

## Intentional Design Decisions

### M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data
**Status**: Intentional — DISPLAY_YEAR is deliberately pinned to 2025; not a bug. TCAD appraised values for 2026 are marked as "N/A" until published (expected April/May 2026).

---

## Test Coverage Gaps (2026-03-10, L25–L35 session)

### TC-18: test-api-direct.ts needs modernization (2026-03-11)
**Priority**: P4 | **Source**: codebase-analyzer cleanup

`test-api-direct.ts` (moved from `src/` to `server/src/__tests__/`) is an early exploration script that brute-forces TCAD API endpoints. It predates the production `tcad-api-client.ts` and uses hardcoded URLs, emoji logging, and `error.message` without type narrowing. Decide whether to convert into a proper integration test against `tcad-api-client.ts` or delete entirely. -- `server/src/__tests__/test-api-direct.ts`

### TC-10: naturalLanguageSearch DB failure path untested
**Priority**: P3 | **Source**: L27 implementation + code review

The `naturalLanguageSearch` method now returns 503 on both Claude API failure and DB failure, but only the Claude failure path is tested (via `property.routes.claude.test.ts` "should handle errors gracefully"). No test exercises the DB try/catch branch (`"Database query failed"` response). Mock `prismaReadOnly.property.findMany` to throw and assert 503 with `error: "Database query failed"`. -- `server/src/controllers/property.controller.ts`

### TC-11: scrapeProperties job.id guard untested
**Priority**: P4 | **Source**: L28 implementation

The `if (!job.id)` guard returns 500 when BullMQ produces a job without an ID. No test covers this path. Mock `scraperQueue.add()` to return `{ id: undefined }` and assert 500 response. -- `server/src/controllers/property.controller.ts`

### TC-12: canScheduleJob TOCTOU race condition untested
**Priority**: P4 | **Source**: L29 code review (low finding)

The get-then-set pattern in `canScheduleJob` has a TOCTOU window where concurrent requests for the same term can both observe `null` from `cacheService.get()` and both return `true`. No test covers this scenario. Consider using Redis `SET NX PX` (atomic set-if-not-exists with TTL) or add a test documenting the limitation. -- `server/src/queues/scraper.queue.ts`

### TC-13: api-usage.controller has no unit tests
**Priority**: P3 | **Source**: L32 implementation

`ApiUsageController` has no dedicated test file. The `typeof` guards on `days`, `environment`, `limit`, and `offset` are untested. The `$queryRaw` parameterization via `Prisma.sql` is also untested. Additionally, `day.total_cost.toFixed(6)` (line ~146) has a potential null-dereference if `SUM(query_cost)` returns null — a test should cover this edge case. -- `server/src/controllers/api-usage.controller.ts`

### TC-14: optionalAuth debug log emission untested
**Priority**: P4 | **Source**: L31 implementation

`optionalAuth` now calls `logger.debug()` on JWT verification failure, but no test asserts the log message is emitted. Add a test that passes an invalid token and verifies `logger.debug` was called with the error context. -- `server/src/middleware/auth.ts`

### TC-15: auth-database integration test requires live DB (2026-03-11)
**Priority**: P3 | **Source**: integration test failure during CI setup

`auth-database.integration.test.ts` fails when `DATABASE_URL` falls back to `localhost:5432` (test setup.ts:46-49). The test imports `prisma` directly and calls `prisma.property.deleteMany()` in `afterAll`, which crashes if the DB is unreachable. Consider adding a `beforeAll` connection check that skips the suite (like the existing `isRedisAvailable` pattern) instead of letting Prisma throw. -- `server/src/__tests__/auth-database.integration.test.ts`

### TC-16: integration test coverage artifact path was misconfigured (2026-03-11)
**Priority**: P4 | **Source**: CI run 22975946334

`vitest.integration.config.ts` had `coverage.enabled: false` with no `reportsDirectory`, so `npm run test:integration:coverage` produced no output at `./server/coverage/integration/`. Fixed in `8864406` — verify CI produces artifacts on next run. -- `server/vitest.integration.config.ts`

### TC-17: scrape endpoint auth expectations brittle across environments (2026-03-11)
**Priority**: P3 | **Source**: 5 consecutive CI failures (commits 996d19b–b4ba3b2)

`api.test.ts` scrape and monitor endpoint tests hardcoded `expect(status).toBe(200)` but the endpoints return 401 when `apiKeyAuth` is enforced (which Doppler prod config enables). Required iterative fixes to accept `[200, 401]`. Consider extracting a shared helper like `expectStatusOneOf(response, [200, 401])` or conditionally setting auth headers based on the test environment config. -- `server/src/__tests__/api.test.ts`

---

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 6 items migrated to [changelog/2026-03-11.md](../changelog/2026-03-11.md) (M16, M25, M26, M28, M29, M30 refactoring completion)
