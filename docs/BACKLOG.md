# Backlog - Remaining Technical Debt

**Last Updated**: 2026-08-08 (T13, T14, all P1 frontend items M36–M42, plus M43 and L19 done; T3, L20, C8 remain open below)
**Status**: 164 frontend + 85 scripts + 75 workers tests passing | TypeScript clean | Lint clean in `src/`, 34 pre-existing `format` errors remain in `scripts/`, `shared/types/`, `workers/tcad-api/src/utils/upsert-sql.ts`

---
## Open Items

#### ~~T13: FTS fallback's 90-result ceiling caps totalResults and empties page 2+~~ [Done]
**Commit**: 9e67a9e | `ftsQueryPage` replaces `ftsMatchIds`; `LIMIT`/`OFFSET` + `COUNT(*)` in SQL; `precomputedTotal` skips Prisma count; `FTS_MAX_PAGE_SIZE=98`.

#### ~~T14: FTS index omits secondary owner-identity columns (DBA, co-owner)~~ [Done]
**Commit**: 4e480d5 | Migration 0004_fts_owner_columns.sql recreates virtual table with `owner_name`/`name_secondary`/`dba`; triggers updated; `FTS_BM25_WEIGHTS` adds ownerName/nameSecondary/dba at 9.0.

#### T3: Retire or activate 2026 mining strategy for backfill scripts
**Priority**: P3 | **Source**: scripts-review audit (2026-08-06)
All four `backfill-2025-*.ts` scripts and Phase 3 of `enqueue-tail-terms.ts` query "2026-only" properties via `mine-2026-terms.ts`, but D1 contains only 2025 data. Strategy is inert until 2026 scrape season begins. Decision: retire the code path (remove Phase 3 + related queries) or document expected activation date. -- `scripts/lib/mine-2026-terms.ts`, `scripts/enqueue-tail-terms.ts:87-98`, `scripts/backfill-2025*.ts`

---

## Findings from Frontend Code Review (2026-08-07)

#### ~~M36: Search state loading flag cleared by stale request finalization~~ [Done]
**Commit**: 9376000 | `finally` now clears `loading` only when `searchAbortRef.current === abortController`, so a superseded call's cleanup can't flip the flag while the newer request is in flight.

#### ~~M37: Duplicate search POST from handleSearch bypassing lastSearchedRef guard~~ [Done]
**Commit**: 7ff5fcc | `handleSearch()` checks `trimmed !== lastSearchedRef.current` before calling `onSearch`, mirroring the debounce path's dedup.

#### ~~M38: currentPage stale when results shrink for identical textual query~~ [Done]
**Commit**: 6a4e035 | `usePagination` clamps `currentPage` to `Math.min(prev, Math.max(1, totalPages))` on `totalPages` change — last valid page, not page 1.

#### ~~M39: PropertyDetails moved below toggle button, reversing UI control flow~~ [Done]
**Commit**: 0c851d3 | Value-summary/ExpandButton row moved back into `CardBody` directly above `PropertyDetails`.

#### ~~M40: CardFooter CSS rule adds unrequested divider and spacing to card content~~ [Done]
**Commit**: 0c851d3 | `.summary` (PropertyCard.module.css) and AttributionCard.module.css's `.card` footer rule zero out `margin-top`/`padding-top`/`border-top`. Note: the override sits at equal specificity to `Card.module.css`'s `.footer` — the same cascade-order fragility tracked as M43 below.

#### ~~M41: ValueComparison falsy-zero guard blocks assessedPercentage chart for zero values~~ [Done]
**Commit**: c0d9d7f | `difference` memo checks `assessedValue === null || assessedValue === undefined` instead of `!assessedValue`.

#### ~~M42: Pagination footer text implies incomplete result set is complete~~ [Done]
**Commit**: 5fa8df1 | `PaginatedResultsGrid` takes `totalResults` as a prop and uses it for the total; the X-Y range still derives from the local slice.

#### ~~M43: Overlapping CSS class specificity in AttributionCard layers defaults and custom styles~~ [Done]
`Card.module.css` now declares all of its rules inside `@layer card`. Unlayered styles always beat layered ones regardless of source order, so a consumer's `className` wins by construction instead of by bundler emission order — no specificity hacks, and it hardens M40's `.summary`/`.actions` overrides on the same mechanism. Verified against the built bundle: every Card class lands inside the layer while AttributionCard's `.card` (including its mobile media query) and PropertyCard's `.card` stay outside it. Only two `<Card>` consumers exist, both of which override.

The AttributionCard conflicts this resolves: `background`, `border-radius`, `box-shadow`, and — the one visible bug — mobile `padding`, where `.card { padding: 1rem }` at ≤640px competed with Card's `.padding-md { padding: 1.5rem }` (media queries add no specificity).

#### ~~L19: Live-search debounce fires on every 1-2 character keystroke without minimum length~~ [Done]
The minimum-length half landed in 18a4c4b (`LIVE_SEARCH_MIN_LENGTH = 3`); the debounce was raised to 1.5s (754c861, 332ad91); and 56294ea moved search to a cacheable GET, so a repeat query is served from the Workers edge cache without re-invoking the AI parse — which was the cost the finding was concerned about.

The remaining sub-claim — that a single-value `lastSearchedRef` should be a multi-value "already searched" set — was **investigated and rejected as invalid**. `useDebounce` only emits *settled* values, so a typo corrected inside the debounce window never dispatches B at all and the correction back to A is already suppressed by the ref. When B *does* settle, B's results are what's on screen, so returning to A **must** re-search or the UI would show Elm Street results under the query "Oak Street". A set of seen queries would introduce exactly that bug. Both cases are now pinned by tests in `SearchBox.test.tsx` ("does not re-search when a typo is corrected within the debounce window" / "re-searches A after B settled, so results match the visible query").

#### L20: Duplicate Date.now()/getTime() calculation in formatRelativeTime and daysSince
**Priority**: P3 | **Source**: code-review (2026-08-07)
In `TimestampList.tsx:14`, formatRelativeTime computes diffMs directly and also separately calls the daysSince() helper, which redoes the same Date.now()/getTime() calculation internally — duplicate work that the sibling FreshnessIndicator.tsx avoided by fully switching to the helper. -- `src/components/features/PropertySearch/PropertyDetails/components/TimestampList.tsx:14`

#### C8: Inline styles in ValueComparison violate project no-inline-styling rule
**Priority**: P3 | **Source**: code-review (2026-08-07)
In `ValueComparison.tsx:96` and `:85`, inline style={{ width: `${assessedPercentage}%` }} and style={{ width: "100%" }} were carried forward/re-touched rather than moved off inline style, violating the project's CLAUDE.md rule "no in-line styling for UI components." -- `src/components/features/PropertySearch/PropertyDetails/components/ValueComparison.tsx:85,96`

---

## Intentional Design Decisions

### M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data
**Status**: Intentional — DISPLAY_YEAR is deliberately pinned to 2025; not a bug. TCAD appraised values for 2026 are marked as "N/A" until published (expected April/May 2026).

---

**Latest migration**: August 6, 2026 audit and scripts-review items (AUD-01 through AUD-08, D1-01 through D1-03, TC-10 through TC-18, T1, T2, T4–T12) migrated to [changelog/2026-08-06.md](changelog/2026-08-06.md) — T3 remains open above
