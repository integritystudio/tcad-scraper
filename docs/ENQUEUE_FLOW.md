# Search-Term Enqueue Data Flow

How a candidate search term gets from a backfill/generation script into D1 as
scraped property rows. Covers every script in `scripts/` that produces search
terms, the shared filtering/batching/draining pipeline in `scripts/lib/`, and
the Workers API → Queue → Workflow → D1 path on the receiving end.

Related docs: [`scripts/README.md`](../scripts/README.md) (per-script/per-file
reference), [`SEARCH_TERMS.md`](SEARCH_TERMS.md) (tier strategy + coverage
metrics), [`CLAUDE.md`](../CLAUDE.md) (architecture decisions).

---

## Term sources, split by whether they read the year gap

`scripts/lib/mine-year-terms.ts` mines properties present for the *source*
year with no counterpart in the *target* year. Every query it exports shares
this filter, with both years supplied by the caller:

```
FROM properties
WHERE year = <sourceYear>
AND property_id NOT IN (SELECT property_id FROM properties WHERE year = <targetYear>)
```

The target year is `TCAD_YEAR` (default 2025); the source year is resolved at
runtime by `resolveSourceYear()` as the most-populated *other* year in D1. The
direction therefore reverses on its own each roll season — 2026 seeded 2025's
backfill, and 2025 seeds 2026's. An empty target year is the normal starting
state, not a failure: the `NOT IN` matches nothing, so the candidate pool is
the whole source year, and it narrows to the real gap as the target fills.

```
┌─ GAP-REFERENCING ───────────────────────────────────────────────────────┐
│                                                                          │
│ backfill.ts → getTermsToBackfill()                                │
│   └─ raw SQL: properties WHERE year = <sourceYear>                     │
│               GROUP BY search_term ORDER BY cnt DESC LIMIT 300 (direct)│
│                                                                          │
│ backfill-proven.ts → getProvenTerms()                             │
│   └─ raw SQL: COUNT(DISTINCT property_id) per search_term,             │
│               sourceYear vs targetYear, direct comparison              │
│                                                                          │
│ backfill-unsearched.ts → getUnsearchedTerms()                     │
│   └─ mine-year-terms.ts: mineOwnerFirstWords, mineEntityPhrases,       │
│      mineStreetNames, mineTwoWordOwnerNames, mineDescriptionFirstWords │
│                                                                          │
│ backfill-novel.ts → getNovelTerms()                               │
│   └─ mine-year-terms.ts: mineOwnerFirstWords, mineStreetNames,         │
│      mineDescriptionFirstWords, mineTwoWordOwnerNames                  │
│                                                                          │
│ enqueue-tail-terms.ts → getTailTerms()  —  PHASE 3 ONLY                │
│   └─ mine-year-terms.ts: mineOwnerFirstWords, mineStreetNames          │
│      (Phases 1 & 2 of this same script do NOT read the gap —           │
│       see the other column)                                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─ NOT GAP-REFERENCING ─────────────────────────────────────────────────────┐
│  (static curated lists + year-agnostic search_term_analytics + pure gen)  │
│                                                                            │
│ enqueue-tail-terms.ts → getTailTerms()  —  PHASES 1 & 2                  │
│   └─ fetchAnalyticsTermsByYield()                                        │
│      SELECT search_term FROM search_term_analytics                      │
│      WHERE total_results > 0 ORDER BY total_results DESC                │
│      (no year filter — running per-term aggregate across all years)      │
│                                                                            │
│ generate-next-200-terms.ts → main()  —  ALL 5 TIERS                     │
│   Tier 1  CANDIDATE_FIRST_NAMES / CANDIDATE_LAST_NAMES                  │
│           (static curated lists — lib/terms/)                           │
│   Tier 2  CANDIDATE_GEOGRAPHIC / CANDIDATE_ENTITY                       │
│           (static curated lists — lib/terms/)                           │
│   Tier 3  searchTermAnalytics.findMany (avgResultsPerSearch,            │
│           successRate — no year filter)                                 │
│   Tier 4  searchTermAnalytics.findMany (totalSearches=1 rescrape —      │
│           no year filter)                                               │
│   Tier 5  generateCvcvBases() — pure generation, no DB query at all     │
│                                                                            │
│   ⟶ main() never touches the year gap, in any tier                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Filter → batch → enqueue → drain → D1

```
                    string[]  (from either column above)
                        │
                        ▼
┌─ FILTER — scripts/lib/searched-terms.ts + backfill-utils.ts ─────────────┐
│                                                                           │
│ getSearchedTermSets()                                                    │
│   → { allSearched, searchedForYear, successful, unsuccessful }             │
│ getBlacklistedTermSet()                                                  │
│   → zero-yield after 3+ searches                                         │
│                                                                           │
│ createTermCollector({ excluded, supersetsOf }).addTerm(term)            │
│   ├─ length < MIN_TERM_LENGTH (4)?           → reject                   │
│   ├─ in an excluded set / BLOCKED_TERMS?     → reject                   │
│   ├─ isSupersetOfAny(term, supersetsOf)?     → reject                   │
│   │     (TCAD search is prefix-based, so a term extending an            │
│   │      already-searched one can only return a subset)                 │
│   └─ else                                    → accept → result[]        │
│                                                                           │
└───────────────────────────────┬───────────────────────────────────────-─┘
                                 │  filtered string[]
                                 ▼
┌─ BATCH LOOP — scripts/lib/backfill-runner.ts: runBackfill(cfg) ──────────┐
│                                                                           │
│ while terms remain AND count < targetPropertyCount(year):              │
│   before = getPropertyCount(year)                                                │
│   batch  = terms.slice(i, i + BATCH_SIZE)        // BATCH_SIZE = 20     │
│     enqueue batch    ───────────────▶  (ENQUEUE, below)                 │
│     wait for drain   ───────────────▶  (DRAIN, below)                   │
│   after  = getPropertyCount(year);  gained = after - before                      │
│   gained == 0 for N consecutive batches (default 3; tail-terms/novel 5) │
│     → stop early                                                         │
│                                                                           │
└───────────────────┬───────────────────────────────┬─────────────────────┘
                     ▼ ENQUEUE                       ▼ DRAIN
┌─ scripts/lib/queue-utils.ts ─────┐   ┌─ scripts/lib/queue-utils.ts ──────┐
│ enqueueBatch(terms)               │   │ waitForQueueDrain(terms, at)      │
│                                    │   │                                    │
│ for term in terms:                │   │ every POLL_INTERVAL_MS (15s):     │
│   POST /api/properties/scrape     │   │   GET /api/properties/history     │
│     x-api-key: TCAD_API_KEY       │   │     ?limit=100&offset=N           │
│     body: {searchTerm: term}      │   │     (paginate newest-first        │
│   HTTP 2xx → enqueued[]           │   │      until cutoff hit)            │
│   else      → logged, dropped     │   │   terminal status + started       │
│                                    │   │     after enqueue cutoff          │
│                                    │   │     → mark term done              │
│                                    │   │   until pending == 0 or           │
│                                    │   │     DRAIN_TIMEOUT_MS (10m)        │
└─────────────────┬──────────────────┘   └───────────────────▲────────────-┘
                   │  HTTP                                    │ HTTP (poll)
                   ▼                                          │
┌─ CLOUDFLARE WORKERS API — Hono (workers/tcad-api/) ───────────────────────┐
│                                                                            │
│ POST /api/properties/scrape → insert scrape_jobs (status="pending")      │
│                              → send message to CF Queue "tcad-scraper-jobs"│
│ GET  /api/properties/history → read scrape_jobs (status, result_count)   │
│                                                                            │
│                    failed queue messages → DLQ "tcad-scraper-dlq"        │
└───────────────────────────────┬──────────────────────────────────────-──┘
                                 │  queue consumer trigger
                                 ▼
┌─ ScraperWorkflow — 5 steps (workflows/scraper.workflow.ts) ──────────────┐
│                                                                           │
│  scrape_jobs.status:  pending → processing → completed | failed         │
│                                                                           │
│  1. token      KV TOKEN_CACHE (bearer, ~5m TTL; cron auto-refresh)      │
│  2. fetch      TCAD_API_URL (pYear + fullTextSearch match, paginated)   │
│  3. dedup      drop rows already present for this property_id/year      │
│  4. upsert     raw D1 batch() INSERT…ON CONFLICT, micro-chunked         │
│                (6 rows × 15 cols, under D1's 100-param limit)           │
│  5. analytics  search_term_analytics.totalResults += newly-inserted     │
│                                                                           │
└───────────────────────────────┬──────────────────────────────────────-──┘
                                 ▼
┌─ D1 (tcad-db) ─────────────────────────────────────────────────────────-┐
│  properties              upserted rows, tagged year + search_term       │
│  scrape_jobs              status, result_count                          │
│  search_term_analytics    totalResults, successRate, avgResultsPerSearch│
└───────────────────────────────┬──────────────────────────────────────-──┘
                                 │
                                 │  getPropertyCount(year) / getSearchedTermSets()
                                 │  (via CLOUDFLARE_D1_TOKEN, HTTP)
                                 └──▶ loops back into the BATCH LOOP above
```

---

## Key takeaways

- **The script never writes to D1 directly.** Its only two live touchpoints
  are `POST /scrape` (enqueue) and `GET /history` (poll for drain), plus
  read-only D1 queries (via `CLOUDFLARE_D1_TOKEN`) to measure
  `getPropertyCount(year)` before/after each batch. All writes happen inside
  `ScraperWorkflow`.
- **`generate-next-200-terms.ts` never reads the year gap.** All five tiers
  draw from static curated lists, the year-agnostic `search_term_analytics`
  aggregate table, or pure CVCV generation.
- **`enqueue-tail-terms.ts` is mixed.** Phases 1 & 2 are year-agnostic
  (analytics only); Phase 3 calls the same `mine-year-terms.ts` miners as
  `backfill-unsearched.ts` / `backfill-novel.ts`, so only Phase 3 depends on
  another year being loaded.
- **`search_term_analytics` has no year column**, so its `total_results`
  counter aggregates every year ever scraped. It is a valid signal for
  TCAD-side abundance (`max_results`) but NOT for per-year saturation: on a
  fresh roll year the `unsuccessful` set flags the densest vocabulary as
  exhausted. Year-scoped saturation comes from `getYearZeroYieldTerms(year)`,
  which joins year-stamped `scrape_jobs` (migration 0005) against the year's
  attributed properties.
- **Prefix-based dedup throughout.** Because TCAD full-text search is
  prefix-matching, `isSupersetOfAny()` / `buildPrefixIndex()` skip any
  candidate that would only return a subset of an already-searched term's
  results.
