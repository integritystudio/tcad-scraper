# Backlog - Remaining Technical Debt

**Last Updated**: 2026-08-06 (scripts-review fixes committed and recorded in Done; T10–T12 added from remaining review findings)
**Status**: 130 frontend + 54 scripts + 26 workers tests passing | TypeScript clean | Lint clean

---
## Open Items

#### T3: Retire or activate 2026 mining strategy for backfill scripts
**Priority**: P3 | **Source**: scripts-review audit (2026-08-06)
All four `backfill-2025-*.ts` scripts and Phase 3 of `enqueue-tail-terms.ts` query "2026-only" properties via `mine-2026-terms.ts`, but D1 contains only 2025 data. Strategy is inert until 2026 scrape season begins. Decision: retire the code path (remove Phase 3 + related queries) or document expected activation date. -- `scripts/lib/mine-2026-terms.ts`, `scripts/enqueue-tail-terms.ts:87-98`, `scripts/backfill-2025*.ts`

#### T4: Consolidate curated-term-list definitions for single source of truth
**Priority**: P3 | **Source**: scripts-review audit (2026-08-06)
Curated 5-letter term lists are scattered and overlap: `scripts/generate-valid-5char-terms.ts` (four lists: female/male first names, last names, geographic/entity), `scripts/backfill-2025.ts` (STATIC_TERMS), `scripts/config/backfill-2025-source-terms.ts`, and `scripts/generate-next-200-terms.ts` (CANDIDATE_FIRST_NAMES, CANDIDATE_LAST_NAMES, CANDIDATE_GEOGRAPHIC, CANDIDATE_ENTITY). No canonical source or dedup invariant. Disjointness requirement already solved for fallback-terms ↔ batch-configs in commit 4c607d2; extend pattern to all curated lists. -- `scripts/generate-valid-5char-terms.ts`, `scripts/backfill-2025.ts`, `scripts/config/backfill-2025-source-terms.ts`, `scripts/generate-next-200-terms.ts:136-425`

---

## Done (2026-08-06)

#### T10: Validate `--limit` argument in queue-results.ts
Parse now falls back to the default of 20 on non-numeric input (`Number.isFinite` guard) and clamps to 1–100 (API max), with the bounds as named constants.

#### T11: Fix misleading `hasSearchedWord` docstring example
Example changed to `"Homes Trust"` (both words ≥ MIN_TERM_LENGTH) and a note added that words shorter than MIN_TERM_LENGTH (e.g. "LLC") are never checked.

#### T12: Fix multi-argument shebang in analyze-search-terms.ts
`#!/usr/bin/env npx tsx` → `#!/usr/bin/env tsx`, matching `analyze-failed-jobs.ts`. No other multi-argument shebangs remain in `scripts/`.

#### Scripts-review fixes (obvious-errors pass) — commits a020c75, 368589a, 704104a
Full-directory review of `scripts/` (schema fields verified against `schema.prisma`, typecheck, SQL-injection surfaces checked). Three findings fixed: guarded divide-by-zero `NaN%` in `analyze-failed-jobs.ts` error categories; aligned live query and fallback refresh command on `COUNT(DISTINCT property_id)` plus a one-shot fetch retry in `generate-build-constants.ts`; added `.catch` + exit 1 to `generate-valid-5char-terms.ts`. Remaining minor findings filed as T10–T12 (drain pagination finding was already T7).

#### T7: Fix waitForQueueDrain false timeouts under concurrent traffic — commit 0b99807
Replaced single-page `/history?limit=100` poll with paginated fetching. Each cycle iterates pages (offset-based) until all pending terms are found, a job older than the enqueue cutoff is reached, or `hasMore=false`. Added 2 new tests covering both behaviours.

#### T8: Remove dead BatchEnqueueConfig/BackfillConfig fields — commit 6f86d42
Dropped `batchName`, `emoji`, `userId`, `extraLogs` from `BatchEnqueueConfig` and `userId` from `BackfillConfig`. Cleaned up 19 batch entries in `batch-configs.ts`, 5 backfill script call sites, and the `backfill-runner.test.ts` fixture.

#### T1: Remove dead `_userId` parameter from `enqueueBatch()` — commit ed566ce
Removed the ignored `_userId` param; both call sites and 3 test files updated. `BackfillConfig.userId` left declared for T8 to remove with the other dead fields.

#### T2: Reconcile `TARGET_TERM_COUNT` naming (500 vs. 200) — commit d2a8d55
Restored `TARGET_TERM_COUNT` to 200 in `scripts/generate-next-200-terms.ts`, matching the script name, README, and CLAUDE.md.

#### T5: Update HARDCODED_FALLBACK_COUNT in CI fallback path — commit 3c8b1c0
Updated 170320 → 260_000 in `scripts/generate-build-constants.ts`; inline comment documents the refresh command.

#### T6: Re-run post-commit review of commit 54d4021 (dedup consolidation) — commit 30f8c36
Verification re-run confirmed deleting `scripts/lib/search-term-deduplicator.ts` lost no live filtering: all remaining guards (BLOCKED_TERMS, searched, selectedSet, blacklistSet, hasSearchedWord, isSupersetOfAny) present in `generate-next-200-terms.ts`. No code change required.

#### T9: Refresh stale test-count status in BACKLOG.md and CLAUDE.md — commits 6c78b90, a36be6f
Dropped the "680 legacy server tests" claim; scripts count 29 → 52, workers 16 → 26 across BACKLOG.md and CLAUDE.md.

---

## Intentional Design Decisions

### M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data
**Status**: Intentional — DISPLAY_YEAR is deliberately pinned to 2025; not a bug. TCAD appraised values for 2026 are marked as "N/A" until published (expected April/May 2026).

---

**Latest migration**: August 6, 2026 audit items (AUD-01 through AUD-08, D1-01 through D1-03, TC-10 through TC-18) migrated to [changelog/2026-08-06.md](changelog/2026-08-06.md)
