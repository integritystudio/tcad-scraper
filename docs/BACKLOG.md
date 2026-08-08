# Backlog - Remaining Technical Debt

**Last Updated**: 2026-08-08 (T15, L20, C8, L21 done; T3 and newly-filed C9 remain open below)
**Status**: 166 frontend + 85 scripts + 77 workers tests passing | TypeScript clean (root + workers) | Lint clean repo-wide — 0 errors, 0 warnings

---
## Open Items

#### ~~T13: FTS fallback's 90-result ceiling caps totalResults and empties page 2+~~ [Done]
**Commit**: 9e67a9e | `ftsQueryPage` replaces `ftsMatchIds`; `LIMIT`/`OFFSET` + `COUNT(*)` in SQL; `precomputedTotal` skips Prisma count; `FTS_MAX_PAGE_SIZE=98`.
**Follow-up**: 6d71194 moved `FTS_MAX_PAGE_SIZE` out of `keyword-search.ts` into `workers/tcad-api/src/utils/constants.ts` (beside `D1_MAX_BOUND_PARAMS`, which it derives from) and made it the default API page size, replacing `DEFAULT_QUERY_LIMIT` in `propertyFilterSchema.limit` and `runNaturalLanguageSearch`. At the old default of 100 the fallback clamped its page to 98 while pagination still reported `limit: 100`, so a client paging on the reported limit skipped ranks 98-99 of every page. `DEFAULT_QUERY_LIMIT` is deliberately untouched in `scraper.workflow.ts:150,181`, where it caps TCAD pagination *pages*, not rows. Residual gap tracked as T15.

#### ~~T14: FTS index omits secondary owner-identity columns (DBA, co-owner)~~ [Done]
**Commit**: 4e480d5 | Migration 0004_fts_owner_columns.sql recreates virtual table with `owner_name`/`name_secondary`/`dba`; triggers updated; `FTS_BM25_WEIGHTS` adds ownerName/nameSecondary/dba at 9.0.
**Applied to production D1 2026-08-08** (7.1s, `wrangler d1 execute --remote --file`). Verified: virtual table carries all 7 columns, all three sync triggers replaced, and the `rebuild` indexed **484,251** rows (matches `/health` propertyCount). New columns are individually searchable — `dba:"hydrochem"` 1 hit, `name_secondary:"trust"` 1,489, `owner_name:"llc"` 13,719.
**No deploy-ordering requirement** — an earlier review claim that a bm25 weight/column-count mismatch errors is **wrong**: 4-weight and 7-weight `bm25()` calls both succeed against the 7-column table (FTS5 defaults unspecified weights rather than erroring). So the pre-0004 deployed code kept working after the migration, and because `MATCH` searches all columns, T14's coverage win went live *without* a deploy. What the pending deploy adds is ranking only: the three new columns currently sit at the implicit default weight instead of 9.0.

#### ~~T15: Explicit `limit` above 98 still leaves FTS ranks unreachable~~ [Done]
`runNaturalLanguageSearch` now derives one `effectiveLimit` after the fallback has run and reports *that* as `pagination.limit`, so a client paging on the reported value steps by what it received. The clamp is conditional on `ftsPrecomputedTotal !== undefined`: only the FTS page is capped at `FTS_MAX_PAGE_SIZE`: the AI path and the contains-filter degradation both page in Prisma and still honour the full request, so clamping their reported limit would have under-reported rows that were actually served. The same value now feeds `findMany`'s `take`, which previously carried its own hardcoded `1000`.

Both hardcoded `1000`s are gone: `property.types.ts` imports `MAX_QUERY_LIMIT` from the root `utils/constants.ts` for all three schemas' `.max()`, matching the existing cross-boundary import in `scraper.workflow.ts:33`. Two regression tests in `search-keyword-fallback.test.ts` pin the split — FTS reports `FTS_MAX_PAGE_SIZE` for a `limit=1000` request, contains-filters report `MAX_QUERY_LIMIT` and take that many.

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
**Commit**: 597494e | `Card.module.css` now declares all of its rules inside `@layer card`. Unlayered styles always beat layered ones regardless of source order, so a consumer's `className` wins by construction instead of by bundler emission order — no specificity hacks, and it hardens M40's `.summary`/`.actions` overrides on the same mechanism. Verified against the built bundle: every Card class lands inside the layer while AttributionCard's `.card` (including its mobile media query) and PropertyCard's `.card` stay outside it. Only two `<Card>` consumers exist, both of which override.

The AttributionCard conflicts this resolves: `background`, `border-radius`, `box-shadow`, and — the one visible bug — mobile `padding`, where `.card { padding: 1rem }` at ≤640px competed with Card's `.padding-md { padding: 1.5rem }` (media queries add no specificity).

#### ~~L19: Live-search debounce fires on every 1-2 character keystroke without minimum length~~ [Done]
**Commit**: 720c7d8 (regression tests) | The minimum-length half landed in 18a4c4b (`LIVE_SEARCH_MIN_LENGTH = 3`); the debounce was raised to 1.5s (754c861, 332ad91); and 56294ea moved search to a cacheable GET, so a repeat query is served from the Workers edge cache without re-invoking the AI parse — which was the cost the finding was concerned about.

The remaining sub-claim — that a single-value `lastSearchedRef` should be a multi-value "already searched" set — was **investigated and rejected as invalid**. `useDebounce` only emits *settled* values, so a typo corrected inside the debounce window never dispatches B at all and the correction back to A is already suppressed by the ref. When B *does* settle, B's results are what's on screen, so returning to A **must** re-search or the UI would show Elm Street results under the query "Oak Street". A set of seen queries would introduce exactly that bug. Both cases are now pinned by tests in `SearchBox.test.tsx` ("does not re-search when a typo is corrected within the debounce window" / "re-searches A after B settled, so results match the visible query").

#### ~~L20: Duplicate Date.now()/getTime() calculation in formatRelativeTime and daysSince~~ [Done]
`formatters.ts` gains `elapsedMs()`, which `daysSince()` now uses and `formatRelativeTime` calls once, deriving days/hours/minutes from that single value. Also removes a second-order bug the finding did not name: the two `Date.now()` calls could straddle a tick, so `diffDays` and `diffHours` were read off different "now"s. `MS_PER_MINUTE`/`MS_PER_HOUR`/`MS_PER_DAY` are exported from the same module, replacing `TimestampList`'s inline `1000 * 60 * 60` arithmetic (no magic numbers).

#### ~~C8: Inline styles in ValueComparison violate project no-inline-styling rule~~ [Done]
Both widths moved into `ValueComparison.module.css` as `.barFillFull` (the appraised reference bar, now carrying no `style` attribute at all) and `.barFillPartial` (`width: var(--bar-fill-percent, 0%)`). The three bar classes deliberately declare disjoint properties, so none has to out-cascade another — the M43 failure mode. The residual is that the percentage still crosses through the `style` attribute, as `--bar-fill-percent`: that is a datum, not a style declaration, and it is the conventional CSS-Modules answer for a data-driven dimension. Two tests in `ValueComparison.test.tsx` assert the custom property is set and `style.width` is not. **Not in scope, still open**: `AnswerBox.tsx:11-12` has the same violation (`style={{ width: "80%", height: "24px" }}` on skeletons) — filed as C9.

#### C9: Inline skeleton dimensions in AnswerBox violate no-inline-styling rule
**Priority**: P3 | **Source**: found while fixing C8 (2026-08-08)
`AnswerBox.tsx:11-12` renders two loading skeletons with `style={{ width: "80%", height: "24px" }}` / `{ width: "60%", height: "24px" }`. Unlike C8's bars these are fully static, so they need no custom property — two modifier classes in the existing module file cover it. -- `src/components/features/PropertySearch/AnswerBox.tsx:11,12`

#### ~~L21: `composes` is accepted in plain stylesheets, where it is a silent no-op~~ [Done]
Applied the fix recorded below — the top-level `css.parser` block is gone and the setting now lives in an `overrides` entry scoped to `**/*.module.css`. Re-verified after the move: the four `sections/*.module.css` files still parse (`biome check` over that directory — 9 files, 0 errors), and a probe `.css` containing `composes` errors again with "`composes` declaration is not a standard CSS feature". No rationale comment in `biome.json` — Biome rejects unknown keys, including `comment`, and the file is `.json` not `.jsonc`.

**Original finding:**
`biome.json` sets `css.parser.cssModules: true` so the four `PropertyDetails/sections/*.module.css` files using `composes: base from "./SectionBase.module.css"` parse — before that they were unlintable and unformattable, and each produced two errors. The option is **global**, so `composes` is now also accepted in non-module stylesheets (`src/index.css`, `App.css`), where CSS Modules never processes it and the declaration does nothing at runtime. Biome will not flag that case. Purely permissive — it cannot reject anything that previously passed — but it is a real gap in lint coverage rather than a clean win.

**Fix is verified working** (tested 2026-08-08, not just read off the schema): move the setting out of the top-level `css` block into an `overrides` entry scoped to module files. Biome's `OverridePattern` supports `css.parser`, and with this in place the four `sections/*.module.css` files still parse (9 files, 0 errors) while a plain `.css` containing `composes` correctly errors again.
```json
"overrides": [
  { "includes": ["**/*.module.css"], "css": { "parser": { "cssModules": true } } }
]
```
-- `biome.json`

---

## Intentional Design Decisions

### M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data
**Status**: Intentional — DISPLAY_YEAR is deliberately pinned to 2025; not a bug. TCAD appraised values for 2026 are marked as "N/A" until published (expected April/May 2026).

---

**Latest migration**: August 6, 2026 audit and scripts-review items (AUD-01 through AUD-08, D1-01 through D1-03, TC-10 through TC-18, T1, T2, T4–T12) migrated to [changelog/2026-08-06.md](changelog/2026-08-06.md) — T3 remains open above
