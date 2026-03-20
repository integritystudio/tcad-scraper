# Search Term Optimization Analysis

**Date**: 2026-03-20 | **Source**: `search_term_analytics` table (8,445 rows)

## Overview

Analysis of TCAD search term performance to minimize the number of API calls required to reach 500K properties. The previous session reached 464K with ~2,500 searches before a data loss incident. This plan targets the same coverage with ~400-500 optimized terms.

---

## Raw Data Summary

### Result Distribution

| Bucket | Terms | Total API Results |
|--------|-------|-------------------|
| 0 results | 3,413 | 0 |
| 1-10 | 1,973 | 8,556 |
| 11-50 | 1,009 | 23,581 |
| 51-100 | 313 | 24,044 |
| 101-500 | 954 | 252,598 |
| 501-1,000 | 324 | 225,505 |
| 1,001-5,000 | 326 | 687,834 |
| 5,000+ | 133 | 1,730,973 |

- **40% of terms (3,413) produce zero results** -- skip entirely
- **Top 133 terms** account for 59% of all API results
- **Top 459 terms** (Tiers 1-2) account for 82% of all API results

### Yield Tiers

| Tier | Results Range | Terms | Est. API Results | Avg/Term |
|------|--------------|-------|-----------------|----------|
| 1 | 5,000+ | 133 | 1,730,973 | 13,008 |
| 2 | 1,000-4,999 | 326 | 687,834 | 2,110 |
| 3 | 500-999 | 324 | 225,505 | 696 |
| 4 | 100-499 | 959 | 253,098 | 264 |
| 5 | 10-99 | 1,416 | 48,115 | 34 |
| 6 | 1-9 | 1,874 | 7,566 | 4 |

### Term Length vs Results

| Length | Terms | Avg Results | Total Results |
|--------|-------|-------------|---------------|
| 3 | 11 | 5,155 | 56,700 |
| 4 | 870 | 846 | 735,714 |
| 5 | 1,658 | 556 | 921,731 |
| 6 | 874 | 536 | 468,431 |
| 7 | 735 | 391 | 287,344 |
| 8 | 451 | 382 | 172,164 |
| 9 | 232 | 529 | 122,695 |
| 10 | 100 | 610 | 61,048 |
| 11 | 53 | 883 | 46,778 |
| 12+ | 48 | 1,673 | 80,486 |

Sweet spot: 4-6 character terms have the highest volume. 9-12 character terms (geographic names, compound terms) have high per-term yield.

---

## Overlap Analysis

### Substring Overlaps

Short, broad terms are supersets of many longer, more specific terms. Searching both wastes API calls.

| Parent Term | Results | Covered Children | Child Results |
|-------------|---------|-----------------|---------------|
| Trust | 60,179 | Family Trust, Revocable Trust, Trustee, Irrevocable Trust | 26,814 |
| John | 39,724 | Johnson, Johns | 7,345 |
| Way | 29,706 | Parkway, Lakeway, Wayne, Speedway, Conway | 17,810 |
| Lake | 27,028 | Lakeway, Westlake, Blake | 4,202 |
| TEXAS | 23,954 | Texas LLC | 155 |
| West | 23,952 | WESTERN, Westlake, West Lynn, SOUTHWEST | 1,271 |
| Fami | 23,946 | famil, Family Trust | 7,877 |
| pflug | 21,856 | Pflugerville | 48,838 |
| VALLE | 21,496 | Valley, VALLEJO | 12,338 |
| William | 20,573 | Williamson, Williams | 5,441 |
| Hill | 20,497 | hillc + other hill* prefixes | ~1,000 |

**Key insight**: Searching "Trust" already returns all results that "Family Trust", "Revocable Trust", etc. would return. The children are subsets, not additive.

**Exception**: "pflug" (21,856) vs "Pflugerville" (48,838) -- the longer term returns MORE results because TCAD full-text search may match differently. Prefer the longer, more specific geographic term in these cases.

### First Name Overlap Problem

Common first names produce massive API results but almost entirely overlap with last name searches:

| First Name | API Results |
|------------|-------------|
| John | 39,724 |
| Robert | 31,039 |
| James | 28,984 |
| Jose | 27,471 |
| Mary | 26,453 |
| William | 20,573 |
| Michael | 20,536 |
| Mark | 16,509 |
| Thomas | 16,399 |
| David | 15,493 |

The top 50 first names account for ~400K API results. However, every "John Smith" property is already captured by searching "Smith". **Searching first names after last names yields near-zero unique properties** -- observed yield was <1% in the previous session's later batches.

**Recommendation**: Skip all common first names. They are the single largest source of wasted API calls.

---

## Optimized Term Set

### Strategy

1. **Prioritize by category**, not raw result count
2. **Skip substring children** when the parent term is already searched
3. **Skip common first names** entirely (~50 terms, ~400K wasted API calls)
4. **Skip zero-result terms** (3,413 terms)
5. **Skip low-yield terms** (<10 results, 1,874 terms)

### Phase 1: High-Value Core Terms (~110 terms)

These terms should be searched first on a fresh database. Expected near-100% yield on first run.

**Entity Types (15 terms)**
Trust, LLC, Inc., Corp, Properties, Homes, Holdings, Estate, Investments, Partners, Association, L.L.C., LTD, l l p, Company

**Geographic - Cities/Areas (25 terms)**
Pflugerville, Leander, Lago Vista, Cedar Park, Bee Cave, Kyle, Manor, Georgetown, Round Rock, Lakeway, Dessau, Dripping Springs, Bastrop, Buda, Hutto, Del Valle, Wimberley, Spicewood, Elgin, Westlake, Jollyville, Rollingwood, Volente, Marble Falls, San Marcos

**Street Types/Names (20 terms)**
Boulevard, Court, Path, Circle, Point, River, Spring, Hills, Ranch, Barton, Parkway, Creek, Trail, Terrace, Meadow, Brook, Valley, Mount, Lane, Drive

**Top Last Names (50 terms)**
Smith, Johnson, Williams, Brown, Jones, Garcia, Miller, Davis, Rodriguez, Martinez, Wilson, Anderson, Taylor, Thomas, Hernandez, Moore, Martin, Jackson, Thompson, White, Lopez, Lee, Gonzalez, Harris, Clark, Lewis, Robinson, Walker, Young, Allen, King, Wright, Scott, Torres, Nguyen, Hill, Flores, Green, Adams, Nelson, Baker, Hall, Rivera, Campbell, Mitchell, Carter, Roberts, Phillips, Evans, Turner

### Phase 2: Extended Coverage (~200 terms)

After Phase 1 saturates, add these for incremental coverage.

**More Last Names (100 terms)**
Tier 2 surnames from `search_term_analytics` sorted by `total_results` DESC, excluding any already in Phase 1. Target surnames with 1,000-5,000 results.

**Entity Variants (15 terms)**
Property, Capital, Group, Development, Construction, Realty, Foundation, Ventures, Management, Enterprise, Apartments, Condominiums, Church, School, Storage

**Additional Geographic (20 terms)**
Brushy Creek, Onion Creek, Steiner Ranch, Anderson Mill, Wells Branch, Oak Hill, Barton Creek, Shady Hollow, Cherry Creek, Tarrytown, Hyde Park, Travis Heights, Zilker, Allandale, Crestview, Avery Ranch, Great Hills, South Congress, East Austin, Balcones

**Street Names (30 terms)**
Manchaca, Stassney, Rundberg, Cameron, Duval, Guadalupe, Riverside, Pleasant Valley, William Cannon, Shoal Creek, Bull Creek, Walnut Creek, Koenig, Springdale, Berkman, Chicon, Exposition, Spyglass, Barton Hills, Westover, Howard, Steck, Airport, Braker, Metric, Slaughter, Parmer, Research, Congress, Lamar

**Broad Coverage Terms (35 terms)**
TEXAS, West, EAST, SOUTH, North, CITY, Farm, STAR, Long, Manage, Group, Mill

### Phase 3: Long Tail (~200 terms)

Tier 3-4 terms (100-999 results each). Diminishing returns -- expect 5-15% yield. Only run if Phases 1-2 fall short of 500K.

---

## Projected Results

| Phase | Terms | Est. Unique Properties | Cumulative |
|-------|-------|----------------------|------------|
| 1 - Core | ~110 | 300,000-350,000 | 300-350K |
| 2 - Extended | ~200 | 80,000-120,000 | 400-450K |
| 3 - Long Tail | ~200 | 30,000-50,000 | 450-500K |
| **Total** | **~510** | **~500K** | |

### Efficiency Comparison

| Approach | Terms Needed | Est. API Calls | Properties |
|----------|-------------|----------------|------------|
| Previous (unoptimized) | ~2,500 | ~1.2M | 464K |
| Optimized (this plan) | ~500 | ~800K | 500K |
| Savings | **80% fewer terms** | **33% fewer API calls** | **+36K more** |

---

## Terms to Always Skip

1. **Zero-result terms** (3,413) -- confirmed no TCAD matches
2. **Common first names** (~50) -- near-complete overlap with last name results
3. **Substring children** when parent is searched (e.g., skip "Family Trust" if "Trust" is searched)
4. **Ultra-low yield** (<10 results, 1,874 terms) -- 7,566 total API results not worth the overhead
5. **Numeric-only terms** (e.g., "5400", "7200") -- 13% yield in previous session, mostly address overlaps
6. **Prefix fragments** (e.g., "pflug", "steph", "micha") -- parent term covers these

---

## Data Integrity Note

On 2026-03-20, the production database was wiped by `server/src/__tests__/api.test.ts` which runs `deleteMany({})` against whatever `DATABASE_URL` is configured. A safeguard (`isProductionDatabase()`) was added in commit `96ee731` to prevent this from recurring. The `search_term_analytics` table (8,445 rows) survived because it was not targeted by the test cleanup.
