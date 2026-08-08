# Backlog - Remaining Technical Debt

**Last Updated**: 2026-08-08 (T3 closed — 2026 mining activated with the year direction reversed; **no open items**)
**Status**: 167 frontend + 117 scripts + 83 workers tests passing | TypeScript clean (root + workers) | Lint clean repo-wide — 0 errors, 0 warnings

---
## Open Items

_None._

---

## Intentional Design Decisions

### M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data
**Status**: Intentional — but the stated reason is now stale and the decision is due for review. The note read "TCAD appraised values for 2026 are marked as N/A until published (expected April/May 2026)"; as of 2026-08-08 TCAD serves 2026 with `valueReady: 1` and real appraised values, and the 2026 roll is being scraped into D1. `DISPLAY_YEAR` (`workers/tcad-api/src/controllers/property.ts`) still pins the frontend to 2025 deliberately, so the site does not show a partially-backfilled year. Flip it once 2026 coverage is comparable to 2025's.

---

**Latest migration**: August 8, 2026 frontend code review and FTS pagination fixes (M36–M43, L19–L21, C8–C9, T13–T15) migrated to [changelog/2026-08-08.md](changelog/2026-08-08.md) | Earlier: August 6, 2026 audit and scripts-review items (AUD-01 through AUD-08, D1-01 through D1-03, TC-10 through TC-18, T1, T2, T4–T12) migrated to [changelog/2026-08-06.md](changelog/2026-08-06.md)
