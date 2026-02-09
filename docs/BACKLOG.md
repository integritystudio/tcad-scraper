# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-09
**Status**: 584 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint configured

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

### TD-22: Standardize Pino structured logging in dom-scraper.ts
- **Priority**: LOW
- **Source**: DRY-3,5 code review
- **Issue**: dom-scraper.ts mixes template literals with `%s` format strings. Should use Pino structured logging objects consistently.
- **Files**: `server/src/lib/fallback/dom-scraper.ts`

### TD-23: Add edge case tests for property transformers
- **Priority**: MEDIUM
- **Source**: Code review (Feb 9, 2026)
- **Issue**: Missing tests for invalid dates, negative values, very long strings, special characters.
- **Files**: `server/src/utils/__tests__/property-transformers.test.ts`

### TD-24: Add runtime validation for critical transformer fields
- **Priority**: MEDIUM
- **Source**: Code review (Feb 9, 2026)
- **Issue**: `transformPropertyToSnakeCase()` does not validate `year` or `appraisedValue` at runtime. Prisma enforces non-null at DB level but defensive validation would catch data issues earlier.
- **Files**: `server/src/utils/property-transformers.ts`

### TD-25: Move CHUNK_SIZE to configuration
- **Priority**: LOW
- **Source**: Code review (Feb 9, 2026)
- **Issue**: Raw SQL batch insert chunk size is hard-coded to 500. Should be configurable for tuning across environments.
- **Files**: `server/src/queues/scraper.queue.ts`

### TD-26: Add debug logging to utility functions
- **Priority**: LOW
- **Source**: Code review (Feb 9, 2026)
- **Issue**: `error-helpers.ts`, `timing.ts`, `property-transformers.ts` have no debug logging. Adding optional trace-level logging would aid production troubleshooting.
- **Files**: `server/src/utils/error-helpers.ts`, `server/src/utils/timing.ts`, `server/src/utils/property-transformers.ts`

### TD-27: Clean stale dist/ artifacts from deleted scripts
- **Priority**: LOW
- **Source**: Code review (Feb 9, 2026)
- **Issue**: `dist/` contains compiled JS for deleted enqueue scripts (e.g., `enqueue-trust-batch.d.ts`). Should clean and rebuild.

### TD-28: Improve timing test robustness
- **Priority**: LOW
- **Source**: Code review (Feb 9, 2026)
- **Issue**: `timing.test.ts` tests are coupled to the exact `Math.floor(random * (max - min) + min)` formula. Could test the interface contract (delay within range) instead.
- **Files**: `server/src/utils/__tests__/timing.test.ts`

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
