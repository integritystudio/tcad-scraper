# TCAD Search Terms — Strategy & Operations

**Canonical search-term document.** Data file: [`2025_BACKFILL_OPTIMIZATION.json`](2025_BACKFILL_OPTIMIZATION.json) (per-term yields, tier arrays, validation checks).
**Last Updated**: 2026-08-06 | **Target**: 500K properties (currently ~170K per `/health`)

Consolidates the former `SEARCH_TERM_STRATEGY.md`, `SEARCH_TERM_ANALYSIS.md`, `SEARCH_TERM_REFERENCE.txt`, `2025_BACKFILL_QUICK_REFERENCE.md`, and `search_results.md` (all deleted 2026-08-06; full versions in git history).

---

## Key Findings (2026-03-21 analysis, 365,371 properties / 313 terms)

| Metric | Value |
|--------|-------|
| Top 15 terms (Tier 1) coverage | 19.6% |
| Top 50 terms (Tier 1+2) coverage | 45.1% |
| Top 100 terms coverage | 67.4% |
| Top 200 terms (Tier 1+2+3) coverage | 92.1% |
| Remaining 113 tail terms | ~8% |

**Zero overlap among top terms** — each returns a distinct property set (properties store a single `search_term`), so tiers are additive. Terms are density-ranked, highest yield first.

## Tiers

| Tier | Terms | Coverage | Duration | API Calls | Success Rate |
|------|-------|----------|----------|-----------|--------------|
| 1 | 15 | 71,626 (19.6%) | 4-6 hours | 120-150 | 85% |
| 2 | +35 | +93,268 (45.1% cum.) | 1-2 weeks | 230-300 | 80% |
| 3 | +150 | +171,473 (92.1% cum.) | 2-4 weeks | 1,800-2,300 | 75% |
| 4 (tail) | 113 | ~8% | — | 3,000+ total | ~60% |

**Tier 1** (baseline / fast validation):
David (8,660), Robert (6,628), LIVING (5,760), Home (5,318), Fami (4,700), James (4,586), steph (4,342), Paul (4,251), eliza (4,147), Rich (4,024), Mark (3,968), estat (3,935), Christopher (3,803), Martin (3,764), Thomas (3,740)

**Tier 2** (maintenance mode):
holdi, Sand, Maria, Carl, Rock, Daniel, Mary, Wood, marie, Vista, TEXAS, Ridge, Scott, Angel, CITY, Green, White, VILLA, JOSE, West, Michelle, Matthew, Susan, Manor, Assoc, Pass, Johnson, Linda, Jeffrey, STATE, Andrew, laure, Joseph, Ranch, Bend, Garcia

**Tier 3** (periodic deep backfills): ranks 51-200 — full list with yields in the [data file](2025_BACKFILL_OPTIMIZATION.json).

**Tier 4**: extreme diminishing returns; skip unless targeting 100% coverage. Prefer algorithmic generation (owner-name mining) instead.

## Running the Backfill

Enqueue via the Workers API (`scripts/enqueue-terms.ts` was deleted with BullMQ):

```bash
# Tier 1 (swap the term list for Tier 2)
for term in David Robert LIVING Home Fami James steph Paul eliza Rich Mark estat Christopher Martin Thomas; do
  doppler run -p integrity-studio -c prd -- sh -c \
    "curl -s -X POST https://api.alephatx.info/api/properties/scrape \
      -H 'Content-Type: application/json' \
      -H \"x-api-key: \$TCAD_API_KEY\" \
      -d \"{\\\"searchTerm\\\": \\\"$term\\\"}\" | jq -r '.message // .error'"
  sleep 1
done

# Tier 3 / unsearched prefixes (enqueues via Workers API)
TCAD_YEAR=2025 doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue

# Owner-name mining when yield drops (Phase 3)
TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts --phase 3

# Health / monitoring
curl -s "https://api.alephatx.info/health" | jq
cd workers/tcad-api && npx wrangler tail
```

## Metrics & Checkpoints

| Metric | Target | Alert |
|--------|--------|-------|
| totalResults | ≥500 (T1), ≥100 (T2+) | <50 |
| successRate | ≥80% | <50% |
| avgResultsPerSearch | ≥500 (T1), ≥100 (T2+) | Low efficiency |
| totalSearches | 1-3 per term | >5 + declining |

Checkpoints: after Tier 1 expect ~71K (proceed if ≥60K); after Tier 1+2 ~165K (≥150K); after Tier 1+2+3 ~336K (consider Tier 4 if ≥330K).

Prune terms with <10 properties after 2+ searches or success rate <50%.

## Term Constraints (TCAD API)

- 4+ characters minimum; 4-6 char terms are the volume sweet spot
- Works: entity terms (Trust, LLC., Corp), single last names, street addresses, suburb/city names
- Does NOT work: ZIP codes, compound names, numeric-only terms
- Some terms trigger truncated JSON responses from TCAD (server-side bug) — see [`truncated-response-terms.md`](truncated-response-terms.md)

---

## Historical Appendix (pre-D1 analysis, 2026-03-20 — superseded)

An earlier analysis of the legacy PostgreSQL `search_term_analytics` table (8,445 rows) recommended **skipping common first names** as near-complete overlap with last-name searches. **The post-D1 backfill data disproved this**: first names are the highest-yield Tier 1 terms (David: 8,660; Robert: 6,628). The discrepancy: overlap was measured on raw API results, but properties are stored under a single search term, making tiers additive.

Findings from that analysis that remain valid:

- **~40% of historical terms (3,413) returned zero results** — skip entirely
- **Substring children waste calls** when the parent is searched (e.g. "Family Trust" ⊂ "Trust"; "Johnson" ⊂ "John" at the API level) — exception: longer geographic terms can return MORE ("Pflugerville" 48,838 vs "pflug" 21,856); prefer the specific geographic term
- **Ultra-low-yield terms** (<10 results) aren't worth the overhead
- **Numeric-only terms** yielded ~13%, mostly address overlaps

Context: on 2026-03-20 the production PostgreSQL database was wiped by a test running `deleteMany({})` against the configured `DATABASE_URL`; a `isProductionDatabase()` safeguard was added in commit `96ee731`. The full pre-D1 analysis is in git history (`docs/search_results.md`).
