# Search Strategy Optimization Recommendations

**Date**: 2025-11-07
**Current Database**: 286,035+ properties
**Analysis**: Based on actual performance data from completed searches

## Key Findings

### 1. Term Length Effectiveness (Sweet Spot: 4-6 Characters)
```
Length | Avg Properties | Analysis
-------|---------------|----------------------------------
4 chars|    637.7      | BEST - Short, common words/names
6 chars|    474.6      | EXCELLENT - Medium names
5 chars|    467.7      | EXCELLENT - Short names
9 chars|    408.9      | GOOD - Full street names
7+ chars|   <267       | DECLINING - Too specific
```

**Recommendation**: Focus 80% of searches on 4-6 character terms.

### 2. Pattern Type Performance

**Current Winners**:
- ✅ **Single Capitalized Words**: 636 unique terms → 271,217 properties (avg 426.4 each)
  - Examples: Avenue (20,541), Hill (6,165), Manor (5,091)
- ✅ **Street Suffixes**: Boulevard, Avenue, Court, Ridge, etc.
- ✅ **Common Names**: Michael, Thomas, Smith, Rodriguez
- ✅ **Geographic Terms**: Lake, River, Hill, Ridge, Cave

**Current Losers**:
- ❌ Business Entities (LLC/Inc): Only 2.8 avg properties per term
- ❌ Acronyms: Only 1 property average
- ❌ Two-word combinations: Only 55.3 avg (except street names)

### 3. Top 30 Most Productive Terms (Already Run)
1. Avenue → 20,541 properties
2. Boulevard → 7,796
3. Hill → 6,165
4. Court → 6,028
5. Manor → 5,091
6. Michael → 4,903
7. Thomas → 4,644
8. Paul → 4,584
9. Trust → 3,648
10. Travis → 3,309

*[Full list in query results]*

## Optimization Strategies

### Strategy 1: Expand High-Performing Categories

#### A. More Street Suffixes (Current: Limited coverage)
**Add**:
- `Drive` (not just "Dr")
- `Lane` (not just "Ln")
- `Circle`, `Cir`
- `Place`, `Pl`
- `Way`
- `Trail`, `Trl`
- `Path`, `Pass`
- `Bend`, `Loop`
- `Terrace`, `Pkwy`

**Expected**: 15,000-25,000 additional properties

#### B. More 4-Letter Geographic Terms
**Current winners**: Hill, Lake, Cave, West, Rose, Rich
**Add**:
- `Park`, `Glen`, `Dale`, `Ford`
- `Cove`, `Pine`, `Creek` (5-letter but proven)
- `Rock`, `Wood`, `Farm`, `Mill`
- `Pond`, `Peak`, `Knol`

**Expected**: 8,000-12,000 additional properties

#### C. First Names (Underutilized)
**Current**: Michael (4,903), Thomas (4,644), Paul (4,584), Joseph (2,193)
**Top 20 US first names NOT yet tried**:
- James, John, Robert, William, David, Richard
- Mary, Patricia, Jennifer, Linda, Elizabeth, Barbara
- Daniel, Charles, Christopher, Matthew, Donald, Mark

**Expected**: 40,000-60,000 additional properties

#### D. More Hispanic/Asian Surnames (Growing populations)
**Current leaders**: Rodriguez (2,719), Martinez (2,351), Tran (1,996), Nguyen (1,988)
**Add**:
- Garcia, Hernandez, Lopez, Gonzalez, Perez, Sanchez
- Lee, Chen, Wang, Kim, Patel, Singh

**Expected**: 15,000-25,000 additional properties

### Strategy 2: Optimize Weights Based on Real Data

**Current Weights**:
```typescript
{ fn: () => this.generateLastNameOnly(), weight: 70 },      // 426.4 avg
{ fn: () => this.generateStreetNameOnly(), weight: 40 },    // Currently underperforming
{ fn: () => this.generateNeighborhood(), weight: 20 },
{ fn: () => this.generateBusinessName(), weight: 20 },      // Only 2.8 avg!
{ fn: () => this.generatePropertyType(), weight: 40 },
```

**Recommended New Weights**:
```typescript
{ fn: () => this.generateLastNameOnly(), weight: 50 },      // Reduce slightly, most exhausted
{ fn: () => this.generateFirstNameOnly(), weight: 30 },     // NEW - very high yield
{ fn: () => this.generateStreetSuffix(), weight: 35 },      // NEW - proven 637+ avg
{ fn: () => this.generateGeographicTerm(), weight: 25 },    // NEW - 4-letter terms
{ fn: () => this.generateNeighborhood(), weight: 20 },      // Keep as-is
{ fn: () => this.generatePropertyType(), weight: 15 },      // Reduce
{ fn: () => this.generateHispanicSurname(), weight: 15 },   // NEW - growing market
{ fn: () => this.generateBusinessName(), weight: 5 },       // REDUCE - poor performance
```

### Strategy 3: Priority Queue System

Implement a priority scoring system for new searches:

```typescript
function calculateTermPriority(term: string): number {
  let score = 100;

  // Length bonus (4-6 chars is sweet spot)
  const len = term.length;
  if (len >= 4 && len <= 6) score += 50;
  else if (len >= 7 && len <= 9) score += 25;
  else score -= 25;

  // Pattern bonuses
  if (/^[A-Z][a-z]{3,5}$/.test(term)) score += 40;  // Single cap word
  if (/Avenue|Boulevard|Court|Ridge|Hill|Manor|Lake|River/i.test(term)) score += 60;
  if (/^(James|John|Robert|William|David|Michael|Mary|Patricia)$/.test(term)) score += 55;

  // Penalties
  if (/LLC|Inc|Ltd|Corp/.test(term)) score -= 70;  // Business entities
  if (/\d/.test(term)) score -= 50;  // Contains numbers
  if (/ /.test(term) && !/Avenue|Boulevard|Street/.test(term)) score -= 30;  // Two words (except streets)

  return score;
}
```

### Strategy 4: City-Specific Targeting

**Problem**: 157,157 properties (55%) have NULL city
**Solution**: Target city-specific search terms

**Austin-specific high-value terms**:
- `Barton`, `Zilker`, `Mopac`, `Capital`
- `Shoal`, `Balcones`, `Mueller`

**Pflugerville/Manor**: Focus on newer developments
**Lakeway/Bee Cave**: Focus on "Lake", "Hills", "Estates"

Expected: Better city coverage, reduce NULLs to <30%

### Strategy 5: Avoid Duplicate Coverage

**Current Issue**: Many properties found via multiple search terms
**Solution**: Track term similarity and avoid:
- Plural/singular overlaps (Hill vs Hills)
- Abbreviations already covered (Blvd vs Boulevard)
- Substring matches (Lake vs Lakeway)

Implementation:
```typescript
function isTermRedundant(newTerm: string, existingTerms: Set<string>): boolean {
  for (const existing of existingTerms) {
    if (newTerm.includes(existing) || existing.includes(newTerm)) return true;
    if (levenshteinDistance(newTerm, existing) < 2) return true;
  }
  return false;
}
```

## Expected Impact

### Conservative Estimates:
- **New First Names Strategy**: +40,000 properties
- **Street Suffixes Expansion**: +15,000 properties
- **Geographic Terms**: +10,000 properties
- **Hispanic/Asian Names**: +20,000 properties
- **Better Coverage, Less Redundancy**: -10% duplicate effort

**Total Expected**: 350,000-400,000 unique properties (vs current 286,035)

### Time to Completion:
- Current rate: ~700 properties/min (when token valid)
- Remaining target: ~114,000 properties to reach 400K
- Estimated time: ~3-4 hours of active scraping

## Implementation Priority

1. **HIGH**: Add first names generator (immediate 40K+ gain)
2. **HIGH**: Add street suffix generator (15K+ gain)
3. **MEDIUM**: Optimize weights based on real performance
4. **MEDIUM**: Add geographic terms generator
5. **LOW**: Implement priority scoring
6. **LOW**: Add redundancy detection

## Monitoring Recommendations

Track these metrics hourly:
```sql
-- Coverage by pattern type
-- Average properties per term by category
-- City distribution (reduce NULLs)
-- Duplicate detection rate
-- New vs repeat property finds
```
