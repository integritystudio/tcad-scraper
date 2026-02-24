# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-23
**Status**: 617/617 tests passing | TypeScript clean | Lint clean | Biome clean

---

## Open Items

### BUG-3: JSDOM `<search>` element warning (P3) — No fix needed
- **File**: `src/components/__tests__/SearchBox.test.tsx`
- **Warning**: `The tag <search> is unrecognized in this browser`
- **Root cause**: JSDOM doesn't support HTML `<search>` element. Component correctly uses semantic HTML.
- **Fix**: No fix needed — console noise only. Will resolve when JSDOM adds support.

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).
