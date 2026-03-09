# Scripts

All scripts run from `server/` with `doppler run -- npx tsx src/scripts/<script>.ts`.

## Core (production)

| Script | Purpose |
|--------|---------|
| `continuous-batch-scraper.ts` | Long-running DB-driven scraper. 4-tier term selection + 426-term fallback pool. |
| `enqueue-batch.ts` | Config-driven CLI: `npx tsx src/scripts/enqueue-batch.ts <batchType>`. See `config/batch-configs.ts` for 17 batch types. |
| `queue-results.ts` | Queue status + recent completed/failed jobs. `npm run queue:status` or `--limit N`. |
| `worker.ts` | BullMQ worker process for scraper queue jobs. |

## Config

| File | Purpose |
|------|---------|
| `config/batch-configs.ts` | 17 named batch types (LLC, trust, corporation, etc.) with priority tiers (-100 to 2). Includes `HIGH_RESULT_TERM_SPLITS` for high-volume terms. |

## Enqueue

| Script | Purpose |
|--------|---------|
| `enqueue-terms.ts` | Enqueue arbitrary terms from CLI args. |
| `enqueue-prefix-expansions.ts` | Generate and enqueue prefix-expanded terms (e.g., `Court` -> `Courta`..`Courtz`). |
| `enqueue-uncommon-names.ts` | Enqueue curated uncommon name terms. |
| `enqueue-test-batch-20.ts` | Enqueue a small 20-term test batch. |
| `enqueue-08-08-search.ts` | One-shot: 193 terms from `docs/08-08-2026-search.md` with monitor. |

## Backfill

| Script | Purpose |
|--------|---------|
| `backfill-2025.ts` | Primary 2025 backfill using DB-driven term selection. |
| `backfill-2025-proven.ts` | Backfill using only proven high-yield terms from analytics. |
| `backfill-2025-unsearched.ts` | Backfill using terms not yet searched in 2025. |
| `backfill-2025-novel.ts` | Backfill using novel/experimental term patterns. |
| `run-until-target.ts` | Run scraper until a target property count is reached. |

## Analysis

| Script | Purpose |
|--------|---------|
| `analyze-failed-jobs.ts` | Categorize and report on failed scrape jobs. |
| `analyze-search-terms.ts` | Analyze search term effectiveness from analytics data. |
| `generate-search-terms.ts` | Generate candidate search terms for enqueue. |
| `generate-next-200-terms.ts` | Generate the next 200 unsearched terms. |
| `generate-valid-5char-terms.ts` | Generate valid 5-char terms from dictionary, filtering known failures. |
| `check-unsearched-terms.ts` | Find inventory terms (593 total) not yet searched for current year. Uses batched EXISTS queries. |

## Queue Management

| Script | Purpose |
|--------|---------|
| `check-queue-status.ts` | Quick queue size check (waiting/active/completed/failed). |
| `clear-all-jobs.ts` | Clear all jobs from the queue. |
| `auto-requeue-on-401.ts` | Watch for 401 failures and auto-requeue with fresh tokens. |
| `queue-entity-searches.ts` | Enqueue entity-type search terms (Trust, LLC, Corp, etc.). |
| `queue-entity-searches-fresh.ts` | Same as above with fresh token refresh first. |

## Token & Debug

| Script | Purpose |
|--------|---------|
| `get-fresh-token.ts` | Fetch and print a fresh TCAD API token. |
| `debug-token-refresh.ts` | Debug token refresh cycle timing and behavior. |
| `migrate-to-logger.ts` | One-time migration: convert `console.*` calls to Pino logger. |

## Utilities (`utils/`)

| File | Purpose |
|------|---------|
| `batch-enqueue.ts` | Shared batch enqueue logic used by `enqueue-batch.ts` and batch configs. |
| `list-all-search-terms.ts` | Deduplicated inventory of all 593 non-numeric search terms across `batch-configs.ts` and `continuous-batch-scraper.ts`. Importable (`getAllSearchTerms()`) or CLI. |

## Requeue (`requeue/`)

Recovery scripts for failed jobs. See [Troubleshooting](../../README.md#troubleshooting) in the server README.

| Script | When to Use |
|--------|-------------|
| `requeue-all-failed-with-error-tracking.ts` | General recovery: categorizes failures, saves JSON report, re-enqueues all. Stays running for auto-refresh. |
| `requeue-analytics-failed-jobs.ts` | Re-enqueue only jobs that failed due to missing `search_term_analytics` table. One-shot. |
| `requeue-with-fresh-tokens.ts` | Token expiry recovery: clears queue, refreshes token, re-enqueues all failed + pending. Stays running. |

## Test Scripts (`utils/test-scripts/`)

Manual testing and debugging. Not part of `npm test`.

| Script | Purpose |
|--------|---------|
| `test-api-direct.ts` | Test TCAD API calls directly. |
| `test-api-scraper.ts` | Test scraper against TCAD API. |
| `test-api-token-config.ts` | Verify token configuration (`npm run test:token-config`). |
| `test-enqueue.ts` | Manually enqueue test jobs. |
| `test-queue-job-flow.ts` | Trace a job through the queue lifecycle (`npm run test:queue-flow`). |
| `test-single-job.ts` | Run a single scrape job end-to-end. |
| `test-token-refresh.ts` | Verify token refresh cycle (`npm run test:token-refresh`). |
| `batch-scrape.ts` | Legacy batch scraper with configurable strategy (cities/zips/types). |
| `batch-scrape-100.ts` | Legacy one-shot batch with 100 hardcoded search terms. |
| `batch-scrape-comprehensive.ts` | Legacy comprehensive scraper with toggleable categories. |

## Archived (`one-off-and-test-batches/`)

One-time campaign scripts. Data has been consolidated into `batch-configs.ts` and `continuous-batch-scraper.ts`.

| Script | Purpose |
|--------|---------|
| `enqueue-40k-sprint.ts` | Bulk enqueue targeting 40K property milestone. |
| `enqueue-high-value-batch.ts` | Enqueue high-value entity terms (Trust, LLC, etc.). |
| `enqueue-optimized-100.ts` | Enqueue 100 optimized terms with deduplication. |
| `enqueue-by-category.ts` | Categorized 5-char terms from dictionary against curated name lists. Dead code (broken imports); data extracted to batch-configs. |
