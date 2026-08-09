# Backlog - Remaining Technical Debt

**Last Updated**: 2026-08-08 (T3 closed — 2026 mining activated with the year direction reversed; **T16 is the only open item**)
**Status**: 167 frontend + 122 scripts + 83 workers tests passing | TypeScript clean (root + workers) | Lint clean repo-wide — 0 errors, 0 warnings

---
## Open Items

#### T16: Visual regression tests are macOS-only; add linux and windows baselines
**Priority**: P5 | **Source**: E2E triage (2026-08-08)
`e2e/visual.spec.ts` now skips unless `process.platform === "darwin"`, because Playwright keys each snapshot by OS and only the 6 darwin baselines are committed (`home-page`/`search-results` x chromium/firefox/webkit). On CI's ubuntu runner all 6 failed with "A snapshot doesn't exist ...-linux.png, writing actual" — a missing baseline, not a real visual diff. This was masked until 2026-08-08: while the dev server failed to boot the whole suite failed for that earlier reason, so the snapshot gap never surfaced, and the "126/126 E2E passing" figure in CLAUDE.md cannot have held on Linux. Net effect of the skip is that visual regressions are now caught only when someone runs the suite on a Mac — CI no longer checks them at all.

Fix: capture baselines on each OS (a CI job running `--update-snapshots` and uploading the PNGs as an artifact to commit) and drop the platform guard. Fonts and anti-aliasing differ enough between platforms that a darwin PNG cannot be reused, so each OS needs its own capture; the existing `maxDiffPixelRatio: 0.02` absorbs drift within a platform, not across them. Windows matters less than linux — CI runs ubuntu, so linux alone restores CI coverage. -- `e2e/visual.spec.ts`, `e2e/visual.spec.ts-snapshots/`

---

## Intentional Design Decisions

### M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data
**Status**: Intentional — but the stated reason is now stale and the decision is due for review. The note read "TCAD appraised values for 2026 are marked as N/A until published (expected April/May 2026)"; as of 2026-08-08 TCAD serves 2026 with `valueReady: 1` and real appraised values, and the 2026 roll is being scraped into D1. `DISPLAY_YEAR` (`workers/tcad-api/src/controllers/property.ts`) still pins the frontend to 2025 deliberately, so the site does not show a partially-backfilled year. Flip it once 2026 coverage is comparable to 2025's.

---

**Latest migration**: August 8, 2026 frontend code review and FTS pagination fixes (M36–M43, L19–L21, C8–C9, T13–T15) migrated to [changelog/2026-08-08.md](changelog/2026-08-08.md) — T16 remains open above | Earlier: August 6, 2026 audit and scripts-review items (AUD-01 through AUD-08, D1-01 through D1-03, TC-10 through TC-18, T1, T2, T4–T12) migrated to [changelog/2026-08-06.md](changelog/2026-08-06.md)
