# TCAD Search Terms — Strategy & Operations

**Canonical search-term document.** Data file: [`2025_BACKFILL_OPTIMIZATION.json`](2025_BACKFILL_OPTIMIZATION.json) (per-term yields, tier arrays, validation checks).
**Last Updated**: 2026-08-08 | **Target**: 508,880 accounts — the 2025 certified roll (484,245 as of 2026-08-08, 95.2% — live count via `/health`)

Consolidates the former `SEARCH_TERM_STRATEGY.md`, `SEARCH_TERM_ANALYSIS.md`, `SEARCH_TERM_REFERENCE.txt`, `2025_BACKFILL_QUICK_REFERENCE.md`, and `search_results.md` (all deleted 2026-08-06; full versions in git history).

---

## Coverage Target — the 2025 Certified Roll

**508,880 accounts.** Source: TCAD [2025 Annual Report](https://traviscad.org/wp-content/uploads/2025-Annual-Report.pdf), "State Category Breakdown / Grand Totals" (2025 Adjusted Certified Totals, as of Roll #7) — the count column summed across all 34 state categories. The report prints value totals but no count total, so the figure is the sum of the per-category counts below.

**Do not use 488,000.** That number is from TCAD's press release [2025 Market Values On Their Way](https://traviscad.org/news/2025-market-values-on-their-way/) — *"appraisal notices are being mailed to more than 488,000 Travis County property owners"*. It counts **owners mailed a notice**, not accounts on the roll, and undercounts by ~21K.

| State categories | Group | Certified | In D1 (`prop_type`) | 2026-08-08 | Gap |
|---|---|---:|---|---:|---:|
| A, B, C1, D1, D2, E, F1, F2, O | Real property | 447,737 | `R` | 433,123 | 14,614 |
| L1, L2, S, XB, M2 | Personal property | 37,502 | `P` | 39,195 | −1,693 |
| M1 | Mobile homes | 11,937 | `MH` | 11,922 | 15 |
| G1, J1–J9 | Utilities & minerals | 350 | `MN` | 5 | 345 |
| XD, XG, XI, XJ, XL, XO, XR, XU, XV | Exempt (non-XB) | 16,325 | — | — | 16,325 |
| | **Total** | **508,880** | | **484,245** | **24,635** |

Reading the gap: two-thirds of it is **exempt property** (churches, private schools, charities, government-owned parcels) — a category no term wave has targeted. Utilities/minerals are near-untouched but tiny. Personal property is *over* the certified count, so BPP-oriented terms are exhausted; a 2026-08-08 wave of 48 business words returned 331 properties total for that reason. The `P`/`MH` groupings are approximate — D1's `prop_type` is TCAD's own code, not a state category, so the mapping is by inspection rather than definition.

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

**Tier 2** (maintenance mode, ranks 16-50):
holdi, Sand, Maria, Carl, Rock, Daniel, Mary, Wood, marie, Vista, TEXAS, Ridge, Scott, Angel, CITY, Green, White, VILLA, JOSE, West, Michelle, Matthew, Susan, Manor, Assoc, Pass, Johnson, Linda, Jeffrey, STATE, Andrew, laure, Joseph, Ranch, Bend

**Tier 3** (periodic deep backfills): ranks 51-200, starting at Garcia — full list with yields in the [data file](2025_BACKFILL_OPTIMIZATION.json). Note: the data file's `tier_2` array and `tier_2_weekly` command use an extended 49-term Tier 2 (ranks 16-64); the 35-term definition here is canonical.

**Tier 4**: extreme diminishing returns; skip unless targeting 100% coverage. Prefer algorithmic generation (owner-name mining) instead.

## Running the Backfill

Enqueue via the Workers API (`scripts/enqueue-terms.ts` was removed in the August 2026 scripts refactor, alongside the broader BullMQ/Express cleanup):

```bash
# Tier 1 (swap the term list for Tier 2)
# TCAD_API_KEY must match the Worker's API_KEY secret — as of 2026-08 that is the dev-config value (prd's returns 401)
for term in David Robert LIVING Home Fami James steph Paul eliza Rich Mark estat Christopher Martin Thomas; do
  doppler run -- sh -c \
    "curl -s -X POST https://api.alephatx.info/api/properties/scrape \
      -H 'Content-Type: application/json' \
      -H \"x-api-key: \$TCAD_API_KEY\" \
      -d \"{\\\"searchTerm\\\": \\\"$term\\\"}\" | jq -r '.message // .error'"
  sleep 1
done

# Tier 3 / unsearched prefixes (enqueues via Workers API)
TCAD_YEAR=2025 doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue

# Owner-name mining when yield drops (Phase 3)
# NOTE: inert until 2026 data is loaded — Phase 3 mines 2026-only properties and D1 has only 2025 data (see BACKLOG T3)
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

**Automated pruning** (`getBlacklistedTermSet()` in `scripts/lib/searched-terms.ts`): hard-skip terms with a 0% success rate after 3+ searches (`BLACKLIST_MIN_SEARCHES`). There is no automated check on raw property count or on partial (e.g. <50%) success rates — the ≥80%/<50% row in the table above is a manual monitoring guideline, not an enforced threshold.

### Per-term yield with duplicates filtered out

`scrape_jobs.result_count` is the post-dedup count (ScraperWorkflow step 3 drops
properties already in D1 before upsert), so this ranks terms by genuinely-new
properties; `total_api_results` is the raw TCAD result count for contrast:

```sql
SELECT search_term,
       SUM(COALESCE(result_count, 0))      AS new_properties,
       SUM(COALESCE(total_api_results, 0)) AS api_results
FROM scrape_jobs
WHERE status = 'completed'
GROUP BY search_term
ORDER BY new_properties DESC
LIMIT 20;
```

The gap between the two columns is overlap with properties other terms already
found (2026-08-06 batch: ~40-60% new for most terms). `search_term_analytics.total_results`
mirrors the deduped count, not the raw one.

### Predicting yield for unsearched terms

TCAD `fullTextSearch` matches substrings, so a candidate term's match count
against rows already in D1 estimates its frequency in TCAD's full dataset
(one scan per ~25 terms):

```sql
SELECT SUM(CASE WHEN name LIKE '%Teve%' OR property_address LIKE '%Teve%' THEN 1 ELSE 0 END) AS teve,
       SUM(CASE WHEN name LIKE '%Susa%' OR property_address LIKE '%Susa%' THEN 1 ELSE 0 END) AS susa
       -- ... one SUM(CASE ...) column per candidate
FROM properties;
```

**Do NOT enqueue the top of this ranking as-is.** In-DB frequency measures two
opposing things at once: TCAD-side abundance AND how much of that abundance is
already captured. Measured 2026-08-06 (top 20 of 500 candidates enqueued by
raw rank): the #1 term `Teve` (2,678 in-DB matches ≈ Steve/Stevens) yielded 3
new properties — its matches were exactly the rows other terms already found —
while mid-band terms `Para` (264), `Lowe` (660), `Delo` (218) yielded 282, 212,
and 204. Extreme counts in either direction were busts (`Susa` 2,277 → 0;
`Fire` 380 → 0; `Lava` 322 → 0 — common-word noise).

Practical guidance: use the scan to drop zero/near-zero matchers, then prefer
the middle of the frequency band (~100–1,000 matches on a ~260K-row DB). A
better predictor would subtract matches already attributable to a searched
superstring/overlapping term before ranking — not yet implemented.

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
