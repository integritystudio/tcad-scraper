# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-08
**Status**: 560 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint configured

---

## Open Items

### TD-12: `console.*` in CLI Scripts (39 occurrences, intentional)
**Priority**: None (by design) | **3 script files**

- `analyze-search-terms.ts` (27) - CLI report formatting
- `migrate-to-logger.ts` (8) - Developer migration tool
- `get-fresh-token.ts` (4) - Token stdout utility with eslint-disable

Scripts intentionally use console for CLI/stdout output. No change needed.

### TD-16: `require()` in `test-utils.ts`
**Priority**: Low | **File**: `server/src/__tests__/test-utils.ts:149,151`

`isFrontendBuilt()` uses CommonJS `require("node:fs")` and `require("node:path")` instead of ES module imports. Should use top-level `import` statements to match project conventions.

### TD-17: Stale Jest References in `TESTING.md`
**Priority**: Low | **File**: `docs/TESTING.md`

Several sections still reference Jest instead of Vitest (project migrated to Vitest):
- VS Code debug config references `jest` binary (line 240-241)
- Import example uses `@jest/globals` (line 253)
- Resources section links to Jest docs (line 424)

---

## Completed (February 8, 2026)

- **TD-11**: Replaced `as any` with narrowing casts in `auth.ts` and `index.ts` (`be99993`)
- **TD-13**: Typed `api.test.ts` dynamic imports with `Express` and `PrismaClient` (`36f4450`)
- **TD-14**: ESLint `no-console` set to `"warn"` in test file overrides (`34783b6`)
- **TD-15**: Type-safe test patterns documented in `docs/TESTING.md` (`b0c2f44`)

*Earlier completed items in `docs/CHANGELOG.md` (February 8, 2026 entry).*
