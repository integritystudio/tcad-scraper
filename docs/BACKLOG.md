# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-10 (backlog-implementer session 3 — TC-05–TC-09 + item 6)
**Status**: 124/124 tests passing | TypeScript clean | Lint clean

---
## Open Items

### Consolidate enqueue scripts and search term infrastructure (2026-03-08)

**Context**: Codebase cleanup identified 3 overlapping search term systems with unique data in each. Currently the root-level script is dead code (broken imports).

**Files**:
- `server/src/scripts/one-off-and-test-batches/enqueue-by-category.ts` — dead code (broken `__dirname`, direct `PrismaClient`). Categorizes 5-char terms against 4 dictionaries
- `server/src/scripts/enqueue-batch.ts` + `config/batch-configs.ts` — active, canonical. Config-driven CLI with 18 batch types and priority system
- `server/src/scripts/continuous-batch-scraper.ts` — active, long-running scraper that auto-generates and enqueues terms

**Unique data at risk of loss in `enqueue-by-category.ts`**:
- ~200 curated 5-char first names (not in batch-configs)
- 48 Hispanic surnames: Acuna, Adame, Anaya, Avila, Baeza, Banda, Bello, Bosco, Bravo, Bueno, Calvo, Campo, Casas, Cerda, Chapa, Coria, Corzo, Duran, Garzo, Lerma, Llano, Loera, Lujan, Mares, Marin, Mejia, Mendo, Milla, Monje, Nieto, Oliva, Ozuna, Parra, Ponce, Reyna, Rocha, Rojas, Roque, Saenz, Serna, Tamez, Tello, Tovar, Uribe, Valde, Valez, Viera
- 20 Indian surnames: Bajaj, Bhatt, Batra, Dixit, Joshi, Kapur, Kumar, Mehta, Mehra, Misra, Nagar, Naidu, Nanda, Pande, Reddy, Sethi, Sinha, Sodhi, Verma, Yadav
- 7 Asian surnames: Chang, Hsiao, Huang, Hwang, Jiang, Liang, Tsang
- 29 Texas city names: Alamo, Aledo, Alice, Allen, Bryan, Cisco, Clyde, Crane, Cuero, Donna, Eagle, Elgin, Emory, Ennis, Freer, Hondo, Hutto, Llano, Manor, Marfa, Mason, Mexia, Moran, Olney, Pampa, Pecos, Plano, Tyler, Wells

**Unique features in `batch-configs.ts`**:
- Priority tiering (-100 ultra to 2 standard)
- `HIGH_RESULT_TERM_SPLITS` map — splits high-volume terms (Oak→Oak Hill/Oakwood/..., Maria→Maria E/G/R/L, Estate→Estate of/Estates at/Estate Trust) to avoid truncation

**Research tasks** (4/5 data consolidation complete; remaining: city verification):
1. Determine if Texas city names yield results in TCAD search (cities historically don't work per CLAUDE.md — verify before adding)
2. ~~Consider merging `HIGH_RESULT_TERM_SPLITS` logic into `continuous-batch-scraper.ts`~~ Done — expansion applied in `TermSelector.getNextBatch()` (0e3dede, ea22e48)

---

### Code Review 2026-03-09 of `server/src/scripts/` (code-reviewer agent)

  Medium
  16. DEFERRED: Replace `winston` logger with Pino in production-runnable scripts: `continuous-batch-scraper.ts` (line 13), `continuous-batch-scraper-lowthreshold.ts` (line 14), and remove hardcoded `logs/continuous-scraper.log` file path — larger infrastructure change; deferred to next session
  17. N/A — `__dirname` is valid in this CommonJS project (`"module": "commonjs"` in tsconfig, no `"type": "module"`)
  21. N/A — `require.main === module` is correct for this CommonJS project


### Code Review 2026-03-09 of `server/src/scripts/` - Script Consolidation Issues

**Context**: repomix-explorer:explorer analysis identified 5 consolidation opportunities in scripts directory: 2 duplicated scripts (entity searches), 4-file duplication of utility functions, 1 near-duplicate scraper variant, 1 reimplemented shared utility, and 3 scripts with hardcoded options.

#### M25: Consolidate queue-entity-searches.ts and queue-entity-searches-fresh.ts
**Priority**: P2 | **Source**: repomix-explorer session 2026-03-09
Both files share identical 52-term `ENTITY_TERMS` array. The only behavioral difference is that `-fresh.ts` cleans up failed jobs before enqueueing. Merge into single script with `--fresh` flag to eliminate ~150 LOC duplication. -- `server/src/scripts/queue-entity-searches*.ts`

#### M26: Extract get2025Count() and related helpers to lib/backfill-utils.ts
**Priority**: P2 | **Source**: repomix-explorer session 2026-03-09
`get2025Count()` function is copy-pasted identically across 4 backfill scripts (backfill-2025.ts, backfill-2025-proven.ts, backfill-2025-unsearched.ts, backfill-2025-novel.ts). Also duplicates `MAX_CONSECUTIVE_ZERO_BATCHES` and `getSearchedTerms()` variants. Extract to shared `lib/backfill-utils.ts` and import across all 4 scripts. -- `server/src/scripts/backfill-2025*.ts`

#### M27: Replace continuous-batch-scraper-lowthreshold.ts with --low-threshold flag
**Priority**: P2 | **Source**: repomix-explorer session 2026-03-09
`continuous-batch-scraper-lowthreshold.ts` is a near-duplicate of main scraper (~160 LOC) with only threshold constants changed. Reimplements entire run loop instead of composing from shared logic. Add `--low-threshold` CLI flag to main scraper and delete duplicate file. -- `server/src/scripts/continuous-batch-scraper*.ts`

#### L25: Fix enqueue-prefix-expansions.ts to use shared waitForQueueDrain
**Priority**: P3 | **Source**: repomix-explorer session 2026-03-09
`enqueue-prefix-expansions.ts` reimplements its own `waitForQueueDrain` (lines 10-18) instead of importing from `../lib/queue-utils.ts` where it's shared across 6+ scripts. Replace local implementation with shared import. -- `server/src/scripts/enqueue-prefix-expansions.ts:10-18`

#### L26: Consolidate hardcoded job options to use config.queue.defaultJobOptions
**Priority**: P3 | **Source**: repomix-explorer session 2026-03-09
3 scripts (`queue-entity-searches.ts`, `queue-entity-searches-fresh.ts`, `enqueue-terms.ts`) hardcode job options `{ attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 50 }` instead of using shared config. Centralize to shared config like `lib/queue-utils.ts` does. -- `server/src/scripts/{queue-entity-searches*.ts,enqueue-terms.ts}`

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 3 items migrated to [changelog/2026-03-09.md](../changelog/2026-03-09.md) (TCAD API JSON failures, Documentation Staleness Audit, Documentation Staleness Follow-up)
