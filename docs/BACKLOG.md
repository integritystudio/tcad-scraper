# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-09
**Status**: 595 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint clean

---

## Open Items

### TD-19: Consolidate remaining non-standard enqueue scripts
- **Priority**: LOW
- **Source**: DRY-1 review
- **Issue**: 6 scripts use direct `scraperQueue.add()` instead of `enqueueBatchGeneric()`: `enqueue-grove.ts`, `enqueue-high-priority.ts`, `enqueue-priority-terms.ts`, `enqueue-ultra-high-priority.ts`, `enqueue-test-batch-20.ts`, `enqueue-high-value-batch.ts`
- **Notes**: These have custom logic (token refresh, priority settings) that doesn't fit the standard config pattern. Consider if any can be migrated or if they should remain as-is.

### TD-20: DRY-6 controller method binding pattern
- **Priority**: LOW
- **Source**: DRY review (deferred)
- **Issue**: Controllers use `.bind(this)` in route registration. Could standardize with arrow functions or a binding decorator pattern.
- **Files**: `server/src/routes/property.routes.ts`

### TD-26: Add debug logging to utility functions
- **Priority**: LOW
- **Source**: Code review (Feb 9, 2026)
- **Issue**: `error-helpers.ts`, `timing.ts`, `property-transformers.ts` have no debug logging. Adding optional trace-level logging would aid production troubleshooting.
- **Files**: `server/src/utils/error-helpers.ts`, `server/src/utils/timing.ts`, `server/src/utils/property-transformers.ts`

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
