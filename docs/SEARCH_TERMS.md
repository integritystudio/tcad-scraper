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
| XD, XG, XI, XJ, XL, XO, XR, XU, XV | Exempt (non-XB) | 16,325 | folded into `R` | — | — |
| | **Total** | **508,880** | | **484,245** | **24,635** |

**Only the 24,635 total is reliable — per-group gaps are not.** D1 stores TCAD's `prop_type` code (`R`/`P`/`MH`/`MN`), which is not a state category, so the rows above are matched by inspection. Exempt accounts in particular are **not** a missing group: they carry `prop_type = R` and are already being captured (2026-08-08: 912 properties with CHURCH in the owner name, 3,532 CITY OF AUSTIN, 122 ISD). Any per-category gap analysis needs a real category field, which the scraper does not currently store.

What the term waves have established about the remainder:
- **Exempt/religious/government terms are saturated, not untried.** A 2026-08-08 wave found 47 of 78 candidates already searched, with the core ones at or near zero (`chur` 0, `bapt` 0, `epis` 0, `cath` 12, `meth` 4).
- **Personal property is over the certified count** (39,195 vs 37,502), so BPP-oriented terms are exhausted — a 48-term business-word wave returned 331 total.
- **Utilities/minerals (350 accounts) are the one clearly under-covered group**, but too small to matter.
- Residential 4-char prefixes decayed 37 → 19 → 7.4 → 1.5 properties/term across four waves of increasing size; the space is effectively mined out.

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

## 2026-08-08 Saturation Campaign (465,863 → 484,251, +18,388)

Ten waves in one session. Read this before proposing a new term family — most of the obvious ones are now measured, not hypothetical.

| Wave | Terms | Saved | Avg/term | Notes |
|---|---:|---:|---:|---|
| Mined names + streets | 62 | 1,268 | 20 | incl. 5 April-2026 failures retried after the D1 bugs were fixed |
| Prefixes + BPP words + streets | 103 | 2,287 | 22 | 4-char prefixes carried it (92/term); BPP words 7/term |
| 4-char prefixes, vol ≥880 | 79 | 2,901 | 37 | first-name prefixes dominate (kris 202, eric 135) |
| 4-char prefixes, vol 325–887 | 200 | 3,715 | 19 | |
| 4-char prefixes, vol 178–349 | 400 | 2,978 | 7.4 | winners shift to specialty vocab (venk, srin, yaup) |
| 4-char prefixes, vol 50–177 | 1,927 | 2,944 | 1.5 | **floor reached** |
| Numbered streets `[E\|W ]<1-55> ST` | 165 | 1,163 | 7 | downtown core best (1 ST 87, E 6 ST 62) |
| Ordinal streets `[N\|S\|E\|W ]1st–55th` | 261 | 43 | 0.2 | near-total bust — see tokenization note below |
| FM/RM route grid | 72 | 0 | 0 | generic `F M RD` (162) had already subsumed all of them |
| Exempt/religious/government | 34 | 6 | 0.2 | 47 of 78 candidates were already searched |

**The 4-char prefix space is mined out.** Yield decayed 37 → 19 → 7.4 → 1.5 per term as the volume band dropped. ~25,500 unsearched prefixes remain below volume 50, but 16,794 of them appear 1–4 times in 484K records (typos, OCR noise); a full sweep is tens of thousands of jobs for maybe 1–2K properties.

**Address-form findings** (all verified 2026-08-08, details in [CLAUDE.md](../CLAUDE.md#architecture-decisions)):
- TCAD stores numbered streets as `<N> ST`, **not** ordinals — `1 ST` → 2,636 matches vs `South 1st` → 19. Directional variants are subsets of the bare form.
- Multi-word queries match terms independently, so a generic multi-word term subsumes every specific one. Run specific before generic.
- Hyphens are part of the token: `mo-pac` 966 matches, `mopa` 46.
- Highways are `HY` (5,860 addresses) not `HWY`/`HIGHWAY`; interstates `IH`. `HY 35` → 2,169 matches, 0 new.
- Legal-description vocabulary is unreachable — the API searches owner name + address only. `LOT 1` → 20 matches against 15,468 matching descriptions in D1; `SEC 5` → 0; `Condo` → 407.

**What is left.** No measured theory for the remaining ~24,600. Exempt property is already captured (it lands in `prop_type = R`), BPP is over the certified count, and utilities/minerals is only 350 accounts. Since the API exposes no state category, reconciling per-category needs TCAD's certified roll export or a richer detail endpoint — not more search terms.

## Covering a New Roll Year — Greedy Maximum Coverage

The tier tables above describe how 2025 was actually filled: ~3,354 distinct
terms, discovered incrementally, most of them re-returning properties an
earlier term had already saved. Starting a *fresh* year does not have to
repeat that. `scripts/optimize-coverage.ts` treats it as a maximum-coverage
problem — model TCAD's matcher over the most complete year already in D1, then
repeatedly pick the term matching the most **not-yet-covered** properties.

Measured for 2026 on 2026-08-08 (model corpus: 484,251 rows for 2025, 23,246
candidate 4-char prefixes, 298 rows unreachable by any 4-char term):

| Coverage of the modeled roll | Terms needed |
|---|---:|
| 50% | 54 |
| 75% | 167 |
| 90% | 444 |
| 95% | 787 |
| 96.6% (marginal gain < 25) | 1,022 |

So roughly a **3.3× reduction in scrapes** for equivalent coverage, and the
first 54 terms alone reach half the roll.

**Result of the actual run (2026-08-08):** all 1,022 terms enqueued, 1,025 jobs
completed, **477,745 properties** — 98.7% of what 2025 holds, for 30% of the
scrapes, and 93.9% of the 508,880 certified target. The plan slightly
*over*-delivered against its own model (predicted 467,621): the real roll
contains properties the 2025 corpus could not model, so terms matched wider
than simulated. Prediction tracked reality throughout — the first 20 terms were
modeled at 30.1% and returned 148,610 properties (29.2% of target).

The remaining ~31k is genuine long tail. Lower `--min-gain` to chase it, or
switch to `backfill-novel.ts` / `enqueue-tail-terms.ts --phase 3`, which mine
the 2025-to-2026 gap and can now see it.

Two caveats worth keeping straight:

- **Coverage is measured against the model, not the target year.** The roll
  moves a few percent year over year, so properties new to the target year are
  invisible to the plan by construction. The tail phases
  (`backfill-novel.ts`, `enqueue-tail-terms.ts --phase 3`) exist to find them,
  and they mine the *year gap*, which is only meaningful once the target has
  some data.
- **Do not gate a fresh year on `search_term_analytics`.** That table has no
  year column, so its zero-yield (`unsuccessful`) set reflects 2025 saturation
  and would exclude the densest 2026 vocabulary. Use
  `getYearZeroYieldTerms(year)`.

```bash
TCAD_YEAR=2026 doppler run -- npx tsx scripts/optimize-coverage.ts             # plan + curve, no writes
TCAD_YEAR=2026 doppler run -- npx tsx scripts/optimize-coverage.ts --enqueue   # run it, batched + drained
```

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
# Mines the gap between TCAD_YEAR and the most-populated other year in D1;
# useful once the target year has data, not before.
TCAD_YEAR=2026 doppler run -- npx tsx scripts/enqueue-tail-terms.ts --phase 3

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
