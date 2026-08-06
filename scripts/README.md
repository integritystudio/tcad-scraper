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
| `backfill-2025.ts` | Primary 2025 backfill: high-yield terms present in 2026 data but not 2025, plus a `STATIC_TERMS` list. |
| `backfill-2025-proven.ts` | Terms that yielded 100+ properties in 2026 but none in 2025. |
| `backfill-2025-unsearched.ts` | Owner/entity/street names mined from 2026-only properties, minus supersets and already-searched terms. |
| `backfill-2025-novel.ts` | Never-searched owner names mined from 2026-only properties (e.g. NGUYEN, MARTINEZ). |
| `run-first-200.ts` | Enqueue the 200 highest-yield terms from docs/SEARCH_TERMS.md. |
| `enqueue-tail-terms.ts` | Multi-phase tail term optimizer: 1 = unscraped analytics terms, 2 = analytics tail, 3 = owner-name mining. `--phase N`. |

## Analysis

| Script | Purpose |
|--------|---------|
| `analyze-failed-jobs.ts` | Categorize and report on failed scrape jobs. |
| `analyze-search-terms.ts` | Analyze search term effectiveness from analytics data. |
| `generate-next-200-terms.ts` | Generate the next 200 candidate terms (5-tier priority: unsearched names, geographic, prefix expansions, re-scrape, gap fill); `--enqueue` sends them to the Workers API. |
| `generate-valid-5char-terms.ts` | Generate 5-letter terms from real names/companies/streets (dictionary + census + curated lists), filtering already-searched and blacklisted; writes `data/valid-5char-terms.txt`. |
| `check-unsearched-terms.ts` | Find inventory terms not yet searched for current year. Uses batched EXISTS queries. |
| `test-import-paths.ts` | Validate that import statements across the project resolve to real files. |

## Config

| File | Purpose |
|------|---------|
| `config/batch-configs.ts` | Named batch types (LLC, trust, corporation, etc.) with priority tiers. Includes `HIGH_RESULT_TERM_SPLITS` for high-volume terms. |
| `config/backfill-2025-source-terms.ts` | 400 curated terms for remaining 2025 properties (deduped against batch-configs and FALLBACK_TERMS). |

## Shared (`lib/`)

| File | Purpose |
|------|---------|
| `lib/queue-utils.ts` | `enqueueBatch()` — HTTP enqueue via the Workers API. |
| `lib/backfill-runner.ts` | Shared runner for the backfill scripts. |
| `lib/fallback-terms.ts` | Curated fallback search term pool (`FALLBACK_TERMS`). |
| `lib/searched-terms.ts` | Searched-term lookups (`getSearchedTermSets()`). |
| `lib/backfill-utils.ts` | Backfill helpers. |
| `lib/d1-prisma.ts` | Prisma client for scripts, backed by production D1 over HTTP (epoch-ms date strings, SQLite dialect). |
| `lib/search-term-deduplicator.ts` | Containment checking to skip redundant terms (exact dupes, supersets, too-common). |
| `lib/error-helpers.ts` | `getErrorMessage()` for `unknown` errors. |
| `lib/logger.ts` | Console shim for CLI scripts. |

## Utilities (`utils/`)

| File | Purpose |
|------|---------|
| `list-all-search-terms.ts` | Deduplicated inventory of all non-numeric search terms across `batch-configs.ts` and `lib/fallback-terms.ts`. Importable (`getAllSearchTerms()`) or CLI. |

## Repomix (`repomix/`)

Shell scripts behind `npm run repomix` — regenerate the AI-readable code packs in `docs/repomix/` (token tree, compressed/full XML, per-area packs) and retrain the zstd dictionary in `.condense/`. Run via npm script, not directly.
