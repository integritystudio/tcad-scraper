# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-09
**Status**: 607 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint clean

---

## Open Items

### TD-38: Standardize TCAD_YEAR type coercion across usage sites
- **Priority**: LOW
- **Source**: Code review (Feb 9, 2026)
- **Issue**: `tcadYear` is used as: template interpolation (string) in `tcad-scraper.ts`, explicit `String()` in `test-api-direct.ts`, raw number in `scraper.queue.ts`. All work correctly but the inconsistency is confusing. Standardize with a comment explaining the API expects a string value.
- **Files**: `server/src/lib/tcad-scraper.ts`, `server/src/test-api-direct.ts`, `server/src/queues/scraper.queue.ts`

### TD-39: Add unit tests for TCAD_YEAR config parsing
- **Priority**: LOW
- **Source**: Code review (Feb 9, 2026)
- **Issue**: `parseTcadYear()` has no direct unit test for default value, env var override, and out-of-range rejection. Config module is hard to test due to top-level `const config` evaluation, but targeted tests would prevent regressions.
- **Files**: `server/src/config/index.ts`

### TD-40: Add whitespace and min-terms edge cases to batch-configs tests
- **Priority**: LOW
- **Source**: Code review (Feb 9, 2026)
- **Issue**: Current tests check for empty terms but not leading/trailing whitespace or zero-length terms arrays. Add `term === term.trim()` assertion and `terms.length > 0` assertion.
- **Files**: `server/src/scripts/config/__tests__/batch-configs.test.ts`

---

## Completed

All items (TD-2 through TD-17) migrated to `docs/CHANGELOG.md` (February 8, 2026 entry).

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
