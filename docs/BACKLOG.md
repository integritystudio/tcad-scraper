# Backlog - Remaining Technical Debt

**Last Updated**: 2026-08-08 (T13, T14 implemented; T3 remains open below)
**Status**: 159 frontend + 85 scripts + 75 workers tests passing | TypeScript clean | Lint clean

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

#### M36: Search state loading flag cleared by stale request finalization
**Priority**: P1 | **Source**: code-review (2026-08-07)
In `usePropertySearch.ts:135`, the search() finally block unconditionally sets loading=false even when a newer call has aborted this one, causing stale request cleanup to clear the loading flag while an active request is still in flight. No guard compares searchAbortRef.current to the call's own controller before setLoading(false). Failure: user pauses typing (call A starts), types more before A resolves (call B aborts A), A's AbortError catches early but its finally still runs setLoading(false), flipping loading to false while B is in flight. -- `src/hooks/usePropertySearch.ts:135`

#### M37: Duplicate search POST from handleSearch bypassing lastSearchedRef guard
**Priority**: P1 | **Source**: code-review (2026-08-07)
In `SearchBox.tsx:26`, handleSearch() (Enter/click) never checks lastSearchedRef before calling onSearch despite a comment claiming the ref prevents duplicates. Failure: user types 'Oak Street', pauses so live-search debounce fires onSearch and sets lastSearchedRef; user then presses Enter/clicks Search on unchanged text — handleSearch fires onSearch again, producing duplicate POST to /properties/search plus duplicate analytics/Mixpanel events. Existing dedup tests only cover the reverse order. -- `src/components/features/PropertySearch/SearchBox.tsx:26`

#### M38: currentPage stale when results shrink for identical textual query
**Priority**: P1 | **Source**: code-review (2026-08-07)
In `SearchResults.tsx:154`, PaginatedResultsGrid resets currentPage only by remounting on key={searchQuery}; if results.length shrinks for a textually-identical query (e.g. via finding M37's duplicate search), no remount occurs and currentPage goes stale, stranding the user on a blank page. usePagination.ts never clamps currentPage against shrinking totalItems. -- `src/components/features/PropertySearch/SearchResults.tsx:154`

#### M39: PropertyDetails moved below toggle button, reversing UI control flow
**Priority**: P1 | **Source**: code-review (2026-08-07)
In `PropertyCard.tsx:49`, moving PropertyDetails into CardBody and the value-summary/ExpandButton into a sibling CardFooter reverses their visual order: the toggle button now renders below the panel it controls instead of above it, forcing users to scroll past all detail content to find the button that collapses it. -- `src/components/features/PropertySearch/PropertyCard.tsx:49`

#### M40: CardFooter CSS rule adds unrequested divider and spacing to card content
**Priority**: P1 | **Source**: code-review (2026-08-07)
In `PropertyCard.tsx:52`, wrapping the value-summary row in CardFooter pulls in Card.module.css's unconditional .footer rule (margin-top/padding-top/border-top), which neither PropertyCard.module.css nor AttributionCard.module.css overrides — adding an unrequested divider and spacing to every card. Same regression affects AttributionCard.tsx's CardFooter-wrapped action links. -- `src/components/features/PropertySearch/PropertyCard.tsx:52`, `src/components/layout/AttributionCard/AttributionCard.tsx`

#### M41: ValueComparison falsy-zero guard blocks assessedPercentage chart for zero values
**Priority**: P1 | **Source**: code-review (2026-08-07)
In `ValueComparison.tsx:19`, the difference memo's falsy-zero guard (if (!assessedValue) return null) treats assessedValue===0 as absent, blocking the assessedPercentage chart bar from rendering for that value (assessedValue is Float? with no floor in schema.prisma, realistic for a tax-exempt parcel), even though assessedPercentage's own guard was written to allow zero. -- `src/components/features/PropertySearch/PropertyDetails/components/ValueComparison.tsx:19`

#### M42: Pagination footer text implies incomplete result set is complete
**Priority**: P1 | **Source**: code-review (2026-08-07)
In `SearchResults.tsx:51`, the pagination footer text uses results.length instead of the totalResults prop, so for any query matching more than the fetch limit (default 50), the UI implies the fetched batch is the complete result set (e.g. 'Showing 49-50 of 50 results' when totalResults=3000). -- `src/components/features/PropertySearch/SearchResults.tsx:51`

#### M43: Overlapping CSS class specificity in AttributionCard layers defaults and custom styles
**Priority**: P2 | **Source**: code-review (2026-08-07)
In `AttributionCard.tsx:42`, swapping <aside className={styles.card}> for <Card className={styles.card}> layers Card.module.css's default .card class (white bg, 12px radius) alongside AttributionCard.module.css's .card (different bg, 0.5rem radius) at equal specificity, so the cascade winner depends on bundler emission order rather than explicit intent. -- `src/components/layout/AttributionCard/AttributionCard.tsx:42`

#### L19: Live-search debounce fires on every 1-2 character keystroke without minimum length
**Priority**: P2 | **Source**: code-review (2026-08-07)
In `SearchBox.tsx:42`, the live-search debounce has no minimum query length and only a single-value lastSearchedRef, so it fires a full AI-backed search (NL parse + D1 query) on every settled 1-2 character keystroke and can't detect an A->B->A edit pattern (e.g. correcting a typo back to a previous value re-runs an already-answered search). -- `src/components/features/PropertySearch/SearchBox.tsx:42`

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
