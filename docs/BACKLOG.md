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

### L25: Fix enqueue-prefix-expansions.ts to use shared waitForQueueDrain
**Priority**: P3 | **Source**: repomix-explorer session 2026-03-09
`enqueue-prefix-expansions.ts` already imports `waitForQueueDrain` from `lib/queue-utils.ts` (line 13). ~~Reimplements its own version.~~ Resolved — verified import at line 13.

### L26: Consolidate hardcoded job options to use config.queue.defaultJobOptions
**Priority**: P3 | **Source**: repomix-explorer session 2026-03-09
`enqueue-terms.ts` hardcodes job options `{ attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 50 }` instead of using shared config. Consolidate to `lib/queue-utils.ts` pattern. -- `server/src/scripts/enqueue-terms.ts`

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 3 items migrated to [changelog/2026-03-09.md](../changelog/2026-03-09.md) (TCAD API JSON failures, Documentation Staleness Audit, Documentation Staleness Follow-up)
