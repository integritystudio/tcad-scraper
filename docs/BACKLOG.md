# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-08
**Status**: 560 tests passing, 0 skipped, 0 failed | TypeScript clean | Lint configured

---

## Open Items

None — all technical debt resolved.

---

## Completed (February 8, 2026)

- **TD-12**: ESLint override for CLI scripts (`no-console: off`), removed 9 inline suppression comments
- **TD-16**: Replaced `require()` with ES module imports in `test-utils.ts`
- **TD-17**: Updated stale Jest references to Vitest in `TESTING.md`
- **TD-11**: Replaced `as any` with narrowing casts in `auth.ts` and `index.ts` (`be99993`)
- **TD-13**: Typed `api.test.ts` dynamic imports with `Express` and `PrismaClient` (`36f4450`)
- **TD-14**: ESLint `no-console` set to `"warn"` in test file overrides (`34783b6`)
- **TD-15**: Type-safe test patterns documented in `docs/TESTING.md` (`b0c2f44`)

*Earlier completed items in `docs/CHANGELOG.md` (February 8, 2026 entry).*
