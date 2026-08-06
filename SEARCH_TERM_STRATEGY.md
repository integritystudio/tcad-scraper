# TCAD Search Term Efficiency Strategy

## Executive Summary

Analyzed 313 search terms across 365,371 properties. Results show **significant concentration** with diminishing returns beyond top 200 terms.

## Key Findings

| Metric | Value |
|--------|-------|
| Total unique properties | 365,371 |
| Unique search terms | 313 |
| Top 50 terms coverage | 45.1% of DB |
| Top 100 terms coverage | 67.4% of DB |
| Top 200 terms coverage | 92.1% of DB |
| Remaining terms (213-313) | ~8% of DB |

## Critical Discovery

**Zero overlap detected among top 30 terms.** Each search term returns a distinct set of properties—this is extremely favorable for optimization. The search_term_analytics table shows that terms rarely return overlapping results.

## Recommended Core Strategy

### Tier 1: High-Efficiency Subset (15 terms → 19.6% coverage)
- David (8,660), Robert (6,628), LIVING (5,760), Home (5,318), Fami (4,700)
- James (4,586), steph (4,342), Paul (4,251), eliza (4,147), Rich (4,024)
- Mark (3,968), estat (3,935), Christopher (3,803), Martin (3,764), Thomas (3,740)
- **Use case**: Baseline scraping, fast validation, API efficiency testing
- **API calls**: ~150-200 searches with 100% success rate

### Tier 2: Extended Coverage (35 terms, ranks 16-50 → +25.5% incremental)
- holdi, Sand, Maria, Carl, Rock, Daniel, Mary, Wood, marie, Vista, TEXAS, Ridge, Scott, Angel, CITY
- Green, White, VILLA, JOSE, West, Michelle, Matthew, Susan, Manor, Assoc, Pass, Johnson, Linda, Jeffrey, STATE
- Andrew, laure, Joseph, Ranch, Bend, Garcia, Kevin, Springs, Edward, Oaks
- **Use case**: Maintenance mode, incremental updates, sustainable scraping schedule
- **Combined Tier 1+2**: 45.1% coverage

### Tier 3: Comprehensive Backfill (150 terms, ranks 51-200 → +47% incremental)
- Bell, Carol, Lopez, Lynn, Nguyen, Lamar, Taylor, Brian, BLUE, Eric, devel, Land, Steven, Patrick, ROSA, Group, Davis, Jennifer, EAST, Charles, patri, BARR, Rose, Kelly, Valley, Crest, Williams, Miller, kenne, Louis, Brown, Lisa, Smith, Del Valle, Rodriguez, George, SERIES, Stone, Rebecca, Hills, Jason, Parkway, and more
- **Use case**: Periodic deep backfills (weekly/monthly)
- **Combined Tier 1+2+3**: 92.1% coverage

### Tier 4: Tail Terms (113 terms, ranks 201+ → ~8% of DB)
- Increasingly rare/specific terms with low efficiency
- **Use case**: One-time historical backfills, algorithmic expansion
- **Strategy**: Consider skipping unless targeting complete 100% coverage

## Efficiency Metrics

### Top 50 by Results/Search (with 100% success rate)
Highest signal terms—every search succeeds:
1. John: 6,621 results/search
2. Fami: 4,531 results/search
3. Robert: 4,273 results/search
4. JOSE: 3,915 results/search
5. Mary: 3,604 results/search

These 50 terms have **zero failed searches** and highest results per API call.

## Actionable Recommendations

### Immediate (Production Optimization)
1. **Focus scraping** on Tier 1+2 (50 terms) for 45% DB coverage with minimal API waste
2. **Remove or deprioritize** terms with success rates < 50% or results/search < 10
3. **Batch Tier 2** into weekly scrapes to maintain freshness

### Short-term (1-2 months)
1. **Implement Tier 3** backfill (150 terms) on monthly cycle
2. **Monitor efficiency** metrics for terms showing declining success rates
3. **Test algorithmic generation** of new terms from property descriptions for remaining 8%

### Long-term (Optimization)
1. **Eliminate low-performers**: Terms with <10 properties after 2+ searches
2. **Expand algorithmically**: Mine owner names, street names, entity types from existing properties
3. **Target strategy**: Focus on Tier 1+2 for maintenance; use Tier 3 for periodic deep coverage

## Implementation Checkpoints

- **Tier 1 only**: Achieves 19.6% coverage, validates system health
- **Tier 1+2**: Achieves 45.1% coverage, establishes production baseline
- **Tier 1+2+3**: Achieves 92.1% coverage, comprehensive snapshot
- **All 313 terms**: Achieves 100% (theoretical), but Tier 4 has extreme diminishing returns

## API Call Estimates

| Tier | Terms | Estimated Calls | Success Rate | Est. Results |
|------|-------|-----------------|--------------|--------------|
| 1 | 15 | 120-150 | ~85% | 71,626 |
| 1+2 | 50 | 350-450 | ~80% | 164,894 |
| 1+2+3 | 200 | 1,800-2,300 | ~75% | 336,367 |
| All | 313 | 3,000+ | ~60% | 365,371 |

## Caveats

- Search term analytics table shows different results than actual property counts (suggests some re-scraping/updates happened)
- Actual property storage is single-search-term per property; overlap calculation shows ~0% (each property has exactly one search_term)
- Terms like "David", "Robert" etc. are person names that naturally partition the search space
- Entity terms ("Estate", "Trust", "Corp") have lower efficiency but broad relevance

## Files Generated

- `/SEARCH_TERM_ANALYSIS.md` — Full ranked table of all 313 terms
- `/SEARCH_TERM_STRATEGY.md` — This strategy document
