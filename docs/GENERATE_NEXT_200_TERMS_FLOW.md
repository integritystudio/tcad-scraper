# `generate-next-200-terms.ts main()` — Detailed Data Flow

Deep-dive into a single term source referenced from
[`ENQUEUE_FLOW.md`](ENQUEUE_FLOW.md) — the "NOT 2026-REFERENCING" column. This
covers everything inside `scripts/generate-next-200-terms.ts`: module-load
term-pool construction, the two gating functions (`addNewTerm`/`addRescrape`),
all five selection tiers, the yield-ranking pass, and the two output paths
(dry-run stdout vs. `--enqueue`).

Usage:
```
doppler run -- npx tsx scripts/generate-next-200-terms.ts             # dry run
doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue   # + POST
```

---

## Stage 0 — module load: build the candidate pools (runs once, before `main()`)

```
┌─ scripts/generate-next-200-terms.ts (top level) ─────────────────────────┐
│                                                                           │
│  usedLower = Set(BACKFILL_2025_STATIC_TERMS.map(toLowerCase))           │
│              (seeds the dedup set with the static backfill list, so     │
│               nothing below can re-select a term it already owns)       │
│                                                                           │
│  assignUnique(list):                                                    │
│    for term of list:                                                    │
│      if usedLower.has(term.toLowerCase()) → skip                        │
│      else → usedLower.add(lower); out.push(term)                        │
│    return out                          // first-list-wins across calls  │
│                                                                           │
│  CANDIDATE_FIRST_NAMES = assignUnique([...FIRST_NAMES_FEMALE,           │
│                                         ...FIRST_NAMES_MALE])           │
│  CANDIDATE_LAST_NAMES  = assignUnique(LAST_NAMES)                       │
│  CANDIDATE_GEOGRAPHIC  = assignUnique(STREET_GEOGRAPHIC)                │
│  CANDIDATE_ENTITY      = assignUnique(BUSINESS_ENTITY)                  │
│                                                                           │
│  (sources: lib/terms/FIRST_NAMES_FEMALE.ts, FIRST_NAMES_MALE.ts,        │
│   LAST_NAMES.ts, STREET_GEOGRAPHIC.ts, BUSINESS_ENTITY.ts — static      │
│   curated data files, no DB query)                                      │
│                                                                           │
│  These four exported consts are ALSO imported by                        │
│  scripts/utils/list-curated-terms.ts to build the dedup-invariant       │
│  inventory checked by curated-terms-dedup.test.ts.                      │
└───────────────────────────────┬───────────────────────────────────────-─┘
                                 ▼  feeds Tiers 1 & 2 below
```

---

## Stage 1 — `main(enqueueMode)` setup

```
┌─ main() entry ─────────────────────────────────────────────────────────┐
│                                                                          │
│  searched      = (await getSearchedTermSets()).allSearched              │
│                   (lib/searched-terms.ts — analytics + property         │
│                    searchTerm + recent jobs; failed-only terms excluded)│
│  blacklistSet  = await getBlacklistedTermSet()                          │
│                   (lib/searched-terms.ts — search_term_analytics rows   │
│                    with successRate=0 AND totalSearches>=3)             │
│                                                                          │
│  console.error(`Already searched: ${searched.size} | Blacklisted: ...`)│
│                                                                          │
│  selected    = []          // accumulator, capped at TARGET_TERM_COUNT │
│  selectedSet = Set()       // lower-cased, for O(1) in-run dedup       │
│  blacklistSkips = 0; prefixSkips = 0; multiWordSkips = 0  // counters  │
└───────────────────────────────┬────────────────────────────────────-───┘
                                 ▼
```

---

## Stage 2 — the two gating functions every tier funnels through

```
┌─ addNewTerm(term) — used by Tiers 1, 2, 3, 5 ─────────────────────────┐
│                                                                        │
│  selected.length >= TARGET_TERM_COUNT (200)? ─────────────▶ reject    │
│  !term or term.length < MIN_TERM_LENGTH (4)? ─────────────▶ reject    │
│  lower = term.toLowerCase()                                          │
│  BLOCKED_TERMS.has(lower)?           (hard skip: "trust", "street",  │
│                                        4-word entity terms, ...)  ───▶ reject │
│  searched.has(lower)?                (already searched, any year) ──▶ reject │
│  selectedSet.has(lower)?             (dup within this run)       ──▶ reject │
│  blacklistSet.has(lower)?  → blacklistSkips++             ─────────▶ reject │
│  hasSearchedWord(term)?    → multiWordSkips++                        │
│    (ANY word ≥4 chars in a multi-word term already searched          │
│     individually — e.g. "Homes Trust" skipped if "trust" was)   ────▶ reject │
│  isSupersetOfAny(lower, searched)?  → prefixSkips++                  │
│    (a shorter prefix (4+ chars) was already searched — TCAD search   │
│     is prefix-based, so this term's results are a strict subset) ───▶ reject │
│                                                                        │
│  else → selected.push(term); selectedSet.add(lower); return true     │
└────────────────────────────────────────────────────────────────────-─┘

┌─ addRescrape(term) — used by Tier 4 ONLY ─────────────────────────────┐
│                                                                        │
│  selected.length >= TARGET_TERM_COUNT (200)? ─────────────▶ reject    │
│  !term or term.length < MIN_TERM_LENGTH (4)? ─────────────▶ reject    │
│  BLOCKED_TERMS.has(lower)?                                 ─────────▶ reject │
│  blacklistSet.has(lower)?                                  ─────────▶ reject │
│  selectedSet.has(lower)?                                   ─────────▶ reject │
│                                                                        │
│  else → selected.push(term); selectedSet.add(lower); return true     │
│                                                                        │
│  ⚠ Deliberately skips the `searched` check, hasSearchedWord, AND     │
│    isSupersetOfAny — Tier 4's whole premise is RE-searching a term    │
│    that was already searched once and yielded well, so those three   │
│    checks (which all exist to reject already-searched terms) would   │
│    reject every candidate if applied here.                           │
└────────────────────────────────────────────────────────────────────-─┘
```

---

## Stage 3 — Tier 1: unsearched names

```
for name of CANDIDATE_FIRST_NAMES:  addNewTerm(name)
for name of CANDIDATE_LAST_NAMES:   addNewTerm(name)
console.error(`Tier 1 (unsearched names): ${tier1Count}`)
```
Pure in-memory loop over the two static pools from Stage 0 — no DB query.

## Stage 4 — Tier 2: unsearched geographic + entity terms

```
for term of CANDIDATE_GEOGRAPHIC:  addNewTerm(term)
for term of CANDIDATE_ENTITY:      addNewTerm(term)
console.error(`Tier 2 (geographic + entity): ${tier2Count}`)
```
Same shape as Tier 1, different static pools. Still no DB query.

## Stage 5 — Tier 3: prefix expansions of dense roots

```
┌─ query: prisma.searchTermAnalytics.findMany ─────────────────────────┐
│   WHERE avgResultsPerSearch >= 500                                    │
│     AND successRate >= 0.5                                            │
│     AND termLength <= 5                                               │
│   ORDER BY avgResultsPerSearch DESC                                   │
│   SELECT searchTerm                                                   │
│   (no year filter — search_term_analytics is a running aggregate)     │
└───────────────────────────────┬───────────────────────────────────-───┘
                                 ▼  denseTerms[]
for base of denseTerms:
  if selected.length >= 200: break
  for c in 'a'..'z'  (char codes 97-122):
    expanded = base.searchTerm + c
    addNewTerm(expanded)
    if selected.length >= 200: break
console.error(`Tier 3 (prefix expansions): ${tier3Count}`)
```
Each dense root (e.g. a 5-char high-yield term) is expanded by appending
every letter a-z, so a single root can contribute up to 26 candidates —
each one still passes through the full `addNewTerm` gate above (most get
rejected via `isSupersetOfAny` once the base itself is in `searched`... but
the *expanded* 6-char term is new, so it passes the prefix check against
the base and is evaluated against everything else in `searched`).

## Stage 6 — Tier 4: high-yield re-scrape candidates

```
┌─ query: prisma.searchTermAnalytics.findMany ─────────────────────────┐
│   WHERE totalSearches = 1                                             │
│     AND successRate = 1                                               │
│     AND avgResultsPerSearch >= 200                                    │
│   ORDER BY avgResultsPerSearch DESC                                   │
│   SELECT searchTerm, avgResultsPerSearch                              │
└───────────────────────────────┬───────────────────────────────────-───┘
                                 ▼  rescrape[]
for row of rescrape:  addRescrape(row.searchTerm)
console.error(`Tier 4 (re-scrape high-yield): ${tier4Count}`)
```
Targets terms searched exactly once, that succeeded every time, with a high
average yield — good candidates to run again in case TCAD has since added
more matching properties.

## Stage 7 — Tier 5: 4-char prefix gap fill

```
prefixes = generateCvcvBases()     // lib/cvcv.ts — all 11,025 consonant-
                                    // vowel-consonant-vowel 4-char bases
                                    // (21 consonants × 5 vowels × 21 × 5)
Fisher-Yates shuffle(prefixes)     // avoid alphabetical bias in output

for p of prefixes:
  if selected.length >= 200: break
  term = capitalize(p)             // e.g. "bafa" → "Bafa"
  addNewTerm(term)
console.error(`Tier 5 (4-char gap fill): ${tier5Count}`)
```
Pure generation — no DB query. Fills any remaining slots up to
`TARGET_TERM_COUNT` with never-tried 4-letter CVCV combinations once Tiers
1-4 are exhausted or capped.

---

## Stage 8 — yield ranking: `rankByPredictedYield(selected)`

```
┌─ scoreTermsByDbMatches(terms) ────────────────────────────────────────┐
│                                                                        │
│  for i in 0..terms.length step YIELD_SCORE_CHUNK_SIZE (25):           │
│    chunk = terms.slice(i, i+25)                                       │
│    cols  = chunk.map((t,j) =>                                         │
│      `SUM(CASE WHEN name LIKE '%${esc(t)}%' ESCAPE '\'                │
│             OR property_address LIKE '%${esc(t)}%' ESCAPE '\'         │
│             THEN 1 ELSE 0 END) AS c${j}`                              │
│    ).join(", ")                                                       │
│    [row] = $queryRawUnsafe(`SELECT ${cols} FROM properties`)          │
│    scores.set(t, Number(row[`c${j}`] ?? 0))  for each t in chunk      │
│                                                                        │
│  (esc() escapes quotes + LIKE wildcards — terms are internal,        │
│   curated/generated strings, not user input)                          │
│  → one query per 25 terms, each a single-row multi-SUM aggregate      │
│    over the full `properties` table (in-DB match count per term)      │
└───────────────────────────────┬──────────────────────────────────-────┘
                                 ▼  Map<term, matchCount>
┌─ band filter + sort ──────────────────────────────────────────────────┐
│                                                                        │
│  dbRows = prisma.property.count()                                     │
│  scale  = dbRows / YIELD_BAND_REF_DB_ROWS (260,000)                   │
│  low    = YIELD_BAND_LOW  (100)  * scale                              │
│  high   = YIELD_BAND_HIGH (1000) * scale                              │
│                                                                        │
│  kept = terms.filter(matchCount >= YIELD_MIN_MATCHES (5))             │
│    (drops near-zero matchers — they don't exist in TCAD either)       │
│                                                                        │
│  bandRank(n) = 0 if low <= n <= high   // mid-band = best             │
│                1 if n < low            // too rare                    │
│                2 if n > high           // already saturated/overlaps  │
│                                                                        │
│  kept.sort by (bandRank ASC, matchCount DESC)                         │
│    → mid-band terms first, highest-match-count within each band       │
│                                                                        │
│  console.error(`kept X/Y (dropped Z with <5 matches; band L-H         │
│                 on ${dbRows} rows)`)                                  │
└───────────────────────────────┬──────────────────────────────────-────┘
                                 ▼  ranked: string[]
```
Rationale (from the in-code comment, confirmed 2026-08-06): extremes are
busts — near-zero matchers barely exist in TCAD either, and very-high
matchers are already captured by overlapping terms already searched. Mid-band
terms yielded the best new-property rate in practice (e.g. "Teve": 2,678
in-DB matches → only 3 new; "Para": 264 matches → 282 new).

---

## Stage 9 — output

```
                     ranked: string[]
                          │
          ┌───────────────┴────────────────┐
          ▼ stdout (always)                 ▼ stderr (always, diagnostics)
  for term of ranked:                console.error(...) throughout:
    console.log(term)                  "Already searched: N | Blacklisted: N"
  (one term per line — the script's    "Tier 1 (unsearched names): N"
   actual output/return value; pipe-   "Tier 2 (geographic + entity): N"
   able to other tools when run        "Tier 3 (prefix expansions): N"
   without --enqueue)                  "Tier 4 (re-scrape high-yield): N"
                                        "Tier 5 (4-char gap fill): N"
                                        "Skipped: N blacklisted, N prefix
                                          overlap, N multi-word overlap"
                                        "Total: N terms"
                                        "kept X/Y ... band L-H on N rows"
```

## Stage 10 — `--enqueue` path (optional)

```
if enqueueMode && ranked.length > 0:
  console.error(`Enqueuing ${ranked.length} terms via Workers API...`)
  queued = await enqueueBatch(ranked)      // lib/queue-utils.ts
  console.error(`Enqueued ${queued.length} jobs`)
```
`enqueueBatch()` here is the same function used by the batch-loop pipeline in
[`ENQUEUE_FLOW.md`](ENQUEUE_FLOW.md) — one `POST /api/properties/scrape` per
term, no `waitForQueueDrain()` call (this script enqueues once and exits; it
does not loop batches or measure gained-property counts like
`runBackfillMain()`-based scripts do). From there the flow is identical to
the rest of `ENQUEUE_FLOW.md`: Workers API → `scrape_jobs` insert → CF Queue
→ `ScraperWorkflow` → D1.

---

## Key takeaways

- **Two-track gating.** `addNewTerm` (Tiers 1/2/3/5) rejects anything already
  searched, blacklisted, blocked, a multi-word overlap, or a prefix overlap.
  `addRescrape` (Tier 4 only) *deliberately* skips the searched/multi-word/
  prefix checks, because its entire purpose is re-running terms that were
  already searched once.
- **Only Tiers 3 and 4 touch the database during selection** — via
  `search_term_analytics`, not `properties`, and with no year filter. Tiers
  1, 2, and 5 are pure in-memory/generated. See
  [`ENQUEUE_FLOW.md`](ENQUEUE_FLOW.md) for why this whole script sits in the
  "not 2026-referencing" column.
- **Selection and ranking are separate passes.** All five tiers fill
  `selected[]` up to `TARGET_TERM_COUNT` (200) first; `rankByPredictedYield`
  then re-scores and reorders (and can drop) that whole set against live
  `properties` match counts — a term can survive tier selection and still be
  dropped here if it has fewer than `YIELD_MIN_MATCHES` (5) in-DB hits.
- **`--enqueue` is fire-and-forget**, unlike the `backfill-2025-*` scripts —
  no drain-wait, no before/after property-count comparison, no
  zero-yield-batch stopping condition.
