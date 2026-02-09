# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-08
**Status**: 560 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint configured

---

## Open Items

### TD-11: `as any` in Production Source (2 documented exceptions)
**Priority**: None (documented) | **Files**: `auth.ts:75`, `index.ts`

- `auth.ts:75` - `jwt.sign()` options requires `any` (library limitation)
- `index.ts` - Helmet `crossOriginResourcePolicy` requires `any` (type mismatch)

Both are library-imposed limitations. No action needed unless library types improve.

### TD-12: `console.*` in CLI Scripts (39 occurrences, intentional)
**Priority**: None (by design) | **3 script files**

- `analyze-search-terms.ts` (27) - CLI report formatting
- `migrate-to-logger.ts` (8) - Developer migration tool
- `get-fresh-token.ts` (4) - Token stdout utility with eslint-disable

Scripts intentionally use console for CLI/stdout output. No change needed.

### TD-13: `api.test.ts` Types Use `unknown` for Dynamic Imports
**Priority**: Low | **File**: `server/src/__tests__/api.test.ts`

`app` and `prisma` variables are typed as `unknown` since they're dynamically imported in `beforeAll`. Methods like `prisma.property.deleteMany()` rely on runtime types. Could use `typeof import(...)` patterns to type them properly.

### TD-14: ESLint Rule to Prevent `console.*` in Test Files
**Priority**: Low | **Scope**: Biome/ESLint config

Add a lint rule scoped to `**/*.test.ts` that warns on `console.*` usage, preventing regressions after TD-2 cleanup.

### TD-15: Document Test Type Patterns for Contributors
**Priority**: Low | **Scope**: Developer docs

Document the type replacement patterns used in TD-8 (`Record<string, unknown>`, `Pick<Type, "key">`, `unknown as TypeCast`, `Record<string, ReturnType<typeof vi.fn>>`) so future contributors follow the same conventions.

---

## Completed Items

- **TD-5**: Replaced `describe.skip()` with `describe.skipIf()` using infrastructure checks (`97a34a2`)
- **TD-8**: Removed all 86 `as any` from 11 test files (`b57eac7`, `bb43a6e`, `517e4b7`)
- **TD-2**: Replaced 21 `console.*` in 6 test files with `logger.debug()` (`5280dce`)
- **TD-3**: Replaced deprecated `startTransaction` with typed `startSpan<T>()` wrapper (`43c92f9`, `1f90485`)
- **TD-6**: Added `npm run lint` script using Biome (`43c92f9`)
- **TD-7**: Made `asyncHandler` generic, eliminated 3 `as any` casts in property routes (`43c92f9`)
- **TD-9**: All config mocks removed from both test files (`811ff05`)
- **TD-10**: Separated frontend/server test runs in root vitest config (`ffd324b`)
- **Redis cache tests**: 40 tests re-enabled (was `describe.skip`) (`85c3e5c`)
- **Config mocks**: Removed from 5 test files (auth, claude, scraper.queue, xcontroller, token-refresh)
- **Winston mocks**: Removed from 3 test files (scheduler, scraper.queue, token-refresh)
- **Winston → Pino migration**: 4 source files (scraper.queue, token-refresh, scrape-scheduler, redis-cache.service)
- **Typed mock objects**: 3 test files (scrape-scheduler, token-refresh, scraper.queue)
- **Test setup**: Added auth env vars + LOG_LEVEL=silent
