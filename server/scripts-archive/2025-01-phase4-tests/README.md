# Phase 4: Archived Test and Diagnostic Scripts

**Archive Date**: January 6, 2025
**Reason**: Obsolete, superseded by better implementations, or debugging completed

---

## What Was Archived

This directory contains 15 test and diagnostic scripts that were used during development but are no longer needed in active codebase. All scripts are preserved in git history and this archive for reference.

---

## Archived Diagnostic Scripts (3 files)

### diagnose-page.ts
- **Purpose**: Diagnosed page rendering and scraping issues
- **Status**: Pagination issue resolved, no longer needed
- **Date**: November 2024

### diagnose-pagination.ts
- **Purpose**: Debugged pagination controls and behavior
- **Status**: Pagination issue resolved, no longer needed
- **Date**: November 2024

### diagnose-results.ts
- **Purpose**: Debugged result extraction and parsing
- **Status**: Results extraction working correctly
- **Date**: November 2024

---

## Archived Test Scripts (12 files)

### test-ag-grid-data.ts
- **Purpose**: Tested AG Grid data extraction approach
- **Status**: AG Grid approach deprecated in favor of API scraping
- **Superseded By**: API-based scraping in lib/tcad-scraper.ts

### test-api-scraper.ts
- **Purpose**: Early testing of API scraping approach
- **Status**: API scraping now standard, implemented in lib/tcad-scraper.ts
- **Superseded By**: lib/tcad-scraper.ts (production implementation)

### test-db-save.ts
- **Purpose**: Tested database saving functionality
- **Status**: Database integration complete, proper tests in __tests__/
- **Superseded By**: __tests__/integration.test.ts

### test-direct-api-bypass.ts
- **Purpose**: Tested direct API access without browser
- **Status**: API method now standard approach
- **Superseded By**: Standard API scraping implementation

### test-fixed-scraper.ts
- **Purpose**: Testing of fixed/improved scraper version
- **Status**: Improvements integrated into main scraper
- **Superseded By**: lib/tcad-scraper.ts

### test-network-interception.ts
- **Purpose**: Debugging network requests and responses
- **Status**: Network issues resolved
- **Date**: November 2024

### test-optimized-search.ts
- **Purpose**: Testing search optimizations
- **Status**: Optimizations integrated into production
- **Superseded By**: lib/tcad-scraper.ts

### test-pagesize-limits.ts
- **Purpose**: Testing pagination and page size limits
- **Status**: Pagination issue resolved
- **Date**: November 2024

### test-pagination.ts
- **Purpose**: Testing pagination controls
- **Status**: Pagination working correctly
- **Date**: November 2024

### test-selectors.ts
- **Purpose**: Testing CSS selectors for scraping
- **Status**: Selectors finalized and working
- **Date**: November 2024

### test-urls.ts
- **Purpose**: Testing URL construction and navigation
- **Status**: URL handling working correctly
- **Date**: November 2024

### queue-test-searches.ts
- **Purpose**: One-off utility for queuing test searches
- **Status**: Superseded by CLI tools
- **Superseded By**: npm run queue add-terms

---

## Active Test Scripts (Still in src/scripts/)

These scripts are still actively used and referenced in package.json:

```
src/scripts/test-api-token-config.ts   - Token configuration testing
src/scripts/test-queue-job-flow.ts     - Queue flow testing
src/scripts/test-token-refresh.ts      - Token refresh testing
```

**Package.json scripts:**
```json
{
  "test:token-config": "tsx src/scripts/test-api-token-config.ts",
  "test:queue-flow": "tsx src/scripts/test-queue-job-flow.ts",
  "test:token-refresh": "tsx src/scripts/test-token-refresh.ts"
}
```

---

## Production Scripts (Still in src/scripts/)

### Core Scraping
```
batch-scrape.ts                    - Manual batch scraping utility
continuous-batch-scraper.ts        - Automated continuous scraper (PRODUCTION)
worker.ts                          - Queue worker (PRODUCTION)
```

### Entity-Specific Batches
```
enqueue-*-batch.ts                 - Various entity type batch queueing scripts
```

### Batch Variants
```
batch-scrape-100.ts                - Batch scraper with specific size
batch-scrape-comprehensive.ts      - Comprehensive batch scraping
```

---

## Why These Scripts Were Archived

### 1. **Debugging Complete**
Scripts like `diagnose-pagination.ts` and `test-pagesize-limits.ts` were created to solve specific bugs. Once fixed, these became obsolete.

### 2. **Better Implementations Available**
Scripts like `test-api-scraper.ts` were prototypes. The final implementation in `lib/tcad-scraper.ts` replaced them.

### 3. **Superseded by CLI Tools**
Scripts like `queue-test-searches.ts` are now better handled by the consolidated CLI tools:
```bash
npm run queue add-terms <file>
```

### 4. **Proper Tests Exist**
Test scripts like `test-db-save.ts` were exploratory. Proper integration tests now exist in `__tests__/`.

---

## Restoration Procedure

If you need to restore any of these scripts:

### From Archive
```bash
cp scripts-archive/2025-01-phase4-tests/<script-name>.ts src/scripts/
```

### From Git History
```bash
git checkout <commit-hash> -- server/src/scripts/<script-name>.ts
```

### Find Commit
```bash
git log --all --full-history -- "server/src/scripts/test-*.ts"
```

---

## Impact of Archiving

### Before
- 18 test/diagnostic scripts cluttering src/scripts/
- Unclear which scripts were active vs obsolete
- Mixed production and testing code
- Hard to find what you need

### After
- 3 active test scripts (clearly identified)
- 21 production scripts
- Clean separation of concerns
- Easy to navigate

---

## Related Changes

### Phase 2 (Script Consolidation)
- 38 utility scripts → 4 CLI tools
- Located in: scripts-archive/2025-01-phase2-consolidation/

### Phase 3 (Type System)
- Shared types created
- Schema.org alignment

### Phase 4 (Test Cleanup) - This Archive
- 15 obsolete test/diagnostic scripts archived
- 1 duplicate Jest config removed
- Test structure clarified

---

## File List

**Total Archived**: 15 files

```
diagnose-page.ts
diagnose-pagination.ts
diagnose-results.ts
queue-test-searches.ts
test-ag-grid-data.ts
test-api-scraper.ts
test-db-save.ts
test-direct-api-bypass.ts
test-fixed-scraper.ts
test-network-interception.ts
test-optimized-search.ts
test-pagesize-limits.ts
test-pagination.ts
test-selectors.ts
test-urls.ts
```

---

**Archive Complete**: January 6, 2025
**Next Phase**: Ready for future refactoring phases if needed
