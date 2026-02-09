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

*Completed items migrated to `docs/CHANGELOG.md` (February 8, 2026 entry).*
