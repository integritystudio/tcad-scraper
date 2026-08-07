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

The four `backfill-2025-*` scripts select terms by comparing 2026 vs 2025 data in D1; they find nothing unless 2026 properties are loaded (currently only 2025 data is).

| Script | Purpose |
|--------|---------|
| `backfill-2025.ts` | Primary 2025 backfill: high-yield terms present in 2026 data but not 2025, plus `BACKFILL_2025_STATIC_TERMS` (`config/backfill-2025-static-terms.ts`). |
| `backfill-2025-proven.ts` | Terms that yielded 100+ properties in 2026 but none in 2025. |
| `backfill-2025-unsearched.ts` | Owner/entity/street names mined from 2026-only properties, minus supersets and already-searched terms. |
| `backfill-2025-novel.ts` | Never-searched owner names mined from 2026-only properties (e.g. NGUYEN, MARTINEZ). |
| `enqueue-tail-terms.ts` | Multi-phase tail term optimizer: 1 = unscraped analytics terms, 2 = analytics tail, 3 = owner-name mining. `--phase N`. |

## Analysis

| Script | Purpose |
|--------|---------|
| `analyze-failed-jobs.ts` | Categorize and report on failed scrape jobs. |
| `analyze-search-terms.ts` | Analyze search term effectiveness from analytics data. |
| `generate-next-200-terms.ts` | Generate the next 200 candidate terms (5-tier priority: unsearched names, geographic, prefix expansions, re-scrape, gap fill); `--enqueue` sends them to the Workers API. |
| `generate-valid-5char-terms.ts` | Generate 5-letter terms from real names/companies/streets (dictionary + census + curated lists), filtering already-searched and blacklisted; writes a scratch `data/valid-5char-terms.txt` for manual review (gitignored — no in-repo consumer). |
| `check-unsearched-terms.ts` | Find inventory terms not yet searched for current year. Uses batched EXISTS queries. |

## Config

| File | Purpose |
|------|---------|
| `config/batch-configs.ts` | Named batch types (LLC, trust, corporation, etc.) with priority tiers. Includes `HIGH_RESULT_TERM_SPLITS` for high-volume terms. |
| `config/backfill-2025-source-terms.ts` | 400 curated terms for remaining 2025 properties (deduped against batch-configs and FALLBACK_TERMS). |
| `config/backfill-2025-static-terms.ts` | Canonical `BACKFILL_2025_STATIC_TERMS` list for `backfill-2025.ts`, deduped against `backfill-2025-source-terms.ts` and `FALLBACK_TERMS`. |

## Shared (`lib/`)

| File | Purpose |
|------|---------|
| `lib/queue-utils.ts` | `enqueueBatch()` — HTTP enqueue via the Workers API; `waitForQueueDrain()` — polls `/history` until the batch's jobs reach completed/failed (10m timeout). |
| `lib/backfill-runner.ts` | Shared runner for the backfill scripts (enqueue → drain → count gained). |
| `lib/mine-2026-terms.ts` | Shared term-mining queries over 2026-only properties (owner first-words, streets, descriptions, two-word names, entity phrases). |
| `lib/fallback-terms.ts` | Curated fallback search term pool (`FALLBACK_TERMS`). |
| `lib/searched-terms.ts` | Searched-term lookups (`getSearchedTermSets()`, `getBlacklistedTermSet()`). |
| `lib/backfill-utils.ts` | Backfill helpers: `get2025Count()`, prefix dedup filters (`isSupersetOfAny()`, `buildPrefixIndex()`). |
| `lib/d1-prisma.ts` | Prisma client for scripts, backed by production D1 over HTTP (epoch-ms date strings, SQLite dialect). |
| `lib/error-helpers.ts` | `getErrorMessage()` for `unknown` errors. |
| `lib/logger.ts` | Console shim for CLI scripts. |
| `lib/cvcv.ts` | `generateCvcvBases()` — all 11,025 4-char consonant-vowel-consonant-vowel bases, used to seed 5-char term generation. |
| `lib/curated-names.ts` | Canonical curated name/geo/entity data (`FIRST_NAMES_FEMALE`, `FIRST_NAMES_MALE`, `LAST_NAMES`, `STREET_GEOGRAPHIC`, `BUSINESS_ENTITY`) — single source for `generate-valid-5char-terms.ts` and the `utils/list-all-search-terms.ts` inventory. |

## Utilities (`utils/`)

| File | Purpose |
|------|---------|
| `list-all-search-terms.ts` | Deduplicated inventory of all non-numeric search terms across `batch-configs.ts`, `lib/curated-names.ts`, and `lib/fallback-terms.ts`; its `duplicated` bucket surfaces cross-source overlap. Importable (`getAllSearchTerms()`) or CLI. |
| `list-curated-terms.ts` | Deduplicated inventory of the manual-backfill term lists (`BACKFILL_2025_STATIC_TERMS` + the `CANDIDATE_*` lists in `generate-next-200-terms.ts`); its `duplicated` bucket must stay empty. Importable or CLI. |

## Repomix (`repomix/`)

Shell scripts behind `npm run repomix` — regenerate the AI-readable code packs in `docs/repomix/` (token tree, compressed/full XML, per-area packs) and retrain the zstd dictionary in `.condense/`. Run via npm script, not directly.
