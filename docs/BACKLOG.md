# Backlog - Remaining Technical Debt

**Last Updated**: 2026-08-06 (docs/root audit; stale docs archived, dead code pruned)
**Status**: 130 frontend + 16 workers + 680 legacy server tests passing | TypeScript clean | Lint clean

---
## Open Items

### ~~AUD-01: No CI coverage for workers/tcad-api (production API)~~
**Status**: Done | **Priority**: P1 | **Source**: docs/root audit (2026-08-06)

No workflow builds, tests, type-checks, or deploys `workers/tcad-api/` — zero `wrangler deploy` steps, zero `workers/**` paths in any job. Meanwhile `ci.yml` spins up Postgres 16 + Redis 7 service containers and runs `prisma migrate deploy` against the non-canonical legacy `server/prisma/` schema, `integration-tests.yml` triggers only on `server/**` paths, and `pr-checks.yml`'s changed-file categories have no `workers/**` entry. The entire production surface is ungated; deploys are manual. Add a workers job (tsc + vitest + `wrangler deploy --dry-run`) and retire or clearly label the legacy-stack jobs. -- `.github/workflows/ci.yml`, `integration-tests.yml`, `pr-checks.yml`

### AUD-02: E2E suite never runs in CI
**Priority**: P2 | **Source**: docs/root audit (2026-08-06)

No workflow runs Playwright despite "126/126 E2E passing" claims in README/CLAUDE.md. Add a Playwright job (or drop the claim). -- `.github/workflows/`, `playwright.config.ts`

### AUD-03: Search-term strategy docs contradict each other on first names
**Priority**: P2 | **Source**: docs audit (2026-08-06)

`docs/search_results.md` (2026-03-20, pre-D1 data) concludes "skip all common first names" while `docs/2025_BACKFILL_QUICK_REFERENCE.md` and `docs/2025_BACKFILL_OPTIMIZATION.json` (2026-03-30) make first names the entire Tier 1. Decide which analysis wins, cross-reference or archive the loser. Also: the Quick Reference's primary Tier 1/2 command `npx tsx scripts/enqueue-terms.ts` references a deleted script — replace with `generate-next-200-terms.ts --enqueue` or `lib/queue-utils.ts::enqueueBatch()`. -- `docs/search_results.md`, `docs/2025_BACKFILL_QUICK_REFERENCE.md`

### AUD-04: Root .eslintrc.json is dead — delete it
**Priority**: P3 | **Source**: root audit (2026-08-06; corrected by post-commit review)

Root lint is Biome (`"lint": "biome check ."`) and root has no eslint dependency, so `.eslintrc.json` is unrunnable from root. `server/` has its own `server/.eslintrc.json` with `"root": true`, so server's lint never reads the root file either — it can simply be deleted. Also rename `ci.yml`'s "Run ESLint (Root)" step, which actually runs Biome with `continue-on-error: true`. -- `.eslintrc.json`, `.github/workflows/ci.yml:43-49`

### AUD-05: Auto-generated schema READMEs describe deleted files
**Priority**: P3 | **Source**: src.xml audit (2026-08-06)

"Schema Generator" READMEs are stale: `src/README.md` documents deleted `database.ts`/`query-db.ts` (pg-based) and a pre-rewrite App.tsx; `src/components/README.md` lists deleted `ScrapeManager.tsx`. `src/components/features/PropertySearch/README.md` (2025-11-08) references nonexistent `ExampleQueries.tsx` and links four design docs that don't exist (COMPONENT_IMPLEMENTATION_GUIDE, VISUAL_DESIGN_PLAN, VISUAL_WIREFRAMES, ARCHITECTURE). Re-run the generator or delete the stale files; fix or drop the PropertySearch README links. -- `src/README.md`, `src/components/README.md`, `src/components/features/PropertySearch/README.md`

### AUD-06: docs/CHANGELOG.md stops before the Cloudflare migration
**Priority**: P3 | **Source**: docs audit (2026-08-06)

The most-recent-first changelog ends at 2026-03-11, omitting the Workers cutover (2026-03-20) and D1 migration (2026-03-30) even though `docs/changelog/2026-03-30.md` exists. Add summary entries pointing at the per-date files. Also `docs/ANALYTICS.md` cites GTM ID `G-ECH51H8L2Z`; `index.html` uses container `GTM-NR4GGH5K` (a `G-` prefix is a GA4 measurement ID, not a GTM container). -- `docs/CHANGELOG.md`, `docs/ANALYTICS.md`

### AUD-07: pr-checks.yml advises a format script that doesn't exist
**Priority**: P4 | **Source**: root audit (2026-08-06)

The Code Quality job runs `npx prettier --check` in `server/` and tells contributors to "Run `npm run format`" — Prettier isn't a server dependency and no `format` script exists (Biome is the formatter). Also `ci.yml`'s root `npx tsc --noEmit` type-checks only `src/` (tsconfig.app.json), leaving `scripts/`, `utils/`, `shared/`, `e2e/` unchecked. -- `.github/workflows/pr-checks.yml:71-90`, `.github/workflows/ci.yml:52`

### AUD-08: Legacy TC-10..TC-18 items reference deleted server/src/queues
**Priority**: P4 | **Source**: docs audit (2026-08-06)

TC-11 and TC-12 below are unactionable — `server/src/queues/` no longer exists (BullMQ removal, 287ca63). Close them or re-scope to the Workers queue consumer. -- this file

### D1-01: Prisma create calls missing explicit epoch timestamps
**Priority**: P2 | **Source**: D1 migration (2026-03-30)

`@default("0")` in the SQLite Prisma schema doesn't auto-populate date fields like PostgreSQL's `@default(now())` did. All `prisma.*.create()` calls need explicit `createdAt: nowEpoch()` and `updatedAt: nowEpoch()` values, otherwise these fields store `"0"` and render as empty strings in API responses. Affected: `scrapeJob.create` (Step 1), `monitoredSearch.upsert` create path, `searchTermAnalytics.upsert` create path, property upsert create path. -- `workers/tcad-api/src/workflows/scraper.workflow.ts`, `workers/tcad-api/src/controllers/property.ts`

### D1-02: Job history endpoint returns raw epoch strings
**Priority**: P3 | **Source**: D1 migration (2026-03-30)

`GET /api/properties/history` returns `startedAt` and `completedAt` as raw epoch millisecond strings (e.g. `"1774912267251"`) instead of ISO 8601. Add `epochToISO()` transform in the history response mapping if the frontend needs human-readable dates. -- `workers/tcad-api/src/controllers/property.ts`

### D1-03: Rotate Render database password
**Priority**: P1 | **Source**: D1 migration session (2026-03-30)

The Render PostgreSQL connection string (including password) was exposed in terminal output during the `pg_dump` step. Rotate the password in the Render dashboard and update the Doppler `DATABASE_URL` secret. The Render database is still running as a safety net per the migration plan — keep it active for at least 2 weeks post-cutover.

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

**Latest migration**: D1 migration implementation guide migrated to [changelog/2026-03-30.md](changelog/2026-03-30.md)
