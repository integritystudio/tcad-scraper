# 2025 TCAD Backfill - Quick Reference

**Generated**: 2026-03-30 | **Updated**: 2026-08-06
**Target**: 500K properties (currently ~2)  
**Strategy**: Phased 3-tier non-overlapping search terms

> **Note on first-name strategy**: `docs/search_results.md` (2026-03-20, pre-D1) concluded
> "skip common first names." That analysis used the legacy PostgreSQL dataset and is superseded
> by this document. The post-D1 backfill data (2026-03-30) shows first names form the highest-
> yield Tier 1 terms (David: 8,660; Robert: 6,628; etc.). `search_results.md` is retained as
> historical reference only.

## Tier 1: Immediate (15 terms)
**Coverage**: 71,626 properties (19.6%)  
**Duration**: 4-6 hours  
**API Calls**: 120-150  
**Success Rate**: 85%

```bash
# scripts/enqueue-terms.ts was deleted (BullMQ removal). Use the Workers API directly:
for term in David Robert LIVING Home Fami James steph Paul eliza Rich Mark estat Christopher Martin Thomas; do
  doppler run -p integrity-studio -c prd -- sh -c \
    "curl -s -X POST https://api.alephatx.info/api/properties/scrape \
      -H 'Content-Type: application/json' \
      -H \"x-api-key: \$TCAD_API_KEY\" \
      -d \"{\\\"searchTerm\\\": \\\"$term\\\"}\" | jq -r '.message // .error'"
  sleep 1
done
```

**Top 3 Terms**:
1. David - 8,660 properties
2. Robert - 6,628 properties
3. LIVING - 5,760 properties (Trust entity type)

## Tier 2: Extended (35 additional terms)
**Coverage**: +93,268 properties (total 45.1%)  
**Duration**: 1-2 weeks  
**API Calls**: 230-300  
**Success Rate**: 80%

```bash
# Use the Workers API directly (scripts/enqueue-terms.ts was deleted):
for term in holdi Sand Maria Carl Rock Daniel Mary Wood marie Vista TEXAS Ridge Scott Angel CITY Green White VILLA JOSE West Michelle Matthew Susan Manor Assoc Pass Johnson Linda Jeffrey STATE Andrew laure Joseph Ranch Bend Garcia; do
  doppler run -p integrity-studio -c prd -- sh -c \
    "curl -s -X POST https://api.alephatx.info/api/properties/scrape \
      -H 'Content-Type: application/json' \
      -H \"x-api-key: \$TCAD_API_KEY\" \
      -d \"{\\\"searchTerm\\\": \\\"$term\\\"}\" | jq -r '.message // .error'"
  sleep 1
done
```

**Pattern**: First names + geographic subdivisions + entity types

## Tier 3: Comprehensive (150 terms)
**Coverage**: +171,473 properties (total 92.1%)  
**Duration**: 2-4 weeks  
**API Calls**: 1,800-2,300  
**Success Rate**: 75%

```bash
TCAD_YEAR=2025 doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue
```

## Key Metrics

| Metric | Target | Alert |
|--------|--------|-------|
| totalResults | ≥500 (T1), ≥100 (T2+) | <50 properties |
| successRate | ≥80% | <50% |
| avgResultsPerSearch | ≥500 (T1), ≥100 (T2+) | Low efficiency |
| totalSearches | 1-3 per term | >5 + declining |

## Checkpoints

After **Tier 1**: Expect ~71K properties → Proceed if ≥60K  
After **Tier 1+2**: Expect ~165K properties → Proceed if ≥150K  
After **Tier 1+2+3**: Expect ~336K properties → Consider Tier 4 if ≥330K

## Optimization Principles

- **Zero overlap** in Tier 1 (person names partition search space distinctly)
- **Density-ranked** (David 8,660 → Thomas 3,740, highest yield first)
- **Category diverse** (first names, last names, geographies, entity types)
- **API efficient** (100% success rate Tier 1, no wasted calls)

## Files

- **Full analysis**: `/docs/2025_BACKFILL_OPTIMIZATION.json`
- **Strategy details**: `/SEARCH_TERM_STRATEGY.md`
- **Ranked terms**: `/SEARCH_TERM_ANALYSIS.md`

## If Lagging

1. **Owner-name mining** (Phase 3):
   ```bash
   TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts --phase 3
   ```

2. **Unsearched 4-char prefixes**:
   ```bash
   TCAD_YEAR=2025 doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue
   ```

3. **Check API health**:
   ```bash
   cd workers/tcad-api && npx wrangler tail
   ```

## Validation

- All terms 4+ characters (TCAD API minimum)
- All commands use TCAD_YEAR=2025 for segregation
- Deduplicated against 8,385 existing searches
- Compatible with `/api/properties/scrape` endpoint
