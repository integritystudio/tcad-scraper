# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-10 (L25–L35 backlog items implemented + test coverage gaps documented)
**Status**: 678/678 tests passing | TypeScript clean | Lint clean

---
## Open Items

### Consolidate enqueue scripts and search term infrastructure (2026-03-08)

**Context**: Codebase cleanup identified overlapping search term systems. Dead code (`enqueue-by-category.ts`, `one-off-and-test-batches/`, `utils/test-scripts/`, `migrate-to-logger.ts`) deleted 2026-03-10. Remaining: 2 active systems with overlapping term data.

**Files**:
- `server/src/scripts/enqueue-batch.ts` + `config/batch-configs.ts` — active, canonical. Config-driven CLI with 18 batch types and priority system
- `server/src/scripts/continuous-batch-scraper.ts` — active, long-running scraper that auto-generates and enqueues terms

**Research tasks** (remaining: city verification):
1. Determine if Texas city names yield results in TCAD search (cities historically don't work per CLAUDE.md — verify before adding)

---

### M28: Extract `getSearchedTerms()` to shared `lib/searched-terms.ts`
**Priority**: P2 | **Source**: repomix-explorer analysis 2026-03-10

**Problem**: 7 scripts independently build a `Set<string>` of already-searched terms by querying analytics + recent jobs + properties. Each reimplements slightly different logic, risking drift.

**Affected files** (each has its own inline implementation):
- `server/src/scripts/backfill-2025.ts:23` — `getSearchedTerms()` returns `{ searched2025, allSearched, successful }`
- `server/src/scripts/backfill-2025-novel.ts:22` — `getSearchedTerms()` returns `Set<string>`
- `server/src/scripts/backfill-2025-unsearched.ts:22` — `getTermSets()` returns `{ searched, successful, searched2025 }`
- `server/src/scripts/enqueue-prefix-expansions.ts:43` — inline `searched = new Set<string>()` block
- `server/src/scripts/enqueue-uncommon-names.ts:191` — inline `searched = new Set<string>()` block
- `server/src/scripts/generate-next-200-terms.ts:120` — inline `searched = new Set<string>()` block
- `server/src/scripts/generate-valid-5char-terms.ts:252` — inline `searched = new Set<string>()` block

**Refactoring plan**:
1. Create `server/src/scripts/lib/searched-terms.ts` exporting `getSearchedTermSets()` returning `{ searched2025: Set<string>; allSearched: Set<string>; successful: Set<string> }`
2. Replace all 7 inline implementations with shared import
3. Estimated savings: ~120 LOC, eliminates logic drift risk

---

### M29: Unify `enqueueBatch` and `enqueueBatchGeneric` into single enqueue utility
**Priority**: P2 | **Source**: repomix-explorer analysis 2026-03-10

**Problem**: Two independent enqueue utilities exist with different APIs and job option sources:
- `server/src/scripts/lib/queue-utils.ts:28` — `enqueueBatch(terms, userId, logger?)` uses `config.queue.defaultJobOptions`; consumed by 9 scripts
- `server/src/scripts/utils/batch-enqueue.ts:48` — `enqueueBatchGeneric(BatchEnqueueConfig)` uses hardcoded `{ attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 50 }` + rich logging; consumed only by `enqueue-batch.ts`

**Key differences**:
| Feature | `enqueueBatch` | `enqueueBatchGeneric` |
|---------|---------------|----------------------|
| Job options | `config.queue.defaultJobOptions` | Hardcoded |
| Priority | Not supported | Accepts `priority` param |
| Logging | Optional `EnqueueLogger` | Rich emoji + batch name |
| Return | `number` (count) | `BatchEnqueueResult` (success/fail/total) |
| Error handling | Per-term try/catch, logs via logger | Per-term try/catch, logs via pino |

**Refactoring plan**:
1. Extend `enqueueBatch` in `lib/queue-utils.ts` with optional `priority` and `batchName` params
2. Move `BatchEnqueueConfig`/`BatchEnqueueResult` interfaces to `lib/queue-utils.ts`
3. Update `enqueue-batch.ts` to use unified function
4. Delete `utils/batch-enqueue.ts`
5. Estimated savings: ~80 LOC

---

### M30: Extract `isSupersetOfSuccessful` and backfill `main()` loop to shared utilities
**Priority**: P2 | **Source**: repomix-explorer analysis 2026-03-10

**Problem**: Two distinct duplication patterns across backfill scripts.

**Pattern 1 — `isSupersetOfSuccessful` exact duplicate** (3 files):
- `server/src/scripts/backfill-2025.ts:56` — standalone function `(lower, successful) => boolean`
- `server/src/scripts/backfill-2025-unsearched.ts:61` — identical copy
- `server/src/scripts/generate-search-terms.ts:299` — closure variant (captures `successful` from scope)

Move to `lib/backfill-utils.ts` alongside existing `get2025Count`.

**Pattern 2 — backfill `main()` loop** (~60 LOC duplicated across 4 files):
- `backfill-2025.ts`, `backfill-2025-proven.ts`, `backfill-2025-unsearched.ts`, `backfill-2025-novel.ts`
- Identical structure: year guard → print header → early exit → get terms → batch loop (check target, slice, enqueueBatch, waitForQueueDrain, count gained, consecutive-zero tracking) → final report → `.catch`/`.finally` cleanup
- Only differ in: term-sourcing function, userId string, header text

**Refactoring plan**:
1. Move `isSupersetOfSuccessful` to `lib/backfill-utils.ts`
2. Create `lib/backfill-runner.ts` exporting `runBackfill({ getTerms, userId, label })` with the generic main loop
3. Reduce each backfill script to ~20 lines (term-sourcing function + config)
4. Estimated savings: ~200 LOC

---

### M16: Replace `winston` logger with Pino in production scripts
**Priority**: P2 | **Source**: code-reviewer 2026-03-09, item 16 (DEFERRED)

**Problem**: 2 scripts still create inline `winston.createLogger()` instances instead of using the shared Pino logger (`../../lib/logger`). The winston logger in `continuous-batch-scraper.ts` also hardcodes a file transport path (`logs/continuous-scraper.log`).

**Affected files**:
- `server/src/scripts/continuous-batch-scraper.ts:2,16-25` — `import winston` + 9-line logger creation with Console + File transports
- `server/src/scripts/clear-all-jobs.ts:1,4-8` — `import winston` + 5-line logger creation with Console transport only

**Refactoring plan**:
1. Replace both winston imports with `import logger from "../../lib/logger"`
2. Remove inline `winston.createLogger()` blocks
3. If file transport is needed for continuous-batch-scraper, configure via Pino's `pino.destination()` or environment-based transport
4. Verify `winston` can be removed from `package.json` if no other consumers exist

---

### M25: Consolidate queue-entity-searches.ts and queue-entity-searches-fresh.ts
**Priority**: P2 | **Source**: repomix-explorer session 2026-03-09
Both files share identical 52-term `ENTITY_TERMS` array. The only behavioral difference is that `-fresh.ts` cleans up failed jobs before enqueueing. Merge into single script with `--fresh` flag to eliminate ~150 LOC duplication. -- `server/src/scripts/queue-entity-searches*.ts`

### M26: Extract get2025Count() and related helpers to lib/backfill-utils.ts
**Priority**: P2 | **Source**: repomix-explorer session 2026-03-09
`get2025Count()` function is copy-pasted identically across 4 backfill scripts (backfill-2025.ts, backfill-2025-proven.ts, backfill-2025-unsearched.ts, backfill-2025-novel.ts). Also duplicates `MAX_CONSECUTIVE_ZERO_BATCHES` and `getSearchedTerms()` variants. Extract to shared `lib/backfill-utils.ts` and import across all 4 scripts. -- `server/src/scripts/backfill-2025*.ts`

### ~~M27: Replace continuous-batch-scraper-lowthreshold.ts with --low-threshold flag~~
Done — `LOW_THRESHOLD_TIER_CONFIG` extracted, duplicate file deleted (ce344a7)

### ~~L25: Fix enqueue-prefix-expansions.ts to use shared waitForQueueDrain~~
Done — already imports `waitForQueueDrain` from `lib/queue-utils.ts` at line 13; no duplicate implementation exists.

### ~~L26: Consolidate hardcoded job options to use config.queue.defaultJobOptions~~
Done — `enqueue-terms.ts` already delegates entirely to `enqueueBatch()` in `lib/queue-utils.ts`, which uses `config.queue.defaultJobOptions`; no hardcoded job options remain.

---

## Security Findings from Code Review (2026-03-10)

### ~~C1: SQL Injection in api-usage.controller.ts~~
Done — already resolved by L32: `$queryRaw` uses `Prisma.sql\`AND environment = ${envFilter}\`` with proper parameterization; no string interpolation bypasses Prisma. -- `server/src/controllers/api-usage.controller.ts:77`

---

### ~~M31: Bull Dashboard lacks authentication~~
Done — added `apiKeyAuth` before `serverAdapter.getRouter()` at `server/src/index.ts`. (commit 0da93ab)

### ~~M32: Hardcoded JWT fallback secret in config~~
Done — replaced `|| "fallback-secret-change-in-production"` with `?? ""`. (commit e3dc189)

### ~~M33: Redis TLS certificate verification disabled~~
Done — removed `rejectUnauthorized: false` from both Redis configs. (commit 364585e)

### ~~M34: Blocking execSync in config initialization~~
Done — removed IIFE that called doppler CLI via execSync(). (commit 5a0cca1)

### ~~M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data~~
**Status**: Intentional — DISPLAY_YEAR is deliberately pinned to 2025; not a bug.

### ~~M36: Unprotected write endpoints allow mass job enqueueing~~
Done — added `apiKeyAuth` to `POST /scrape` and `POST /monitor` in `property.routes.ts`. Updated tests. (commit 5472f00)

---

### ~~L27: Missing try/catch in naturalLanguageSearch database calls~~
Done — wrapped all three `prismaReadOnly` calls in `naturalLanguageSearch` in a single try/catch returning 503 on DB errors. -- `server/src/controllers/property.controller.ts`

### ~~L28: Unsafe job.id.toString() with undefined guard~~
Done — added `if (!job.id)` guard returning 500 before `.toString()` call. -- `server/src/controllers/property.controller.ts`

### ~~L29: In-memory rate limiter ineffective across replicas~~
Done — replaced in-memory `Map` with `cacheService.get/set` using Redis TTL. Rate limits now apply across all Render replicas and survive restarts. -- `server/src/queues/scraper.queue.ts`

### ~~L30: No length cap on natural language query sent to Claude~~
Done — added `.max(500)` to `naturalLanguageSearchSchema.query` in property.types.ts; Zod validation rejects oversized queries at the route level before Claude is called. -- `server/src/types/property.types.ts`

### ~~L31: Silent error swallowing in optionalAuth middleware~~
Done — added `logger.debug()` on JWT verify errors in `optionalAuth` catch block. -- `server/src/middleware/auth.ts`

### ~~L32: Unvalidated as string casts on query parameters~~
Done — replaced `as string` casts with `typeof x === "string"` guards for both `days` and `environment` params. `$queryRaw` now uses the validated `envFilter` variable. -- `server/src/controllers/api-usage.controller.ts`

### ~~L33: process.env.NODE_ENV read directly instead of config object~~
Done — replaced `process.env.NODE_ENV === "development"` with `config.env.isDevelopment` in error handler. -- `server/src/middleware/error.middleware.ts`

### ~~L34: isDevelopment=true during test leaks error messages~~
Done — changed `isDevelopment: process.env.NODE_ENV === "development"` (exclusive, not `!== "production"`). Auth middleware updated to also skip in `isTest`. error.middleware test updated to mock config instead of mutating `process.env.NODE_ENV`. -- `server/src/config/index.ts`, `server/src/middleware/auth.ts`

### ~~L35: CommonJS require.main === module idiom in ESM project~~
Done — `tsconfig.json` has `"module": "commonjs"`; `require.main === module` is the correct pattern for this project. No change needed.

---

## Test Coverage Gaps (2026-03-10, L25–L35 session)

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

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 3 items migrated to [changelog/2026-03-09.md](../changelog/2026-03-09.md) (TCAD API JSON failures, Documentation Staleness Audit, Documentation Staleness Follow-up)
