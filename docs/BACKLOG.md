# Backlog - Remaining Technical Debt

**Last Updated**: 2026-08-08 (T15, L20, C8, L21, C9 done; **T3 is the only open item**)
**Status**: 167 frontend + 85 scripts + 77 workers tests passing | TypeScript clean (root + workers) | Lint clean repo-wide — 0 errors, 0 warnings

---
## Open Items

#### T3: Retire or activate 2026 mining strategy for backfill scripts
**Priority**: P3 | **Source**: scripts-review audit (2026-08-06)
All four `backfill-2025-*.ts` scripts and Phase 3 of `enqueue-tail-terms.ts` query "2026-only" properties via `mine-2026-terms.ts`, but D1 contains only 2025 data. Strategy is inert until 2026 scrape season begins. Decision: retire the code path (remove Phase 3 + related queries) or document expected activation date. -- `scripts/lib/mine-2026-terms.ts`, `scripts/enqueue-tail-terms.ts:87-98`, `scripts/backfill-2025*.ts`

---

## Intentional Design Decisions

### M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data
**Status**: Intentional — DISPLAY_YEAR is deliberately pinned to 2025; not a bug. TCAD appraised values for 2026 are marked as "N/A" until published (expected April/May 2026).

---

**Latest migration**: August 8, 2026 frontend code review and FTS pagination fixes (M36–M43, L19–L21, C8–C9, T13–T15) migrated to [changelog/2026-08-08.md](changelog/2026-08-08.md) — T3 remains open above | Earlier: August 6, 2026 audit and scripts-review items (AUD-01 through AUD-08, D1-01 through D1-03, TC-10 through TC-18, T1, T2, T4–T12) migrated to [changelog/2026-08-06.md](changelog/2026-08-06.md)
