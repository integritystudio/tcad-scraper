# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-08
**Status**: 560 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint configured

---

## Open Items

### TD-18: Missing `year` field in property transformer (PRE-EXISTING BUG)
- **Priority**: HIGH
- **Source**: DRY-4 code review
- **Issue**: `transformPropertyToSnakeCase()` and original inline mappings omit the `year` field from Prisma `Property` model. Frontend never receives `year` data.
- **Files**: `server/src/utils/property-transformers.ts`, `server/src/controllers/property.controller.ts`
- **Fix**: Add `year: number` to `SnakeCaseProperty` interface and `year: prop.year` to transform function

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

### TD-21: Unit tests for extracted utilities
- **Priority**: MEDIUM
- **Source**: DRY code reviews
- **Issue**: New utility files lack dedicated unit tests: `error-helpers.ts`, `timing.ts`, `property-transformers.ts`, `browser-factory.ts`
- **Notes**: `humanDelay` has coverage via tcad-scraper.test.ts. Others tested indirectly through consumer tests.

### TD-22: Standardize Pino structured logging in dom-scraper.ts
- **Priority**: LOW
- **Source**: DRY-3,5 code review
- **Issue**: dom-scraper.ts mixes template literals with `%s` format strings. Should use Pino structured logging objects consistently.
- **Files**: `server/src/lib/fallback/dom-scraper.ts`

---

## Completed

All items (TD-2 through TD-17) migrated to `docs/CHANGELOG.md` (February 8, 2026 entry).

### DRY Review Items (February 8, 2026)
- DRY-1: Consolidated 10 enqueue scripts into config-driven runner
- DRY-2: Extracted `getErrorMessage()` utility (50+ occurrences)
- DRY-3: Extracted `launchTCADBrowser()` browser factory
- DRY-4: Extracted `transformPropertyToSnakeCase()` utility
- DRY-5: Extracted `humanDelay()` to shared timing utility
