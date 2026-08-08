# Scripts

All scripts run from the repo root with `doppler run -- npx tsx scripts/<script>.ts` unless noted. Backfill and tail-term scripts additionally require the `TCAD_YEAR=2025` env prefix. Enqueueing goes through the Workers API (`scripts/lib/queue-utils.ts` → `POST /api/properties/scrape`), which requires `TCAD_API_KEY`.

## Build Scripts

### generate-build-constants.ts

Generates build-time constants from the database for use in the frontend.

Instead of making API calls at runtime to fetch the property count, this script:
1. Queries the production D1 database via the Cloudflare REST API (`CLOUDFLARE_D1_TOKEN` from Doppler)
2. Fetches the current property count
3. Generates a TypeScript constants file (`src/constants/build.ts`)

```bash
doppler run -- npx tsx scripts/generate-build-constants.ts
```

**Fallback**: If DB is unavailable (e.g., GitHub Actions), uses `FALLBACK_PROPERTY_COUNT` env var or defaults to hardcoded value.

## Status

| Script | Purpose |
|--------|---------|
| `queue-results.ts` | Recent scrape jobs + property count from the Workers API. `--limit N`. No Doppler needed. |
| `search-terms-summary.sh` | Recent search terms table from production D1 (wrapper for `search-terms-summary.ts`; latest job per term + property counts). |

## Backfill

Every backfill script fills the year named by `TCAD_YEAR` (default 2025) and
mines its candidate terms from the *year gap* — properties present in the
most-populated other year in D1 but not yet captured for the target. The
direction is resolved from the data, so it reverses on its own each roll
season: 2026 seeded 2025's backfill, and 2025 now seeds 2026's.

```bash
TCAD_YEAR=2026 doppler run -- npx tsx scripts/backfill.ts
```

| Script | Purpose |
|--------|---------|
| `optimize-coverage.ts` | **Start here.** Greedy maximum-coverage plan: the smallest term set that covers the roll, with a marginal-coverage curve. `--enqueue` runs it through the backfill loop. |
| `backfill.ts` | Primary backfill: high-yield terms proven on the source year, plus analytics terms and `BACKFILL_2025_STATIC_TERMS` (`config/backfill-2025-static-terms.ts`). |
| `backfill-proven.ts` | Terms that yielded 100+ properties for the source year but none for the target. |
| `backfill-unsearched.ts` | Owner/entity/street names mined from the year gap, minus supersets and already-searched terms. |
| `backfill-novel.ts` | Never-searched owner names mined from the year gap (e.g. NGUYEN, MARTINEZ). |
| `enqueue-tail-terms.ts` | Multi-phase tail term optimizer: 1 = unscraped analytics terms, 2 = analytics tail, 3 = owner-name mining. `--phase N`. |

## Analysis

| Script | Purpose |
|--------|---------|
| `analyze-failed-jobs.ts` | Categorize and report on failed scrape jobs. |
| `analyze-search-terms.ts` | Analyze search term effectiveness from analytics data. |
| `generate-next-200-terms.ts` | Generate the next 200 candidate terms (5-tier priority: unsearched names, geographic, prefix expansions, re-scrape, gap fill); `--enqueue` sends them to the Workers API. |
| `check-unsearched-terms.ts` | Find inventory terms not yet searched for `TCAD_YEAR` (via `getSearchedTermSets(year)`). |

## Config

| File | Purpose |
|------|---------|
| `config/batch-configs.ts` | Named batch types (LLC, trust, corporation, etc.) with priority tiers. Includes `HIGH_RESULT_TERM_SPLITS` for high-volume terms. |
| `config/backfill-2025-source-terms.ts` | 400 curated terms for remaining 2025 properties (deduped against batch-configs and `backfill.ts` STATIC_TERMS). |
| `config/backfill-2025-static-terms.ts` | Canonical `BACKFILL_2025_STATIC_TERMS` list for `backfill.ts`, deduped against `backfill-2025-source-terms.ts` and `BATCH_CONFIGS`. |

## Shared (`lib/`)

| File | Purpose |
|------|---------|
| `lib/queue-utils.ts` | `enqueueBatch()` — HTTP enqueue via the Workers API; `waitForQueueDrain()` — polls `/history` until the batch's jobs reach completed/failed (10m timeout). |
| `lib/backfill-runner.ts` | Shared runner for the backfill scripts (enqueue → drain → count gained). |
| `lib/mine-year-terms.ts` | Shared term-mining queries over the source-year/target-year gap (owner first-words, streets, descriptions, two-word names, entity phrases). |
| `lib/coverage-optimizer.ts` | Models TCAD's matcher over a corpus and solves maximum coverage greedily: `tokenize()`, `buildCoverageIndex()`, `buildCoveredMask()`, `greedyCover()`. |
| `lib/searched-terms.ts` | Searched-term lookups: `getSearchedTermSets(year)` (`allSearched`, `searchedForYear`, `successful`, `unsuccessful` sets), `getYearYield(year)`, `getYearZeroYieldTerms(year)`, `getBlacklistedTermSet()`. |
| `lib/backfill-utils.ts` | Backfill helpers: `getPropertyCount(year)`, `resolveSourceYear(targetYear)`, prefix dedup filters (`isSupersetOfAny()`, `buildPrefixIndex()`). |
| `lib/d1-prisma.ts` | Prisma client for scripts, backed by production D1 over HTTP (epoch-ms date strings, SQLite dialect). |
| `lib/error-helpers.ts` | `getErrorMessage()` for `unknown` errors. |
| `lib/logger.ts` | Console shim for CLI scripts. |
| `lib/cvcv.ts` | `generateCvcvBases()` — all 11,025 4-char consonant-vowel-consonant-vowel bases, used by `generate-next-200-terms.ts`'s Tier 5 (4-char gap fill). |
| `lib/run-main.ts` | Shared `runMain()` entrypoint wrapper (Prisma disconnect + exit-code handling) used by `check-unsearched-terms.ts`, `queue-results.ts`, `generate-next-200-terms.ts`, `analyze-search-terms.ts`, `search-terms-summary.ts`, and `backfill-runner.ts`. |
| `lib/epoch-format.ts` | Shared epoch-ms formatting helpers (UTC vs local-timezone) used by `queue-results.ts` and `search-terms-summary.ts`. |
| `lib/term-inventory.ts` | Shared term-inventory dedupe algorithm used by `utils/list-all-search-terms.ts` and `utils/list-curated-terms.ts`. |
| `lib/job-stats.ts` | `getJobStats()` — shared scrape-job stats query used by `analyze-failed-jobs.ts` and `analyze-search-terms.ts`. |

## Term Data (`lib/terms/`)

Pure data — no logic — kept separate from `lib/`'s shared logic modules above.

| File | Purpose |
|------|---------|
| `lib/terms/FIRST_NAMES_FEMALE.ts`, `lib/terms/FIRST_NAMES_MALE.ts`, `lib/terms/LAST_NAMES.ts`, `lib/terms/STREET_GEOGRAPHIC.ts`, `lib/terms/BUSINESS_ENTITY.ts` | Canonical curated name/geo/entity data (one const list per file) — single source for `generate-next-200-terms.ts`'s candidate pools and the `utils/list-all-search-terms.ts` inventory. |
| `lib/terms/BLOCKED_TERMS.ts` | Hard-skip terms that cause TCAD API timeouts or truncated responses; used by `generate-next-200-terms.ts`. |
| `lib/terms/TRUNCATION_BUG_ROOTS.ts` | 4-char prefixes confirmed to trigger TCAD's server-side JSON truncation bug across every a-z expansion (see `docs/truncated-response-terms.md`); used by `backfill.ts`'s `getDenseExpansions()`/`getSeedExpansions()`. |

## Utilities (`utils/`)

| File | Purpose |
|------|---------|
| `list-all-search-terms.ts` | Deduplicated inventory of all non-numeric search terms across `batch-configs.ts` and the curated name/geo/entity lists in `lib/terms/`; its `duplicated` bucket surfaces cross-source overlap. Importable (`getAllSearchTerms()`) or CLI. |
| `list-curated-terms.ts` | Deduplicated inventory of the manual-backfill term lists (`BACKFILL_2025_STATIC_TERMS` + the `CANDIDATE_*` lists in `generate-next-200-terms.ts`); its `duplicated` bucket must stay empty. Importable or CLI. |

## Repomix (`repomix/`)

Shell scripts behind `npm run repomix` — regenerate the AI-readable code packs in `docs/repomix/` (token tree, compressed/full XML, per-area packs) and retrain the zstd dictionary in `.condense/`. Run via npm script, not directly.
