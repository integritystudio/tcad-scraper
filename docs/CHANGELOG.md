## Recent Updates

### August 6, 2026 - Documentation Audit & Code Cleanup

- **CI Coverage**: Added GitHub Actions jobs for `workers/tcad-api/` (TypeScript, vitest, dry-run deploy) and E2E tests (Playwright)
- **Search term strategy**: Unified contradictory docs; confirmed Tier 1 (15 first names) is primary strategy; updated script references
- **Dead code cleanup**: Removed root `.eslintrc.json` (Biome is the formatter); updated stale schema READMEs; clarified formatter in CI docs
- **GTM/GA4 mismatch**: Fixed analytics config (GTM container ID vs GA4 measurement ID)
- **Type safety**: Expanded root `tsc --noEmit` to check `scripts/`, `utils/`, `shared/`, `e2e/` (not just `src/`)
- **D1 timestamps**: Verified all Prisma create paths use `nowEpoch()` for epoch millisecond initialization
- **Test coverage**: Added tests for API usage controller, auth logging, naturalLanguageSearch DB failure path, and connection health checks

See [changelog/2026-08-06.md](changelog/2026-08-06.md) for full audit details.

---

### March 30, 2026 - D1 Migration (PostgreSQL → Cloudflare D1)

- **Database cutover**: Migrated from PostgreSQL/Render/Hyperdrive to Cloudflare D1 (SQLite at edge)
- **Epoch date workaround**: D1's JS binding auto-converts ISO 8601 TEXT, corrupting dates. All date fields now stored as epoch millisecond strings (`"1711773684000"`); `nowEpoch()` / `epochToISO()` utilities added
- **Prisma adapter**: Switched to `PrismaD1` adapter; `@default("0")` replaces `@default(now())`
- **Bulk upsert**: `Prisma.$transaction` with individual upserts to avoid D1's 100-param limit
- **Array fields**: `newPropertyIds` stored as JSON-serialized string

See [changelog/2026-03-30.md](changelog/2026-03-30.md) for full migration details.

---

### March 20, 2026 - Cloudflare Workers Cutover (Express → Workers)

- **Production API**: Migrated from Express/BullMQ on Render to Cloudflare Workers (Hono) + Workflows
- **Queue**: Cloudflare Queues + Workflows replaced BullMQ + Redis
- **Cache**: Cloudflare KV replaced Redis cache
- **Logging**: Workers `console.*` + Sentry replaced Pino
- **Route**: `api.alephatx.info/*` served by Workers
- Legacy `server/` retained as read-only reference

---

### March 11, 2026 - Backlog Refactoring Completion (M16, M25, M26, M28, M29, M30)

- **Script consolidation**: Unified `getSearchedTermSets()`, `isSupersetOfSuccessful()`, `get2025Count()`, and enqueue utilities across 40+ CLI tools; merged queue-entity-searches variants; ~450 LOC eliminated
- **Logger standardization**: Completed migration from winston to Pino in all production scripts
- **Backlog cleanup**: Migrated 6 refactoring items (M16, M25, M26, M28, M29, M30) from backlog to changelog; all implemented in prior sessions but marked Done today

See [changelog/2026-03-11.md](changelog/2026-03-11.md) for full details.

---

### March 9, 2026 - TCAD API Diagnostics & Enqueue Infrastructure Consolidation + Code Review Cleanup

- **TCAD API JSON parse diagnostics** (`a3b838e`, `688c034`): Added content-length header capture, body preview (first/last 100 chars) logging, and structured `logger.warn` at JSON parse failure point for better troubleshooting of truncated/malformed responses
- **Enqueue infrastructure consolidation**: Extracted 199 curated 5-char first names into canonical `curated-first-names` batch config (ref: commit `0427d30`). Hispanic, Indian, Asian surnames already consolidated. Updated batch config count: 17 → 18
- **Code Review Cleanup** (B1–B11): TermSelector cache invalidation (20-batch refresh), docstring clarity, dead code removal, config extraction, script utilities, test coverage expansion (631/632 tests passing)
- **Backlog migration**: Consolidated C1 diagnostics task (task 6/6) and M1 data consolidation (tasks 1-2, 4/5); migrated 9 code review items to changelog; remaining: city name verification, term splits logic, 3 Medium/Low advisory findings

See [changelog/2026-03-09.md](changelog/2026-03-09.md) for full details.

---

### March 8, 2026 - Scripts Reorganization & Search Term Consolidation

- **Scripts reorganization** (`c7aabe6`): Moved scripts into `requeue/`, `utils/test-scripts/`, `one-off-and-test-batches/` subdirectories. Added `scripts/README.md` with full inventory.
- **Search term consolidation**: Created `utils/list-all-search-terms.ts` — deduplicated inventory of 593 non-numeric terms across `batch-configs.ts` and `continuous-batch-scraper.ts`. Importable or CLI.
- **Batch configs expanded**: 14 → 17 batch type definitions in `config/batch-configs.ts`
- **New scripts**: `enqueue-uncommon-names.ts`, `enqueue-by-category.ts`, `enqueue-prefix-expansions.ts`, `enqueue-08-08-search.ts`, `continuous-batch-scraper-lowthreshold.ts`
- **Backfill utilities**: `generate-next-200-terms.ts`, `generate-valid-5char-terms.ts`
- **Code review fixes** (`904b8d5`): Addressed findings from c7aabe6 — ESLint config cleanup, import path fixes
- **Test count**: 627 tests (626 passing, 1 flaky scheduler test)

---

### March 6, 2026 - Backfill Script Documentation & Test Hardening

- **Documentation**: Added filtering strategy docs (CR-M2), ::int cast comments (CR-M3), fixed stale comments (CR-M5)
- **Limitations**: Documented token-fetch-once-per-call (CR-L1 03-02) and no-timeout in drain (CR-L1 03-06)
- **Session Tracking**: Added totalGained accumulation to backfill-2025.ts (CR-L2)
- **Testing**: Strengthened constructor assertions from `toBeDefined()` to `toBeInstanceOf()` (TST-L1)

See [changelog/2026-03-06.md](changelog/2026-03-06.md) for full details.

---

### February 26, 2026 - Redis TLS Migration & Scraper Fixes

- **Render Redis migration**: All environments now use Render Redis with TLS (`rediss://`); local Docker Redis no longer required
- **TLS support**: Auto-detected from URL prefix; `buildRedisConfig()` handles Bull queue TLS parsing
- **NULL fix**: `COALESCE` + `|| 0` for null/NaN `appraised_value` from TCAD API
- **ON CONFLICT fix**: Upsert now uses `(property_id, year)` matching unique constraint
- **Docs updated**: Removed stale hobbes/PM2/local-Redis references across 5 files

See [changelog/2026-02-26.md](changelog/2026-02-26.md) for full details.

---

### February 8-9, 2026 - DRY Refactoring & Technical Debt Cleared

- **Consolidated enqueue scripts**: 10 separate scripts merged into a config-driven runner (`enqueue-batch.ts` + `batch-configs.ts` with 14 batch types)
- **Extracted shared utilities**: `getErrorMessage()` (50+ call sites), `launchTCADBrowser()`, `transformPropertyToSnakeCase()`, `humanDelay()`
- **Configurable TCAD year**: Replaced hardcoded `pYear=2025` with `TCAD_YEAR` env var (default: current year)
- **Configurable chunk size**: `QUEUE_BATCH_CHUNK_SIZE` env var for SQL batch inserts
- **All backlog cleared**: TD-2 through TD-40 resolved (type safety, logging, test coverage, code review findings)
- **Test suite**: 617 tests passing, 0 skipped, 0 failed (up from 493 in Feb 8 session)

---

### February 8, 2026 - Technical Debt Complete (TD-2 through TD-17)

**All technical debt resolved.** Backlog is empty.

**Production Type Safety** (TD-11):
- Replaced `as any` with narrowing casts in `auth.ts` (`as import("ms").StringValue`) and `index.ts` (Helmet literal union) (`be99993`)

**CLI Script Lint** (TD-12):
- ESLint override `no-console: off` for 3 CLI scripts, removed 9 inline `eslint-disable` comments (`3ded5a8`)

**Test Type Improvements** (TD-13, TD-16):
- Typed `api.test.ts` dynamic imports with `Express` and `PrismaClient` (`36f4450`)
- Replaced `require()` with ES module imports in `test-utils.ts` (`95bc64e`)

**Lint & Docs** (TD-14, TD-15, TD-17):
- ESLint `no-console` set to `"warn"` in test file overrides (`34783b6`)
- Type-safe test patterns documented in `docs/TESTING.md` (`b0c2f44`)
- Updated stale Jest references to Vitest in `TESTING.md` (`95bc64e`)

**Test Type Safety** (TD-8):
- Removed all 86 `as any` from 11 test files (`b57eac7`, `bb43a6e`, `517e4b7`)
- Patterns used: `Record<string, unknown>`, `Pick<Type, "key">`, `unknown as TypeCast`, `Record<string, ReturnType<typeof vi.fn>>`

**Test Logging** (TD-2):
- Replaced 21 `console.*` in 6 test files with `logger.debug()` (`5280dce`)

**Conditional Test Skipping** (TD-5):
- Replaced `describe.skip()` with `describe.skipIf()` using infrastructure checks (`97a34a2`)

**Earlier items**:
- TD-3: Replaced deprecated `startTransaction` with typed `startSpan<T>()` wrapper (`43c92f9`, `1f90485`)
- TD-6: Added `npm run lint` script using Biome (`43c92f9`)
- TD-7: Made `asyncHandler` generic, eliminated 3 `as any` in property routes (`43c92f9`)
- TD-9: All config mocks removed from both test files (`811ff05`)
- TD-10: Separated frontend/server test runs in root vitest config (`ffd324b`)
- Redis cache tests: 40 tests re-enabled (`85c3e5c`)
- Config mocks removed from 5 test files
- Winston mocks removed from 3 test files
- Winston → Pino migration in 4 source files
- Typed mock objects in 3 test files
- Test setup: Added auth env vars + LOG_LEVEL=silent

**Test Status**: 560 passing, 0 skipped, 0 failed | TypeScript clean | Lint configured

---

### February 2, 2026 - Test Infrastructure & Technical Debt

- **Test fixes**: Resolved mock pollution in `tcad-scraper.test.ts` (`vi.clearAllMocks()` → `vi.resetAllMocks()`); enabled 5 previously-skipped tests
- **Test status**: 520 passing (up from 515), 40 skipped (down from 45)
- **Technical debt**: Playwright mock pollution and test/implementation mismatches resolved

See [changelog/2026-02-02.md](changelog/2026-02-02.md) for full details.

---

### November 7, 2025 - Production Optimization

- **Automated token refresh**: 4-minute cron job; PM2 process management for continuous-enqueue and tcad-api
- **Performance milestone**: ~3,000 properties/minute (180K/hour); database surpassed 105,000 properties
- **Stability**: Fixed continuous-batch-scraper.ts syntax errors; PM2 auto-restart with 2GB memory limits

See [changelog/2025-11-07.md](changelog/2025-11-07.md) for full details.

---

### November 6, 2025

- Codebase analysis via ast-grep (1,444 console.log statements, 113 error handlers, 0 TODOs); documented 10.2 MB of cleanup candidates
- Consolidated error handling and logging using pino and pino-pretty

See [changelog/2025-11-06.md](changelog/2025-11-06.md) for full details.

---

### November 5, 2025

- Added AI-powered natural language search via Claude AI (Anthropic): `POST /api/properties/search` + connection-test endpoint
- Added Claude search documentation, test suite, and `ANTHROPIC_API_KEY` config

See [changelog/2025-11-05.md](changelog/2025-11-05.md) for full details.

---

### November 3, 2025

- README overhaul: current architecture, API endpoint docs, monitoring/metrics section, Docker services, troubleshooting guide

See [changelog/2025-11-03.md](changelog/2025-11-03.md) for full details.

---

### November 2, 2025

- Optimized weighted search term generation: 30 Austin neighborhoods, 150+ street names, 200+ first names, 500+ last names, 34 property types
- Database grew to 150,000+ properties on remote Linux environment

See [changelog/2025-11-02.md](changelog/2025-11-02.md) for full details.

---

### November 1, 2025

- Implemented dual scraping methods (API + browser-based); fixed browser-init race condition (`a8812a4`)
- Migrated to remote Linux with Docker Compose (Redis, Prometheus, BullMQ metrics); added Doppler secrets, Express API, Bull Dashboard

See [changelog/2025-11-01.md](changelog/2025-11-01.md) for full details.

---

### October 2024

- Initial project creation: Playwright-based scraper, PostgreSQL/Prisma, React frontend, basic Docker infrastructure

See [changelog/2024-10.md](changelog/2024-10.md) for full details.
