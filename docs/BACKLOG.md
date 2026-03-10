# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-09 (backlog-implementer session 2 — items 25–29 + test gaps)
**Status**: 124/124 tests passing (4-5 flaky) | TypeScript clean | Lint clean

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

### Code Review 02-27-2026 of commit 66dc363

  Low
  6. Test vi.resetModules() could leak — DEFERRED: vi.resetModules() in afterEach is load-bearing for await import() pattern; removal breaks 4 tests. Needs per-test vi.isolateModules() refactor. -- `src/__tests__/App.test.tsx:59`

### Code Review 2026-03-09 of commits b24e059, 13d4360, e70920f (backlog-implementer session follow-up)

  Medium
  12. [x] Test call-order comment (lines 44-49) is inconsistent with actual code flow — fixed in c9427d6
  13. [x] Cache invalidation test suite only asserts `mockGroupBy` call counts — added `mockFindMany.toHaveBeenCalledTimes` assertions in c9427d6

  Low
  14. [x] `STOP_AT_PROPERTIES = 420000` missing context — added comment in c9427d6

### Code Review 2026-03-09 of `server/src/scripts/` (code-reviewer agent)

  Medium
  15. [x] Deduplicate `enqueueBatch` / `waitForQueueDrain` logic across 4 backfill scripts — extracted to `server/src/scripts/lib/queue-utils.ts` (6c88a86)
  16. DEFERRED: Replace `winston` logger with Pino in production-runnable scripts: `continuous-batch-scraper.ts` (line 13), `continuous-batch-scraper-lowthreshold.ts` (line 14), and remove hardcoded `logs/continuous-scraper.log` file path — larger infrastructure change; deferred to next session
  17. N/A — `__dirname` is valid in this CommonJS project (`"module": "commonjs"` in tsconfig, no `"type": "module"`)
  18. [x] Remove dead priority branch in `enqueue-high-value-batch.ts` — merged i<10 and i<20 branches (b4eeb85)
  19. [x] Fix deterministic "shuffle" in `generate-next-200-terms.ts` — replaced fixed hash with `Math.random()` Fisher-Yates (63c6f07)
  20. [x] Store and clear `setInterval` handle in `continuous-batch-scraper-lowthreshold.ts` — added `monitorInterval` field, clears in `stop()` (6990044)

  Low
  21. N/A — `require.main === module` is correct for this CommonJS project
  22. [x] Remove always-filtered numeric-only terms from `TERM_POOL` in `enqueue-40k-sprint.ts` — deleted ~150 numeric strings (2fc0c60)
  23. [x] Extract hardcoded TCAD total `451,339` in `analyze-search-terms.ts` — named `TCAD_TOTAL_PROPERTIES` constant with update comment (1514129)
  24. [x] Add `--dry-run` flag to `migrate-to-logger.ts` — previews changes without writing (684b1e1)


### Test Coverage Gaps — backlog-implementer session 2026-03-09

**Context**: 5 script files were modified (items 25–29) with zero unit test coverage. The only test file under `server/src/scripts/` is `config/__tests__/batch-configs.test.ts`. Additionally, 4–5 React component tests are flaky due to timeouts.

#### TC-05: `queue-utils.ts` — no unit tests (Medium)
**File**: `server/src/scripts/lib/queue-utils.ts`
**What to test**:
- `enqueueBatch` returns count of successfully enqueued terms
- `enqueueBatch` calls `logger.error` (not `console.error`) when a term fails, using the injected logger
- `enqueueBatch` with default logger (console) for backward compat
- `waitForQueueDrain` resolves when both active and waiting counts reach 0
**Mocking needed**: `scraperQueue.add`, `scraperQueue.getWaitingCount`, `scraperQueue.getActiveCount`, `config.queue`
**Why**: Shared library used by 6+ scripts; logger injection (item 25) and config-driven job options are untested

#### TC-06: `migrate-to-logger.ts` dry-run output — no unit tests (Medium)
**File**: `server/src/scripts/migrate-to-logger.ts`
**What to test**:
- `migrateFile(path, dryRun=true)` prints per-type replacement counts and does NOT write to disk
- `migrateFile(path, dryRun=false)` writes modified content
- Files with no `console.*` calls produce "No changes" output
- Regex label output is human-readable (no escaped backslashes in `from` labels)
**Mocking needed**: `fs.readFileSync`, `fs.writeFileSync`, `console.log`
**Why**: Item 26 added replacement-count breakdown with no test; fragile `from` label escaping (item 26 follow-up) needs regression guard

#### TC-07: `analyze-search-terms.ts` staleness guard — no unit tests (Low)
**File**: `server/src/scripts/analyze-search-terms.ts`
**What to test**:
- `console.warn` fires when `propertyCount > TCAD_TOTAL_PROPERTIES`
- `Remaining` clamps to 0 (never negative) when DB count exceeds constant
- Division by zero when `totalJobs === 0` (pre-existing gap flagged by full-stack reviewer)
**Mocking needed**: `prisma.property.count`, `prisma.scrapeJob.count`, `console.warn`
**Why**: Item 28 added guard but the script has no test coverage at all; the division-by-zero edge case was flagged as MEDIUM by the full-stack reviewer

#### TC-08: `generate-next-200-terms.ts` enqueue path — no unit tests (Low)
**File**: `server/src/scripts/generate-next-200-terms.ts`
**What to test**:
- `--enqueue` flag triggers `enqueueBatch` with selected terms and `'next-200-gen'` userId
- `scraperQueue.close()` is called after enqueue completes
- `prisma.$disconnect()` is called in `.finally()` on both success and error paths
**Mocking needed**: `prisma.*`, `scraperQueue`, `enqueueBatch`
**Why**: Item 27 switched to `enqueueBatch` helper; item 1548030 added prisma disconnect — both untested

#### TC-09: Flaky React component tests — intermittent timeout failures (Medium)
**Files**: `src/__tests__/App.test.tsx`, `src/components/__tests__/LoadingSkeleton.test.tsx`, `src/components/__tests__/PropertyCard.test.tsx`, `src/components/__tests__/SearchBox.test.tsx`
**Symptoms**: 4–5 tests fail intermittently with 5–11 second timeouts. Confirmed by running baseline (no code changes) — same failures. Tests that fail:
- "should render PropertySearchContainer after suspense resolves" (App.test.tsx)
- "should wrap app content in error boundary" (App.test.tsx)
- "should have role='status' for screen readers" (LoadingSkeleton.test.tsx)
- "expands when expand button is clicked" (PropertyCard.test.tsx)
- "should have accessible label for search input" (SearchBox.test.tsx)
**Likely causes**: heavy `@testing-library/react` `waitFor` timeouts, JSDOM resource contention, or missing `act()` wrappers
**Impact**: Flakes erode trust in CI; the `vi.resetModules()` leak (item 6) may contribute

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 3 items migrated to [changelog/2026-03-09.md](../changelog/2026-03-09.md) (TCAD API JSON failures, Documentation Staleness Audit, Documentation Staleness Follow-up)
