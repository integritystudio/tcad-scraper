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

### ~~Documentation Staleness Audit (2026-03-09)~~ — DONE (2026-03-09, commits d3c2895..719bb22)

**Context**: Repomix docs index + gitlog analysis identified stale references across 8 doc files. CLAUDE.md fixed in this session; remaining items below.

#### HIGH: `docs/TOKEN_MANAGEMENT.md` — describes deleted Playwright flow
- Entire "How It Works" section describes headless browser token capture — Playwright removed in `934e22e` (2026-02-26)
- Token refresh now uses Cloudflare Worker endpoint (`247dc05`)
- Key files table references `tcad-scraper.ts` for "token consumption" — actual client is `tcad-api-client.ts`
- Troubleshooting row "Browser not found" is moot
- **Fix**: Rewrite to describe Cloudflare Worker flow, update key files table, remove Playwright troubleshooting

#### HIGH: `docs/CI-CD.md` — phantom workflows, wrong test framework
- References `ci.yml`, `pr-checks.yml`, `security.yml` workflows — actual `.github/workflows/` contains only `deploy.yml`, `integration-tests.yml`, `README.md`
- References Jest throughout — project uses Vitest
- References `develop` branch — only `main` used
- Pull request process says "create feature branch from `develop`" — stale
- Resources section links to Jest docs
- **Fix**: Remove phantom workflow sections, replace Jest refs with Vitest, update branching model

#### HIGH: `docs/ANALYTICS.md` — wrong port, wrong framework, stale component refs
- Last reviewed 2025-11-08
- References `React 18+` — project is React 19
- References `ExampleQueries.tsx` — component not in current tree
- References `localhost:5173` — frontend is on 5174
- References `dev/active/`, `dev/HANDOFF.md` — paths don't exist
- Analytics test examples use `jest.mock()` — should be `vi.mock()`
- Uses `Record<string, any>` — project standard is `unknown`
- **Fix**: Update React version, port, test framework refs; verify/remove stale component and path refs

#### MEDIUM: `docs/CODE_REVIEW_DRY.md` — multiple resolved/moot findings unmarked
- Browser launch config duplication (DRY MEDIUM) — moot, Playwright removed
- Browser context leaks (CRITICAL robustness) — moot, Playwright removed
- Token refresh timeout finding — architecture changed to Cloudflare Worker
- Stats "493/560 tests passing (88%)" — now 631+
- Enqueue consolidation (CRITICAL DRY) — completed (18 batch types)
- `getErrorMessage()` extraction (HIGH DRY) — completed
- **Fix**: Mark resolved items, remove/archive moot Playwright findings, update stats

#### MEDIUM: `docs/API.md` — wrong dev port
- Base URL shows `http://localhost:3000` for dev — backend is on port 3001
- Health endpoint response may have additional fields (e.g. `tokenRefresh`) not documented
- **Fix**: Update port, verify response shapes against current routes

#### MEDIUM: `docs/archive/RENDER-MIGRATION.md` — status still "Draft"
- Migration is complete — status should be "Complete"
- Section "Playwright on Render" is moot (Playwright removed)
- **Fix**: Update status, mark Playwright section as N/A

#### MEDIUM: `docs/SECURITY.md` — stale Cloudflare Tunnel reference
- Rate limiting note says "Cloudflare Tunnel" — API is on Render (no tunnel)
- **Fix**: Update to reflect Render reverse proxy

#### LOW: `docs/doppler-setup.md` — stale Redis config vars
- References `REDIS_HOST`/`REDIS_PORT` separately — actual config uses `REDIS_URL` with TLS
- **Fix**: Update to show `REDIS_URL=rediss://...` as primary config

#### LOW: `docs/CHANGELOG.md` — date typos
- November entries show "2024" but should be "2025" (project started Oct 2023, bulk dev in late 2025)
- **Fix**: Correct year in November 2024 entries to 2025

### ~~Documentation Staleness Follow-up — Playwright refs in 3 docs not audited (2026-03-09)~~ — DONE (2026-03-09, commit 109bd90)

Found during final review of Documentation Staleness Audit. Not in scope for that session.

- `docs/SETUP.md` line 10: `Playwright (npx playwright install chromium)` listed as setup prereq — Playwright removed Feb 2026
- `docs/DOCKER.md` line 38: Dockerfile description says "includes Playwright/Chromium" — stale
- `docs/truncated-response-terms.md` line 11: suggests "Playwright fallback" as scraping strategy — no longer available
- `docs/MONITORING.md` line 27: `http://localhost:3000/metrics` should be `localhost:3001/metrics`

**Fix**: Remove Playwright prereq from SETUP.md; update DOCKER.md Dockerfile description; remove Playwright fallback option from truncated-response-terms.md; fix port in MONITORING.md.

---

### Code Review 02-27-2026 of commit 66dc363

  Low
  6. Test vi.resetModules() could leak — DEFERRED: vi.resetModules() in afterEach is load-bearing for await import() pattern; removal breaks 4 tests. Needs per-test vi.isolateModules() refactor. -- `src/__tests__/App.test.tsx:59`

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
