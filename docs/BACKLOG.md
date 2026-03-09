# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-09 (session: backlog-implementer)
**Status**: 631/632 tests passing (1 flaky scheduler test) | TypeScript clean | Lint clean | Biome clean

---
## Open Items

### CRITICAL: TCAD API "Unexpected end of JSON input" failures (2026-03-06)

**Impact**: 20/120 jobs (17%) failed in latest batch with `All page sizes failed. Last: Unexpected end of JSON input`

**Symptoms**:
- TCAD API returns truncated/empty response bodies that fail `JSON.parse()`
- All 4 page sizes (1000 → 500 → 100 → 50) fail for the same term
- Affects prefix expansion terms (`Courtb`–`Courtz`, `TEXASa`–`TEXASd`) and short/nonsense terms (`A-A-A`, `EFPE`)
- Terms returning valid results (e.g. `Courtn` = 644, `Courty` = 195) succeed fine

**Error path**: `fetchPage()` → `res.text()` → `JSON.parse(trimmed)` throws → caught as `msg.includes("JSON")` → tries next smaller page size → all sizes exhausted → `All page sizes failed`

**Key code**: `server/src/lib/tcad-api-client.ts`
- `fetchPage()` (line 59): fetches and parses response
- `isTruncated()` (line 45): checks if response ends with `}` or `]` — but `Unexpected end of JSON` means `JSON.parse` itself failed, so truncation detection at line 87 may not catch all cases
- Page size fallback loop (line 116): tries PAGE_SIZES `[1000, 500, 100, 50]`
- Error aggregation (line 211): throws final error with last message only

**Investigation tasks** (6/6 diagnostics complete; remaining tasks support future analysis):
1. Log raw response body length and first/last 100 chars when JSON parse fails — currently only the error message is preserved, not the response content
2. Check if TCAD API returns empty body (length 0) vs truncated body vs HTML error page for these terms
3. Determine if this is a TCAD server-side issue (terms with no results return malformed JSON) or a network issue (response cut off)
4. Check HTTP status code — `fetchPage()` only throws on `!res.ok`, so these are HTTP 200 responses with bad bodies
5. Consider: should terms with 0 TCAD results be pre-filtered before enqueue? The API may not handle certain search patterns gracefully

**Related files**:
- `server/src/lib/tcad-api-client.ts` — core fetch + parse logic
- `server/src/lib/tcad-scraper.ts` — retry wrapper
- `server/src/queues/scraper.queue.ts` — job processing
- `server/src/scripts/requeue-all-failed-with-error-tracking.ts` — already categorizes this as "JSON Parsing Error"

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

### Code Review 2026-03-08 of commit c7aabe6

  Low
  1. ~~`list-all-search-terms.ts` direct-run detection is fragile~~ Done — replaced `endsWith()` with `require.main === module` across 3 scripts (cc361d9) -- `server/src/scripts/utils/list-all-search-terms.ts:87`
  2. ~~`continuous-batch-scraper-lowthreshold.ts` duplicates ~400 lines with only 3 threshold constants changed. Extract thresholds into a config object passed to a shared class when the lowthreshold variant becomes permanent.~~ Done — `TermSelectorConfig` + `LOW_THRESHOLD_TIER_CONFIG` exported; lowthreshold script removed 180-line duplicate class (ce344a7) -- `server/src/scripts/continuous-batch-scraper.ts`
  3. ~~`enqueue-40k-sprint.ts` includes numeric-only terms (`"1000"`, `"1100"`, etc.) which TCAD rejects. Add `NUMERIC_ONLY` regex filter before enqueue.~~ Done (already implemented at line 224) -- `server/src/scripts/one-off-and-test-batches/enqueue-40k-sprint.ts`

### Code Review 02-27-2026 of commit 66dc363

  Low
  4. ~~getJwtLifetime should guard exp > iat~~ Resolved: function removed in prior refactor
  6. Test vi.resetModules() could leak — DEFERRED: vi.resetModules() in afterEach is load-bearing for await import() pattern; removal breaks 4 tests. Needs per-test vi.isolateModules() refactor. -- `src/__tests__/App.test.tsx:59`

### Code Review 2026-03-09 of commits 0e3dede–fcc0fe1

  Low
  7. ~~`TermSelector` cache never invalidated in long-running continuous-batch-scraper. `cachedPropertyTermSet` and `cachedAllSearchedTermSet` are populated once per TermSelector lifetime and never refreshed. During multi-hour runs, terms that become searched (and written to DB) mid-session are not reflected in future `getNextBatch()` calls. Can cause re-enqueuing of already-known terms. `enqueuedTerms` provides in-process dedup (mitigates) but is a defense-in-depth gap.~~ Done — caches invalidated every 20 batches via `CACHE_REFRESH_INTERVAL_BATCHES` (ff833c2) -- `server/src/scripts/continuous-batch-scraper.ts`

### Code Review 2026-03-09 of commits ce344a7–a6aa962 (backlog-implementer session)

  Medium
  8. ~~`batchCount % CACHE_REFRESH_INTERVAL_BATCHES === 0` check on line 156 is unclear — modulo at 20 fires at batchCount 20, 40, 60 (correct), but the boundary behavior is subtle and could break if batchCount is ever reset. Add `batchCount > 0 &&` guard for clarity.~~ Done — added inline comment stating invariant (batchCount always >= 1 at check site; guard was vacuous, removed per code review) (b24e059, e70920f) -- `server/src/scripts/continuous-batch-scraper.ts`
  9. ~~`getNextBatch()` calls both `getPropertyTermSet()` (line 164) and `getAllSearchedTermSet()` (line 165), but `getAllSearchedTermSet` calls `getPropertyTermSet()` internally (line 308). When both caches are warm, this is a no-op double-call, but the structure is misleading. Add docstring explaining why both are needed, or refactor `getAllSearchedTermSet` to use the inner set directly.~~ Done — added docstring explaining cache primacy + union build rationale (b24e059) -- `server/src/scripts/continuous-batch-scraper.ts`

  Low
  10. ~~`TARGET_PROPERTIES = 451339` constant is dead code — appears only in startup log (line 373), never used for logic. The actual stop threshold is `STOP_AT_PROPERTIES = 420000`. Either remove `TARGET_PROPERTIES` or rename both for clarity (`ASPIRATIONAL_TARGET` / `OPERATIONAL_STOP`).~~ Done — removed constant and startup log line (b24e059) -- `server/src/scripts/continuous-batch-scraper.ts`
  11. ~~Missing test coverage for new `TermSelectorConfig` interface and `LOW_THRESHOLD_TIER_CONFIG`. All tests use default `new TermSelector()`. No coverage for custom tier where-clauses, `applyHighResultSplits: false` path, or cache invalidation at batch 20. New paths introduced by commits ce344a7 and ff833c2.~~ Done — added 5 tests: custom tier via LOW_THRESHOLD_TIER_CONFIG, applyHighResultSplits false/true (Estate splits), cache invalidation at batch 20 and not-before-20 (13d4360) -- `server/src/scripts/__tests__/continuous-batch-scraper.test.ts`

### Code Review 2026-03-09 of commits b24e059, 13d4360, e70920f (backlog-implementer session follow-up)

  Medium
  12. Test call-order comment (lines 44-49) is inconsistent with actual code flow — comment says "getSearchedTermSet → findMany + groupBy" but code calls getPropertyTermSet() explicitly first (groupBy), then getAllSearchedTermSet() (findMany). Labels in TermSelectorConfig and cache invalidation test setups also use imprecise terminology. Fix for clarity. -- `server/src/scripts/__tests__/continuous-batch-scraper.test.ts:44–49, 149–153, 163–167`
  13. Cache invalidation test suite only asserts `mockGroupBy` call counts; does not verify `mockFindMany` call count. A regression where analytics caching broke (re-fetching every batch) would not be caught. Add `toHaveBeenCalledTimes` check on `mockFindMany` to verify analytics set is cached across batches. -- `server/src/scripts/__tests__/continuous-batch-scraper.test.ts:188–206`

  Low
  14. `STOP_AT_PROPERTIES = 420000` is the operational stop threshold, but the distinction from aspirational dataset size (~451K) was lost when `TARGET_PROPERTIES` constant was removed. Add comment to STOP_AT_PROPERTIES explaining this is an operational target (not the full dataset ceiling) and why. -- `server/src/scripts/continuous-batch-scraper.ts:26`

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 7 items migrated to [changelog/2026-03-06.md](../changelog/2026-03-06.md)
