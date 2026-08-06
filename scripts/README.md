# Scripts

All scripts run from the repo root with `doppler run -- npx tsx scripts/<script>.ts` unless noted. Enqueueing goes through the Workers API (`scripts/lib/queue-utils.ts` → `POST /api/properties/scrape`), which requires `TCAD_API_KEY`.

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
| `search-terms-summary.sh` | Recent search terms table. |

## Backfill

| Script | Purpose |
|--------|---------|
| `backfill-2025.ts` | Primary 2025 backfill using DB-driven term selection. |
| `backfill-2025-proven.ts` | Backfill using only proven high-yield terms from analytics. |
| `backfill-2025-unsearched.ts` | Backfill using terms not yet searched in 2025. |
| `backfill-2025-novel.ts` | Backfill using novel/experimental term patterns. |
| `run-first-200.ts` | Enqueue the first 200 strategy terms. |
| `enqueue-tail-terms.ts` | Multi-phase tail term optimizer (analytics + owner-name mining). `--phase N`. |

## Analysis

| Script | Purpose |
|--------|---------|
| `analyze-failed-jobs.ts` | Categorize and report on failed scrape jobs. |
| `analyze-search-terms.ts` | Analyze search term effectiveness from analytics data. |
| `generate-next-200-terms.ts` | Generate the next 200 unsearched terms; `--enqueue` sends them to the Workers API. |
| `generate-valid-5char-terms.ts` | Generate valid 5-char terms from dictionary, filtering known failures. |
| `check-unsearched-terms.ts` | Find inventory terms not yet searched for current year. Uses batched EXISTS queries. |
| `test-import-paths.ts` | Verify script import paths resolve. |

## Config

| File | Purpose |
|------|---------|
| `config/batch-configs.ts` | Named batch types (LLC, trust, corporation, etc.) with priority tiers. Includes `HIGH_RESULT_TERM_SPLITS` for high-volume terms. |

## Shared (`lib/`)

| File | Purpose |
|------|---------|
| `lib/queue-utils.ts` | `enqueueBatch()` — HTTP enqueue via the Workers API. |
| `lib/backfill-runner.ts` | Shared runner for the backfill scripts. |
| `lib/fallback-terms.ts` | Curated fallback search term pool (`FALLBACK_TERMS`). |
| `lib/searched-terms.ts` | Searched-term lookups. |
| `lib/backfill-utils.ts` | Backfill helpers. |

## Utilities (`utils/`)

| File | Purpose |
|------|---------|
| `list-all-search-terms.ts` | Deduplicated inventory of all non-numeric search terms across `batch-configs.ts` and `lib/fallback-terms.ts`. Importable (`getAllSearchTerms()`) or CLI. |
