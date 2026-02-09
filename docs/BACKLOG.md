# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-09
**Status**: 597 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint clean

---

## Open Items

*No open items remaining.*

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
