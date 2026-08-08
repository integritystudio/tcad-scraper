# Search-Term Enqueue Data Flow

How a candidate search term gets from a backfill/generation script into D1 as
scraped property rows. Covers every script in `scripts/` that produces search
terms, the shared filtering/batching/draining pipeline in `scripts/lib/`, and
the Workers API → Queue → Workflow → D1 path on the receiving end.

Related docs: [`scripts/README.md`](../scripts/README.md) (per-script/per-file
reference), [`SEARCH_TERMS.md`](SEARCH_TERMS.md) (tier strategy + coverage
metrics), [`CLAUDE.md`](../CLAUDE.md) (architecture decisions).

---

## Term sources, split by whether they read `year = 2026` D1 rows

`scripts/lib/mine-2026-terms.ts` mines properties present for `year = 2026`
with no `year = 2025` counterpart. Every query it exports shares this filter:

```
FROM properties
WHERE year = 2026
AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
```

**D1 currently holds only 2025 data** — every source below that depends on
this filter, or on a direct `year = 2026` query, returns **zero** candidates
until 2026 properties are actually scraped in.

```
┌─ 2026-REFERENCING ──────────────────────────────────────────────────────┐
│                                                                          │
│ backfill-2025.ts → getTermsToBackfill()                                │
│   └─ raw SQL: properties WHERE year = 2026                             │
│               GROUP BY search_term ORDER BY cnt DESC LIMIT 300 (direct)│
│                                                                          │
│ backfill-2025-proven.ts → getProvenTerms()                             │
│   └─ raw SQL: COUNT(DISTINCT property_id) per search_term,             │
│               year=2026 vs year=2025, direct comparison                │
│                                                                          │
│ backfill-2025-unsearched.ts → getUnsearchedTerms()                     │
│   └─ mine-2026-terms.ts: mineOwnerFirstWords, mineEntityPhrases,       │
│      mineStreetNames, mineTwoWordOwnerNames, mineDescriptionFirstWords │
│                                                                          │
│ backfill-2025-novel.ts → getNovelTerms()                               │
│   └─ mine-2026-terms.ts: mineOwnerFirstWords, mineStreetNames,         │
│      mineDescriptionFirstWords, mineTwoWordOwnerNames                  │
│                                                                          │
│ enqueue-tail-terms.ts → getTailTerms()  —  PHASE 3 ONLY                │
│   └─ mine-2026-terms.ts: mineOwnerFirstWords, mineStreetNames          │
│      (Phases 1 & 2 of this same script do NOT reference 2026 —         │
│       see the other column)                                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─ NOT 2026-REFERENCING ────────────────────────────────────────────────────┐
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
│   ⟶ main() never touches `WHERE year = 2026`, in any tier               │
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
│   → { allSearched, searched2025, successful, unsuccessful }             │
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
│ while terms remain AND count < TARGET_2025_PROPERTY_COUNT:              │
│   before = get2025Count()                                                │
│   batch  = terms.slice(i, i + BATCH_SIZE)        // BATCH_SIZE = 20     │
│     enqueue batch    ───────────────▶  (ENQUEUE, below)                 │
│     wait for drain   ───────────────▶  (DRAIN, below)                   │
│   after  = get2025Count();  gained = after - before                      │
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
                                 │  get2025Count() / getSearchedTermSets()
                                 │  (via CLOUDFLARE_D1_TOKEN, HTTP)
                                 └──▶ loops back into the BATCH LOOP above
```

---

## Key takeaways

- **The script never writes to D1 directly.** Its only two live touchpoints
  are `POST /scrape` (enqueue) and `GET /history` (poll for drain), plus
  read-only D1 queries (via `CLOUDFLARE_D1_TOKEN`) to measure
  `get2025Count()` before/after each batch. All writes happen inside
  `ScraperWorkflow`.
- **`generate-next-200-terms.ts` never references `year = 2026`.** All five
  tiers draw from static curated lists, the year-agnostic
  `search_term_analytics` aggregate table, or pure CVCV generation.
- **`enqueue-tail-terms.ts` is mixed.** Phases 1 & 2 are year-agnostic
  (analytics only); Phase 3 calls the same `mine-2026-terms.ts` miners as
  `backfill-2025-unsearched.ts` / `backfill-2025-novel.ts`, so only Phase 3
  inherits the "no 2026 data loaded yet" limitation.
- **Prefix-based dedup throughout.** Because TCAD full-text search is
  prefix-matching, `isSupersetOfAny()` / `buildPrefixIndex()` skip any
  candidate that would only return a subset of an already-searched term's
  results.
