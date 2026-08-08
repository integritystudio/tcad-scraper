# Truncated Response Terms

Search terms that failed with "Unexpected end of JSON input" from the TCAD API.

**Root cause**: NOT result set size. Tested by expanding "Wayg" into 20 five-letter
terms (Wayga–Waygt) on 2026-03-02 — all 20 failed with the same truncated JSON error.
The TCAD API itself returns malformed/truncated responses for these prefixes regardless
of specificity. Likely a server-side issue (e.g., timeout, encoding bug, or corrupt
data in matched records).

**Action**: These terms need a different scraping strategy — either response-stream
buffering or skipping until the TCAD API is fixed. Prefix expansion alone does NOT
resolve the issue.

**Last updated**: 2026-08-08 — documented `lane`, `aust`, `llc.`, which were added to
`TRUNCATION_BUG_ROOTS` in 54ef3f4 but never listed here (the code carried 16 roots
while this table showed 13). Previously 2026-08-07: added 9 roots found by
`backfill-2025.ts`'s `getSeedExpansions()`/`getDenseExpansions()` a-z prefix
expansion, reproducing the exact Wayg pattern (every letter of the root fails
identically). Roots below are hard-skipped in those functions via
`TRUNCATION_BUG_ROOTS` (`scripts/lib/terms/TRUNCATION_BUG_ROOTS.ts` — keep this
table and that set in sync).

| Term | Length | Status | Notes |
|------|--------|--------|-------|
| Belterra | 8 | blocked | Long term — not a size issue |
| Fiduciary | 9 | blocked | Long term — not a size issue |
| Lakeline Boulevard | 19 | blocked | Long term — not a size issue |
| LMTD | 4 | untested | Try 5-letter expansion, but may hit same API bug |
| Maple Run | 9 | blocked | Long term — not a size issue |
| Mesa Park | 9 | blocked | Long term — not a size issue |
| Nonprofit | 9 | blocked | Long term — not a size issue |
| Pemberton Heights | 17 | blocked | Long term — not a size issue |
| Residential Builders | 21 | blocked | Long term — not a size issue |
| Sendero Springs | 15 | blocked | Long term — not a size issue |
| Wayg | 4 | **tested** | 20/20 five-letter expansions failed — API-side bug |
| Wayh | 4 | untested | Likely same API bug as Wayg |
| Wayi | 4 | untested | Likely same API bug as Wayg |
| Wayj | 4 | untested | Likely same API bug as Wayg |
| Chri | 4 | **tested** | 9/9 attempted five-letter expansions failed (2026-08-07) |
| Cong | 4 | **tested** | 16/16 attempted five-letter expansions failed (2026-08-07) |
| Cree | 4 | **tested** | 19/19 attempted five-letter expansions failed (2026-08-07) |
| Davi | 4 | **tested** | 15/15 attempted five-letter expansions failed (2026-08-07) |
| Lama | 4 | **tested** | 17/17 attempted five-letter expansions failed (2026-08-07) |
| Laur | 4 | **tested** | 19/19 attempted five-letter expansions failed (2026-08-07) |
| Mana | 4 | **tested** | 11/11 attempted five-letter expansions failed (2026-08-07) |
| Nguy | 4 | **tested** | 22/22 attempted five-letter expansions failed (2026-08-07) |
| Trus | 4 | **tested** | 19/19 attempted five-letter expansions failed (2026-08-07) |
| Lane | 4 | blocked | Every search attempt failed (analytics: 1 search, 0 successful) |
| Aust | 4 | blocked | Every search attempt failed — so "Austin" itself is unsearchable, and city-wide sweeps are not a shortcut to coverage |
| LLC. | 4 | blocked | Every search attempt failed. Note `Inc.` works fine (20,348 matches), so the trailing period is not the cause |
