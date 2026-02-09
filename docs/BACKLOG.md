# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-09
**Status**: 597 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint clean

---

## Open Items

### TD-29: Deduplicate search terms across batch configs
- **Priority**: HIGH
- **Source**: Code review (Feb 9, 2026)
- **Issue**: "Drive" and "Lane" appear in both `high-priority` and `ultra-high-priority` batches; "Limited" appears in both `llc` and `priority-terms`. Causes duplicate scraping jobs with conflicting priorities.
- **Files**: `server/src/scripts/config/batch-configs.ts`

### TD-30: Fix non-deterministic timing test assertion
- **Priority**: HIGH
- **Source**: Code review (Feb 9, 2026)
- **Issue**: "should produce varying delays" test computes `allSame` but never asserts it. The test passes even if `Math.random()` is broken. Either assert `!allSame` with retry logic, increase range/iterations, or add one deterministic test with mocked `Math.random()`.
- **Files**: `server/src/utils/__tests__/timing.test.ts`

### TD-31: Add `year` field to bulk insert SQL
- **Priority**: MEDIUM
- **Source**: Code review (Feb 9, 2026)
- **Issue**: Raw SQL insert in `scraper.queue.ts` does not include the `year` column. Runtime validation in `transformPropertyToSnakeCase()` catches invalid `year` on API responses but not during database writes, creating an inconsistent validation boundary.
- **Files**: `server/src/queues/scraper.queue.ts:115-133`

### TD-32: Extract validation from transformPropertyToSnakeCase
- **Priority**: MEDIUM
- **Source**: Code review (Feb 9, 2026)
- **Issue**: `transformPropertyToSnakeCase()` now performs validation AND transformation. Function name implies pure transformation. Extract to `validateProperty()` for single-responsibility.
- **Files**: `server/src/utils/property-transformers.ts`

### TD-33: Document QUEUE_BATCH_CHUNK_SIZE env var
- **Priority**: MEDIUM
- **Source**: Code review (Feb 9, 2026)
- **Issue**: New `QUEUE_BATCH_CHUNK_SIZE` env var (default 500) not documented in README or CLAUDE.md. Operators cannot discover tuning capability.
- **Files**: `CLAUDE.md`, `server/ENQUEUE_SCRIPTS_README.md`

### TD-34: Trace logging performance in hot path
- **Priority**: MEDIUM
- **Source**: Code review (Feb 9, 2026)
- **Issue**: `logger.trace()` added to `transformPropertyToSnakeCase()` and `humanDelay()`, called thousands of times per scraping job (418K+ properties). Pino is fast but JSON serialization overhead is non-zero even when filtered by log level. Document that trace should only be enabled for targeted debugging.
- **Files**: `server/src/utils/property-transformers.ts:28`, `server/src/utils/timing.ts:17`

### TD-35: Document batch config priority scale
- **Priority**: LOW
- **Source**: Code review (Feb 9, 2026)
- **Issue**: Priority values (-100, 1, 2, undefined) lack documentation. BullMQ convention (lower = higher priority) is not documented in `BatchConfigEntry` type or batch-configs.ts.
- **Files**: `server/src/scripts/config/batch-configs.ts`, `server/src/scripts/utils/batch-enqueue.ts`

### TD-36: Expand logger mock in property-transformers test
- **Priority**: LOW
- **Source**: Code review (Feb 9, 2026)
- **Issue**: Logger mock only provides `trace`. Should mock all levels (debug, info, warn, error) to prevent failures if future code adds other log calls.
- **Files**: `server/src/utils/__tests__/property-transformers.test.ts:4-6`

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
