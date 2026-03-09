# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-06
**Status**: 624/624 tests passing | TypeScript clean | Lint clean | Biome clean

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

**Investigation tasks**:
1. Log raw response body length and first/last 100 chars when JSON parse fails — currently only the error message is preserved, not the response content
2. Check if TCAD API returns empty body (length 0) vs truncated body vs HTML error page for these terms
3. Determine if this is a TCAD server-side issue (terms with no results return malformed JSON) or a network issue (response cut off)
4. Check HTTP status code — `fetchPage()` only throws on `!res.ok`, so these are HTTP 200 responses with bad bodies
5. Consider: should terms with 0 TCAD results be pre-filtered before enqueue? The API may not handle certain search patterns gracefully
6. Add structured error logging with response metadata (status, content-length header, body length, body preview) to `fetchPage()` catch path

**Related files**:
- `server/src/lib/tcad-api-client.ts` — core fetch + parse logic
- `server/src/lib/tcad-scraper.ts` — retry wrapper
- `server/src/queues/scraper.queue.ts` — job processing
- `server/src/scripts/requeue-all-failed-with-error-tracking.ts` — already categorizes this as "JSON Parsing Error"

### Consolidate enqueue scripts and search term infrastructure (2026-03-08)

**Context**: Codebase cleanup identified 3 overlapping search term systems with unique data in each. Currently the root-level script is dead code (broken imports).

**Files**:
- `scripts/enqueue-by-category.ts` — dead code (root-level, can't resolve server imports). Categorizes 5-char terms from `server/data/valid-5char-terms.txt` against 4 dictionaries
- `server/src/scripts/enqueue-batch.ts` + `config/batch-configs.ts` — active, canonical. Config-driven CLI with 14 batch types and priority system
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

**Research tasks**:
1. Extract curated name lists (Hispanic, Indian, Asian surnames + first names) into a shared data file (e.g. `server/data/curated-names.json`) usable by both `batch-configs.ts` and `continuous-batch-scraper.ts`
2. Add new batch config categories for the extracted name lists (e.g. `hispanic-surnames`, `indian-surnames`)
3. Determine if Texas city names yield results in TCAD search (cities historically don't work per CLAUDE.md — verify before adding)
4. Move `scripts/enqueue-by-category.ts` to `server/src/scripts/one-off-and-test-batches/` after data extraction
5. Consider merging `HIGH_RESULT_TERM_SPLITS` logic into `continuous-batch-scraper.ts` so auto-splitting happens at enqueue time

### Code Review 2026-03-08 of commit c7aabe6

  Low
  1. `list-all-search-terms.ts` direct-run detection is fragile — `process.argv[1]?.endsWith(...)` can mismatch with some tsx runners. Use `import.meta.url === pathToFileURL(process.argv[1]).href` (blocked by CommonJS tsconfig; fix requires module change). -- `server/src/scripts/utils/list-all-search-terms.ts:87`
  2. `continuous-batch-scraper-lowthreshold.ts` duplicates ~400 lines with only 3 threshold constants changed. Extract thresholds into a config object passed to a shared class when the lowthreshold variant becomes permanent. -- `server/src/scripts/continuous-batch-scraper-lowthreshold.ts`
  3. `enqueue-40k-sprint.ts` includes numeric-only terms (`"1000"`, `"1100"`, etc.) which TCAD rejects. Add `NUMERIC_ONLY` regex filter before enqueue. -- `server/src/scripts/one-off-and-test-batches/enqueue-40k-sprint.ts`

### Code Review 02-27-2026 of commit 66dc363

  Low
  4. getJwtLifetime should guard exp > iat — STALE: function not found in current codebase; may have been removed in refactor
  6. Test vi.resetModules() could leak — DEFERRED: vi.resetModules() in afterEach is load-bearing for await import() pattern; removal breaks 4 tests. Needs per-test vi.isolateModules() refactor. -- `src/__tests__/App.test.tsx:59`

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 7 items migrated to [changelog/2026-03-06.md](../changelog/2026-03-06.md)
