# Backlog - Remaining Technical Debt

**Last Updated**: 2026-08-11 (T17 and T18 opened from the `performIO` production incident triage; **T16, T17, T18 open**)
**Status**: All suites passing | TypeScript clean (root + workers) | Lint clean repo-wide — 0 errors, 0 warnings
*(Test counts are deliberately not pinned here — they went stale within hours every time. Run the suites; commands are in [CLAUDE.md](../CLAUDE.md#common-commands).)*

---
## Open Items

#### T16: Visual regression tests are macOS-only; add linux and windows baselines
**Priority**: P5 | **Source**: E2E triage (2026-08-08)
`e2e/visual.spec.ts` now skips unless `process.platform === "darwin"`, because Playwright keys each snapshot by OS and only the 6 darwin baselines are committed (`home-page`/`search-results` x chromium/firefox/webkit). On CI's ubuntu runner all 6 failed with "A snapshot doesn't exist ...-linux.png, writing actual" — a missing baseline, not a real visual diff. This was masked until 2026-08-08: while the dev server failed to boot the whole suite failed for that earlier reason, so the snapshot gap never surfaced, and the "126/126 E2E passing" figure in CLAUDE.md cannot have held on Linux. Net effect of the skip is that visual regressions are now caught only when someone runs the suite on a Mac — CI no longer checks them at all.

Fix: capture baselines on each OS (a CI job running `--update-snapshots` and uploading the PNGs as an artifact to commit) and drop the platform guard. Fonts and anti-aliasing differ enough between platforms that a darwin PNG cannot be reused, so each OS needs its own capture; the existing `maxDiffPixelRatio: 0.02` absorbs drift within a platform, not across them. Windows matters less than linux — CI runs ubuntu, so linux alone restores CI coverage. -- `e2e/visual.spec.ts`, `e2e/visual.spec.ts-snapshots/`

#### T17: Anthropic is unfunded and the Grok fallback has no timeout
**Priority**: P1 | **Source**: `performIO` production incident triage (2026-08-11)
`ANTHROPIC_API_KEY` returns HTTP 400 `invalid_request_error` — "Your credit balance is too low to access the Anthropic API" — verified directly against the API on 2026-08-11. It is a **billing state, not an auth failure**: the key is valid, so rotating or re-setting it changes nothing and only adding credits does. It fails in 0.22s, so it costs no latency.

Production therefore runs entirely on the xAI/Grok fallback. That path is correctly wired — `GET /api/properties/search/test` returns `provider: "grok"`, model `grok-4.20-0309-non-reasoning`, in 2.7s — and `shouldFallbackToGrok` does match the 400 + `/credit balance/i` case, so the handoff works. The problem is tail latency: the same call measured 0.54s, 3.3s, 7.7s and 10.6s across four attempts, and one hung past 300s. `callGrokAPI` passes no `AbortSignal`, so a hung call has nothing bounding it and burns the Worker's request budget before failing into the keyword fallback.

Every defect fixed in PR #37 (the D1 CPU crash, bm25 noise, the raw-sentence LIKE, cached degraded responses) is downstream of this path failing — those fixes make the degraded path behave, they do not stop it being entered.

Fix, in two independent parts: fund the Anthropic account, which removes the dependency on the fallback for most queries; and give **both** provider calls an `AbortSignal.timeout(...)` so a slow provider fails fast into the keyword path instead of consuming the request budget. The timeout is the durable half — funding alone leaves the identical exposure the next time either provider is slow. -- `workers/tcad-api/src/lib/claude.service.ts`

#### T18: FTS bm25 ranking is computed and then discarded
**Priority**: P3 | **Source**: search fallback review (2026-08-11)
The keyword fallback ranks ids by `bm25()` inside SQL, then returns them as `{ id: { in: ids } }`. The route hands that to `prisma.property.findMany` with `orderBy: orderBy || { scrapedAt: "desc" }`, and `orderBy` is undefined on every text-match path — so the rows come back sorted by scrape time, which has nothing to do with relevance. SQL `IN` does not preserve list order either, so even dropping the default would give rowid order, not rank.

Net effect: `FTS_BM25_WEIGHTS` — tuned deliberately so owner name and address outrank the legal plat text in `description`, which dropped "condominium" from 18 description-only hits in the top 20 to 0 — decides *which* rows are returned but not the order they are shown in. The tuning is doing half its job.

Fix: preserve the SQL rank, either by re-sorting after `findMany` against the ranked id array, or by selecting the row data in the same ranked query instead of issuing a second `findMany`. The second is fewer round-trips but has to stay inside D1's 100-bound-param limit (see `FTS_MAX_PAGE_SIZE`). -- `workers/tcad-api/src/controllers/property.ts`, `workers/tcad-api/src/lib/keyword-search.ts`

---

## Intentional Design Decisions

### M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data
**Status**: Intentional — but the stated reason is now stale and the decision is due for review. The note read "TCAD appraised values for 2026 are marked as N/A until published (expected April/May 2026)"; as of 2026-08-08 TCAD serves 2026 with `valueReady: 1` and real appraised values, and the 2026 roll is being scraped into D1. `DISPLAY_YEAR` (`workers/tcad-api/src/controllers/property.ts`) still pins the frontend to 2025 deliberately, so the site does not show a partially-backfilled year. Flip it once 2026 coverage is comparable to 2025's.

---

**Latest migration**: August 8, 2026 frontend code review and FTS pagination fixes (M36–M43, L19–L21, C8–C9, T13–T15) migrated to [changelog/2026-08-08.md](changelog/2026-08-08.md) — T16 remains open above | Earlier: August 6, 2026 audit and scripts-review items (AUD-01 through AUD-08, D1-01 through D1-03, TC-10 through TC-18, T1, T2, T4–T12) migrated to [changelog/2026-08-06.md](changelog/2026-08-06.md)
