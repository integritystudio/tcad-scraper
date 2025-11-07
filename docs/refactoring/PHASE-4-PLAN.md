# Phase 4: Test Cleanup and Consolidation - PLAN

**Start Date:** January 6, 2025
**Status:** In Progress

---

## Analysis Complete

### Current Test Structure

#### Jest Configurations (3 files - Needs consolidation)
```
/jest.config.cjs              → Server tests (server/src)
/jest.client.config.js        → Frontend tests (src/)
/jest.setup.js                → Client test setup
/server/jest.config.cjs       → DUPLICATE (remove)
```

#### Test Files
- **Frontend**: 2 test files in /src
- **Backend**: 8 test files in /server/src/__tests__/
  - integration.test.ts
  - security.test.ts
  - auth-database.connection.test.ts
  - auth-database.integration.test.ts
  - AUTH_DATABASE_TESTS.md (documentation)

#### Obsolete Test/Diagnostic Scripts (18 files to archive)

**Location**: `/server/src/scripts/`

**Diagnostic Scripts (3 files - ARCHIVE)**
```
diagnose-page.ts                 - Pagination debugging (issue resolved)
diagnose-pagination.ts           - Pagination debugging (issue resolved)
diagnose-results.ts              - Results debugging
```

**Test Scripts (15 files - KEEP 3, ARCHIVE 12)**

Keep (actively used in package.json):
```
test-api-token-config.ts        - Token configuration testing
test-queue-job-flow.ts          - Queue flow testing
test-token-refresh.ts           - Token refresh testing
```

Archive (obsolete or superseded):
```
test-ag-grid-data.ts            - AG Grid approach deprecated
test-api-scraper.ts             - Superseded by lib/tcad-scraper.ts
test-direct-api-bypass.ts       - API method now standard
test-fixed-scraper.ts           - Old scraper version
test-network-interception.ts    - Debugging tool
test-optimized-search.ts        - Testing completed
test-pagesize-limits.ts         - Pagination issue resolved
test-pagination.ts              - Pagination issue resolved
test-selectors.ts               - Selector testing complete
test-urls.ts                    - URL testing complete
queue-test-searches.ts          - One-off utility
test-db-save.ts                 - Database testing (moved to __tests__)
```

---

## Consolidation Plan

### Step 1: Remove Duplicate Jest Config ✅
- Delete `/server/jest.config.cjs` (exact duplicate of root config)
- Root `/jest.config.cjs` handles server tests
- Keep structure clean

### Step 2: Archive Obsolete Scripts
- Move 15 obsolete test/diagnostic scripts to archive
- Keep 3 active test scripts (used in package.json)
- Preserve git history

**Archive location**: `/server/scripts-archive/2025-01-phase4-tests/`

### Step 3: Update Documentation
- Create README in archive explaining what was removed
- Update main README test section
- Document which scripts are still active

### Step 4: Verify Tests
- Run `npm test` to ensure tests still pass
- Run `npm run test:coverage` to check coverage
- Verify archived scripts not referenced elsewhere

### Step 5: Update Package.json (if needed)
- Ensure test scripts still work
- Remove any references to archived scripts
- Add any missing test convenience scripts

---

## Files to Keep (Production/Active)

### Test Configurations
```
/jest.config.cjs              - Server tests
/jest.client.config.js        - Frontend tests
/jest.setup.js                - Client setup
```

### Test Files
```
/server/src/__tests__/        - All integration/unit tests (keep all)
```

### Active Test Scripts
```
/server/src/scripts/test-api-token-config.ts
/server/src/scripts/test-queue-job-flow.ts
/server/src/scripts/test-token-refresh.ts
```

### Production Scripts (Not tests)
```
/server/src/scripts/batch-scrape.ts
/server/src/scripts/continuous-batch-scraper.ts
/server/src/scripts/worker.ts
```

---

## Files to Archive

### Archive: Obsolete Test Scripts
```
server/scripts-archive/2025-01-phase4-tests/
├── README.md
├── diagnose-page.ts
├── diagnose-pagination.ts
├── diagnose-results.ts
├── queue-test-searches.ts
├── test-ag-grid-data.ts
├── test-api-scraper.ts
├── test-db-save.ts
├── test-direct-api-bypass.ts
├── test-fixed-scraper.ts
├── test-network-interception.ts
├── test-optimized-search.ts
├── test-pagesize-limits.ts
├── test-pagination.ts
├── test-selectors.ts
└── test-urls.ts
```

### Delete: Duplicate Config
```
/server/jest.config.cjs       - Exact duplicate of root config
```

---

## Success Criteria

✅ **Jest configurations consolidated** (3 configs, no duplicates)
✅ **Obsolete tests archived** (15 scripts moved)
✅ **Documentation updated** (Archive README, main README)
✅ **All tests still pass** (`npm test` succeeds)
✅ **Test coverage maintained** (or improved)
✅ **Package.json scripts work** (no broken references)

---

## Benefits

- **Cleaner structure**: No duplicate configs, clear test organization
- **Reduced clutter**: 15 obsolete scripts archived
- **Better discoverability**: Clear which tests are active
- **Easier maintenance**: Single config per test type
- **Preserved history**: All scripts in git and archive

---

## Risk Assessment

**Risk Level**: LOW

- Only removing duplicates and archiving obsolete scripts
- Active tests preserved
- Git history maintained
- Easy rollback if needed

---

**Next**: Execute consolidation steps
