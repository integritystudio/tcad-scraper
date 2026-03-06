# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-06
**Status**: 624/624 tests passing | TypeScript clean | Lint clean | Biome clean

---
## Open Items

### Code Review 02-27-2026 of commit 66dc363

  Low
  4. getJwtLifetime should guard exp > iat — STALE: function not found in current codebase; may have been removed in refactor
  6. Test vi.resetModules() could leak — DEFERRED: vi.resetModules() in afterEach is load-bearing for await import() pattern; removal breaks 4 tests. Needs per-test vi.isolateModules() refactor. -- `src/__tests__/App.test.tsx:59`

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 7 items migrated to [changelog/2026-03-06.md](../changelog/2026-03-06.md)
