# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-21
**Status**: 617/617 tests passing | TypeScript clean | Lint clean | Biome clean

---

## Open Items

### BUG-1: Flaky timing test assertion (P1)
- **File**: `server/src/utils/__tests__/timing.test.ts:56`
- **Test**: `should compute delay using Math.random formula`
- **Error**: `expected 137 to be less than 50` — `setTimeout(resolve, 20)` overshoots under system load
- **Root cause**: Upper bound assertion (50ms) too tight for a mocked 20ms delay; `Date.now()` imprecise under load
- **Fix**: Widen upper bound to 200ms or restructure to test formula without wall-clock timing

### ~~BUG-2: MaxListenersExceededWarning in queue tests (P2)~~ FIXED
- **File**: `server/src/lib/redis-cache.service.ts`, `server/src/services/token-refresh.service.ts`
- **Warning**: `11 SIGTERM/SIGINT listeners added to [process]. MaxListeners is 10`
- **Root cause**: Module-level `process.on('SIGTERM'/'SIGINT')` handlers in `redis-cache.service.ts` and `token-refresh.service.ts` registered unconditionally at import time, stacking duplicate listeners across test threads
- **Fix**: Removed redundant module-level signal handlers; cleanup already handled by unified `gracefulShutdown` in `index.ts` (commit `68701c6`)

### BUG-3: JSDOM `<search>` element warning (P3)
- **File**: `src/components/__tests__/SearchBox.test.tsx`
- **Warning**: `The tag <search> is unrecognized in this browser`
- **Root cause**: JSDOM doesn't support HTML `<search>` element. Component correctly uses semantic HTML.
- **Fix**: No fix needed — console noise only. Will resolve when JSDOM adds support.

### BUG-4: Integration test TODOs (P3)
- **File**: `server/src/__tests__/integration.test.ts`
- **Details**: 5 TODO comments about tests depending on frontend build files or error handling setup
- **Fix**: Implement conditional test setup or mark as known skips

#### RENDER-1: test-utils.ts lacks REDIS_URL support (P3)
**Priority**: P3 | **Source**: Render migration session (68701c6)
Test infrastructure in `server/src/__tests__/test-utils.ts` creates Redis connections using `config.redis.host`/`config.redis.port` only. Does not use `config.redis.url` when set. Low impact — tests run locally where host/port is always correct.

#### RENDER-2: worker.ts uses raw env vars instead of config (P3)
**Priority**: P3 | **Source**: Render migration session (68701c6)
`server/src/scripts/worker.ts` logs `process.env.REDIS_HOST` / `process.env.REDIS_PORT` directly instead of using `config.redis`. Also uses `winston` instead of project-standard Pino logger. -- `server/src/scripts/worker.ts:14-17`

#### RENDER-3: Playwright Docker worker for Render (P2)
**Priority**: P2 | **Source**: docs/RENDER-MIGRATION.md (section 3: Playwright on Render)
Render's native Node runtime lacks Chromium system dependencies. Current approach is API-only mode (`TCAD_AUTO_REFRESH_TOKEN=true`). If browser fallback is needed, create a Docker-based Background Worker with Playwright deps pre-installed. Requires Dockerfile + `runtime: docker` in render.yaml.

#### RENDER-4: Pin Node.js version for Render (P3)
**Priority**: P3 | **Source**: Render migration session
No `.node-version` file or `engines` field in `package.json`. Render defaults to latest LTS. Pin to avoid unexpected breakage on Node major version bumps.

---

## Completed

All items (TD-2 through TD-17) migrated to `docs/CHANGELOG.md` (February 8, 2026 entry).

### Session: February 9, 2026 (infrastructure & deployment)
- Migrated frontend from `www.aledlie.com/tcad-scraper/` to custom domain `alephatx.info` (GitHub Pages + Cloudflare)
- Set Vite `base` from `"/tcad-scraper/"` to `"/"` for root domain deployment
- Configured DNS: `alephatx.info` (GitHub Pages), `www.alephatx.info` (cert provisioning), `api.alephatx.info` (Cloudflare Tunnel)
- Fixed Cloudflare SSL mode (Flexible) for Hobbes origin on port 80
- Restarted nginx on Hobbes (had been failed since Feb 6)
- Re-provisioned GitHub Pages HTTPS cert (was expired/stuck in `bad_authz`)
- Created missing Prisma migration `20251201000000_add_year_column` (year column existed in schema/prod but had no migration)
- Fixed CI deploy: added `npm rebuild` after `npm ci` for rollup native module on Linux
- Updated CLAUDE.md infrastructure section, debugging table, access points

### Session: February 9, 2026 (stale file cleanup)
- Deleted `server/docs/TEST-SEPARATION-STRATEGY.md` — superseded by `docs/TESTING.md` (referenced stale Jest config, wrong test counts)
- Deleted `server/fallbackBrowserSearch/` — experimental code, not imported anywhere; production scraper has built-in Playwright fallback
- Deleted `dev/RESUME-HERE.md` — stale session handoff doc (Nov 2025, `new-ui` branch, 138 tests)
- Integrated `GTM-SETUP-GUIDE.md` — GTM measurement ID `G-ECH51H8L2Z` added to README.md and `docs/ANALYTICS.md`
- Integrated `ATTRIBUTION-COMPONENTS.md` — attribution component docs merged into `docs/ANALYTICS.md` (Attribution Components section)

### Session: February 8-9, 2026
- DRY-1: Consolidated 10 enqueue scripts into config-driven runner
- DRY-2: Extracted `getErrorMessage()` utility (50+ occurrences)
- DRY-3: Extracted `launchTCADBrowser()` browser factory
- DRY-4: Extracted `transformPropertyToSnakeCase()` utility
- DRY-5: Extracted `humanDelay()` to shared timing utility
- TD-18: Fixed missing `year` field in property transformer
- TD-21: Added unit tests for extracted utilities (24 tests)
- Updated `QUICK-START.md` and `ENQUEUE_SCRIPTS_README.md` for consolidated script
- Added SQL security audit comment to `scraper.queue.ts`

### Session: February 9, 2026 (continued)
- TD-23: Added edge case tests for property transformers (negative values, large numbers, special chars, long strings, fractional values)
- TD-24: Added runtime validation for `year` and `appraisedValue` in `transformPropertyToSnakeCase()` with 6 validation tests
- TD-25: Moved `CHUNK_SIZE` to `config.queue.batchChunkSize` (env: `QUEUE_BATCH_CHUNK_SIZE`)
- TD-22: Standardized all logging in `dom-scraper.ts` to Pino structured format
- TD-27: Cleaned 27 stale dist/ artifacts from deleted scripts (rebuilt from clean)
- TD-28: Refactored timing tests to verify interface contract (delay within range) instead of exact formula
- TD-26: Added trace-level logging to `timing.ts` and `property-transformers.ts` (skipped `error-helpers.ts` - too simple)
- Added `assessedValue` NaN/Infinity validation (when non-null) per code review
- Standardized last emoji log in `dom-scraper.ts` to structured format
- TD-19: Migrated 4 scripts to batch-configs.ts (grove, high-priority, priority-terms, ultra-high-priority); kept 2 with custom logic (test-batch-20, high-value-batch)
- TD-20: Removed unnecessary `.bind(propertyController)` from 9 routes (controller has zero `this` references); updated CLAUDE.md documented exceptions

### Session: February 9, 2026 (code review findings)
- TD-29: Deduplicated search terms across batch configs (removed "Drive", "Lane" from high-priority; "Limited" from llc; "Association" from foundation — kept in higher-priority batch)
- TD-30: Fixed non-deterministic timing test — replaced dead `allSame` variable with deterministic test using mocked `Math.random()`
- TD-31: Added `year` field to bulk insert SQL in `scraper.queue.ts` (14 columns, matches TCAD API pYear)
- TD-32: Extracted `validateProperty()` from `transformPropertyToSnakeCase()` for single-responsibility; added 5 direct validation tests
- TD-33: Documented `QUEUE_BATCH_CHUNK_SIZE` env var in CLAUDE.md and ENQUEUE_SCRIPTS_README.md
- TD-34: Added JSDoc performance notes to `timing.ts` and `property-transformers.ts` (trace logging in hot path)
- TD-35: Documented batch config priority scale (-100, 1, 2, omit) in `batch-configs.ts` JSDoc
- TD-36: Expanded logger mocks in property-transformers and timing tests (trace → all levels)
- Fixed QUICK-START.md stale "10 batch types" → 14
- Updated ENQUEUE_SCRIPTS_README.md term counts after deduplication (124 → 120 jobs)
- Replaced hardcoded pYear 2025 with configurable `TCAD_YEAR` (env var, default: current year)
- TD-37: Added batch-configs unit tests (cross-batch duplicate detection, intra-batch duplicates, empty terms, getAvailableBatchTypes)
- TD-38: Standardized `tcadYear` type coercion — `String()` → template interpolation in `test-api-direct.ts`, inline comments on config field and SQL usage
- TD-39: Added 7 unit tests for `parseTcadYear()` (default, override, boundary, out-of-range, non-numeric); exported function with `@internal` tag
- TD-40: Added whitespace (`term === term.trim()`) and min-terms (`terms.length > 0`) edge case tests to batch-configs

### Session: February 21, 2026 (Render migration prep)
- Created `render.yaml` Render Blueprint (web service, key value, postgres, env groups)
- Added `REDIS_URL` connection string support to config, redis-cache.service, scraper.queue
- Unified SIGTERM/SIGINT handlers into single `gracefulShutdown` with hard timeout for Render redeploys
- Updated `logConfigSummary` to display "URL configured" when REDIS_URL is set
- BUG-2: Fixed MaxListenersExceededWarning — removed duplicate module-level signal handlers from `redis-cache.service.ts` and `token-refresh.service.ts` (cleanup already handled by `index.ts` graceful shutdown)
- Added `docs/RENDER-MIGRATION.md` migration plan
