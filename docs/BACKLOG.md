# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-10 (dead code cleanup + new backlog items from repomix analysis)
**Status**: 124/124 tests passing | TypeScript clean | Lint clean

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

### C1: SQL Injection in api-usage.controller.ts
**Priority**: P1 | **Source**: code-reviewer 2026-03-10

`$queryRaw` template literal embeds conditional string interpolation that bypasses Prisma parameterization. Attackers can inject SQL via the `environment` query parameter. Use `Prisma.sql` helper or refactor to Prisma client methods. -- `server/src/controllers/api-usage.controller.ts:50-60`

---

### M31: Bull Dashboard lacks authentication
**Priority**: P2 | **Source**: code-reviewer 2026-03-10

`/admin/queues` endpoint is fully public and exposes job payloads, queue history, and drain controls. Add `apiKeyAuth` middleware before `serverAdapter.getRouter()`. -- `server/src/index.ts:91-99`

### M32: Hardcoded JWT fallback secret in config
**Priority**: P2 | **Source**: code-reviewer 2026-03-10

`config/index.ts` line 146 uses `process.env.JWT_SECRET || "fallback-secret-change-in-production"`. While guarded in production by `validateConfig()`, the fallback is evaluated and usable in dev/test environments. Replace with `?? ""` and guard generation. -- `server/src/config/index.ts:146`

### M33: Redis TLS certificate verification disabled
**Priority**: P2 | **Source**: code-reviewer 2026-03-10

Both `scraper.queue.ts:44` and `redis-cache.service.ts:26` set `rejectUnauthorized: false`, disabling TLS certificate verification. Render-managed Redis uses valid CA-signed certs. Remove the flag or set to `true`. -- `server/src/queues/scraper.queue.ts:44`, `server/src/lib/redis-cache.service.ts:26`

### M34: Blocking execSync in config initialization
**Priority**: P2 | **Source**: code-reviewer 2026-03-10

`config/index.ts:181-187` calls `execSync()` synchronously at module load time to fetch `ANTHROPIC_API_KEY` via doppler CLI. Blocks event loop 100-500ms on cold start. Refactor to async config initialization or rely exclusively on Doppler env injection. -- `server/src/config/index.ts:181-187`

### ~~M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data~~
**Status**: Intentional — DISPLAY_YEAR is deliberately pinned to 2025; not a bug.

### M36: Unprotected write endpoints allow mass job enqueueing
**Priority**: P2 | **Source**: code-reviewer 2026-03-10

`POST /api/properties/scrape` and `POST /api/properties/monitor` use `optionalAuth` only. Public clients can enqueue unlimited scrape jobs via distinct terms (in-process rate limiter only blocks same term twice per 5 sec). Add `apiKeyAuth` to write endpoints. -- `server/src/index.ts:281`, `server/src/routes/property.routes.ts`

---

### L27: Missing try/catch in naturalLanguageSearch database calls
**Priority**: P3 | **Source**: code-reviewer 2026-03-10

`property.controller.ts:130-196` has no error boundary around three `prismaReadOnly` calls. Prisma errors propagate as unhandled promise rejections, leaking `err.message` in responses. Wrap DB block in try/catch. -- `server/src/controllers/property.controller.ts:130-196`

### L28: Unsafe job.id.toString() with undefined guard
**Priority**: P3 | **Source**: code-reviewer 2026-03-10

`property.controller.ts:37` calls `job.id.toString()` without null check. If `job.id` is `undefined`, returns string `"undefined"` as job ID, which clients then poll. Add guard: `if (!job.id) throw new Error("Queue returned job without ID")`. -- `server/src/controllers/property.controller.ts:37`

### L29: In-memory rate limiter ineffective across replicas
**Priority**: P3 | **Source**: code-reviewer 2026-03-10

`canScheduleJob()` uses process-local `Map` to rate-limit scrape requests. With multiple Render replicas, each gets a fresh Map and rate limit resets on restart. Use Redis TTL key instead. -- `server/src/queues/scraper.queue.ts:263-278`

### L30: No length cap on natural language query sent to Claude
**Priority**: P3 | **Source**: code-reviewer 2026-03-10

`claude.service.ts:156` passes raw `query` to Claude prompt without max length validation. Risk of prompt inflation and token burn. Verify Zod schema enforces `max()` length or add `.max(500)`. -- `server/src/lib/claude.service.ts:156`

### L31: Silent error swallowing in optionalAuth middleware
**Priority**: P3 | **Source**: code-reviewer 2026-03-10

`auth.ts:66-67` catches JWT verification errors and silently discards with no log entry, making auth debugging invisible. Add `logger.debug()` on error. -- `server/src/middleware/auth.ts:66-67`

### L32: Unvalidated as string casts on query parameters
**Priority**: P3 | **Source**: code-reviewer 2026-03-10

`api-usage.controller.ts:7,16` use `as string` casts on `req.query` params without validation. If client sends array `?days[]=5&days[]=10`, `days as string` produces `NaN`. Add `validateQuery` schema. -- `server/src/controllers/api-usage.controller.ts:7,16`

### L33: process.env.NODE_ENV read directly instead of config object
**Priority**: P4 | **Source**: code-reviewer 2026-03-10

`error.middleware.ts:48,51` reads `process.env.NODE_ENV` directly instead of using `config.env.isDevelopment`. Bypasses centralized config. Replace with `import { config }` and use `config.env.isDevelopment`. -- `server/src/middleware/error.middleware.ts:48,51`

### L34: isDevelopment=true during test leaks error messages
**Priority**: P4 | **Source**: code-reviewer 2026-03-10

`config/index.ts` sets `isDevelopment: NODE_ENV !== "production"`, which is true in test environment (`NODE_ENV=test`). Integration tests with actual server leak error messages in 500 responses. Add exclusive `isTest`, `isProduction`, `isDevelopment` flags. -- `server/src/config/index.ts`

### ~~L35: CommonJS require.main === module idiom in ESM project~~
Done — `tsconfig.json` has `"module": "commonjs"`; `require.main === module` is the correct pattern for this project. No change needed.

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 3 items migrated to [changelog/2026-03-09.md](../changelog/2026-03-09.md) (TCAD API JSON failures, Documentation Staleness Audit, Documentation Staleness Follow-up)
