# Backlog - Remaining Technical Debt

**Last Updated**: 2026-08-06 (docs/root audit; stale docs archived, dead code pruned)
**Status**: 130 frontend + 52 scripts + 26 workers tests passing | TypeScript clean | Lint clean

---
## Open Items

#### T1: Remove dead `_userId` parameter from `enqueueBatch()` — **Done** (commit ed566ce)
**Priority**: P2 | **Source**: scripts-review audit (2026-08-06)
Dead parameter in `scripts/lib/queue-utils.ts:130` — all callers thread `BackfillConfig.userId` through but the function ignores it. Requires refactor of `enqueueBatch()`, its two call sites (`scripts/lib/backfill-runner.ts:73` and `scripts/generate-next-200-terms.ts:615`), and tests in `scripts/lib/backfill-runner.test.ts`. -- `scripts/lib/queue-utils.ts:130`

#### T2: Reconcile `TARGET_TERM_COUNT` naming (500 vs. 200) — **Done** (commit d2a8d55)
**Priority**: P3 | **Source**: scripts-review audit (2026-08-06)
Script is named `generate-next-200-terms.ts` and README / CLAUDE.md document 200 terms, but the code defines `TARGET_TERM_COUNT = 500` at line 31. Decision needed: rename script to `-next-500-terms` or restore the constant to 200 to match the canonical sources. -- `scripts/generate-next-200-terms.ts:31`

#### T3: Retire or activate 2026 mining strategy for backfill scripts
**Priority**: P3 | **Source**: scripts-review audit (2026-08-06)
All four `backfill-2025-*.ts` scripts and Phase 3 of `enqueue-tail-terms.ts` query "2026-only" properties via `mine-2026-terms.ts`, but D1 contains only 2025 data. Strategy is inert until 2026 scrape season begins. Decision: retire the code path (remove Phase 3 + related queries) or document expected activation date. -- `scripts/lib/mine-2026-terms.ts`, `scripts/enqueue-tail-terms.ts:87-98`, `scripts/backfill-2025*.ts`

#### T4: Consolidate curated-term-list definitions for single source of truth
**Priority**: P3 | **Source**: scripts-review audit (2026-08-06)
Curated 5-letter term lists are scattered and overlap: `scripts/generate-valid-5char-terms.ts` (four lists: female/male first names, last names, geographic/entity), `scripts/backfill-2025.ts` (STATIC_TERMS), `scripts/config/backfill-2025-source-terms.ts`, and `scripts/generate-next-200-terms.ts` (CANDIDATE_FIRST_NAMES, CANDIDATE_LAST_NAMES, CANDIDATE_GEOGRAPHIC, CANDIDATE_ENTITY). No canonical source or dedup invariant. Disjointness requirement already solved for fallback-terms ↔ batch-configs in commit 4c607d2; extend pattern to all curated lists. -- `scripts/generate-valid-5char-terms.ts`, `scripts/backfill-2025.ts`, `scripts/config/backfill-2025-source-terms.ts`, `scripts/generate-next-200-terms.ts:136-425`

#### T5: Update HARDCODED_FALLBACK_COUNT in CI fallback path — **Done** (commit 3c8b1c0)
**Priority**: P3 | **Source**: scripts-review audit (2026-08-06)
Hardcoded value is 170320 (line 23) but actual D1 count is ~260K (35% undercount). This fallback is the expected path in GitHub Actions when `CLOUDFLARE_D1_TOKEN` is missing; CI understates property count in build-time constants. Update to current count and add a comment documenting how often it should be refreshed (and how to refresh it). -- `scripts/generate-build-constants.ts:23`

#### T6: Re-run post-commit review of commit 54d4021 (dedup consolidation) — **Done**
**Priority**: P2 | **Source**: scripts-review session (2026-08-06)
The code-reviewer agent died mid-verification before confirming the key claim: that deleting `scripts/lib/search-term-deduplicator.ts` lost no live filtering in `generate-next-200-terms.ts`. Remaining guards must be verified: BLOCKED_TERMS, searched, selectedSet, blacklistSet, hasSearchedWord, isSupersetOfAny. Compare against `git show 54d4021~1:scripts/lib/search-term-deduplicator.ts` to confirm all dedup logic is still present. -- `scripts/generate-next-200-terms.ts`

#### T7: Fix waitForQueueDrain false timeouts under concurrent traffic
**Priority**: P3 | **Source**: scripts-review session (2026-08-06)
`scripts/lib/queue-utils.ts` polls `/history?limit=100` every 15s; if more than 100 jobs reach terminal state between polls (e.g., two backfill scripts running concurrently), a batch term's job can scroll out of the window and never be observed, timing out after 10m despite completing. Mitigations: paginate /history, filter by startedAt, or match on batch's enqueue window server-side. -- `scripts/lib/queue-utils.ts`

#### T8: Remove dead BatchEnqueueConfig fields in queue-utils.ts
**Priority**: P3 | **Source**: scripts-review session (2026-08-06)
Fields `batchName`, `emoji`, `priority`, `extraLogs`, `userId` in `scripts/lib/queue-utils.ts` are unused since BullMQ removal. No enqueue pipeline consumes them; the type only shapes data-only entries in `scripts/config/batch-configs.ts`. Fold into or sequence with T1 (dead `_userId` param) for coordinated cleanup. -- `scripts/lib/queue-utils.ts`, `scripts/config/batch-configs.ts`

#### T9: Refresh stale test-count status in BACKLOG.md and CLAUDE.md — **Done** (commit 6c78b90)
**Priority**: P3 | **Source**: scripts-review session (2026-08-06)
BACKLOG.md header claims "680 legacy server tests passing" but server/ was removed August 2026. CLAUDE.md's testing line says "29 scripts tests" but the suite is now 52. Refresh both counts and drop the legacy-server claim. -- `docs/BACKLOG.md:4`, `CLAUDE.md:33`

---

## Intentional Design Decisions

### M35: Hardcoded DISPLAY_YEAR = 2025 hides 2026 data
**Status**: Intentional — DISPLAY_YEAR is deliberately pinned to 2025; not a bug. TCAD appraised values for 2026 are marked as "N/A" until published (expected April/May 2026).

---

**Latest migration**: August 6, 2026 audit items (AUD-01 through AUD-08, D1-01 through D1-03, TC-10 through TC-18) migrated to [changelog/2026-08-06.md](changelog/2026-08-06.md)
