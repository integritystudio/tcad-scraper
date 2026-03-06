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

### Completed 2026-03-06 (backlog-implementer pass)

| ID | Commit | Description |
|----|--------|-------------|
| CR-M2 | ea05c39 | Documented opposite filtering strategies (isSupersetOfSuccessful vs buildPrefixIndex) |
| CR-M3 | d3e3ff3 | Added ::int defensive comment to get2025Count in all 4 scripts |
| CR-M5 | 411d05f | Fixed stale "GEO ID prefixes" comment in backfill-2025-unsearched.ts |
| CR-L2 | 5088b8c | Added totalGained session tracking to backfill-2025.ts |
| TST-L1 | d049724 | Strengthened constructor assertions from toBeDefined() to toBeInstanceOf() |
| CR-L1 (03-02) | 00cef81 | Documented token-fetch-once-per-call fragility in scrapePropertiesViaAPI |
| CR-L1 (03-06) | 00cef81 | Documented waitForQueueDrain no-timeout limitation in all 4 scripts |
