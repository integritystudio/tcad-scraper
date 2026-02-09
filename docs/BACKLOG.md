# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-09
**Status**: 617 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint clean

---

## Open Items

No open items.

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
