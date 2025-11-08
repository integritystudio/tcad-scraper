# Test Coverage Improvement - Task List

**Last Updated**: 2025-11-08 14:30 CST (Session 3 Complete)
**Status**: Phase 3 Complete ✅ - Moving to Phase 4
**Current Coverage**: 51.72% (Target: 70%)

---

## Progress Tracker

| Phase | Target Coverage | Status | Tests Added | Time Spent |
|-------|----------------|--------|-------------|------------|
| Phase 1 | 11-15% | ✅ Complete | 84 tests | 3 hours |
| Phase 2 | 22-25% | ✅ Complete | 65 tests | 3 hours |
| Phase 3 | 50-55% | ✅ Complete | 58 tests | 2 hours |
| Phase 4 | 60-70% | 🔶 Next Up | 0 tests | 0 hours |
| Phase 5 | 70%+ | ⬜ Not Started | 0 tests | 0 hours |

**Current**: 51.72% coverage (+29.16 from Session 3 start!)
**Next Milestone**: 60-70% coverage (Service Layer Testing)
**MAJOR MILESTONE**: >50% coverage achieved! 🎉

---

## Phase 1: Foundation & Quick Wins ✅ COMPLETED

### ✅ Middleware Tests (99.16% coverage)

#### ✅ auth.ts (100% coverage)
- [x] API key authentication happy path
- [x] API key authentication rejection (invalid, missing)
- [x] Development mode skip logic
- [x] JWT authentication happy path
- [x] JWT validation (invalid, expired, malformed)
- [x] Optional auth (valid token, no token, invalid token)
- [x] Token generation and expiration
- **Tests**: 24 passing

#### ✅ error.middleware.ts (100% coverage)
- [x] Async handler wrapper - successful execution
- [x] Async handler wrapper - error catching
- [x] Error handler - generic 500 errors
- [x] Error handler - ValidationError (400)
- [x] Error handler - UnauthorizedError (401)
- [x] Error handler - development vs production messages
- [x] Not found handler (404)
- **Tests**: 12 passing

#### ✅ validation.middleware.ts (100% coverage)
- [x] Body validation happy path
- [x] Query validation happy path
- [x] Params validation happy path
- [x] Validation errors with detailed messages
- [x] Schema defaults application
- [x] Nested object validation
- [x] Array validation
- [x] Strict schema validation
- [x] Type coercion
- **Tests**: 21 passing

#### ✅ metrics.middleware.ts (100% coverage)
- [x] Call next immediately
- [x] Record metrics on response finish
- [x] Measure request duration
- [x] Record correct HTTP methods
- [x] Record correct status codes
- [x] Use route pattern when available
- [x] Fallback to path when route unavailable
- [x] Handle parameterized routes
- **Tests**: 13 passing

### ✅ Utility Tests

#### ✅ json-ld.utils.ts (28.84% coverage)
- [x] Generate property JSON-LD with all fields
- [x] Include address information
- [x] Include geographic coordinates
- [x] Include owner/seller information
- [x] Include pricing offers
- [x] Work without optional fields
- [x] Generate property list JSON-LD
- [x] Include search query in name
- [x] Include nextItem when hasMore
- [x] Generate organization/website JSON-LD
- **Tests**: 19 passing

#### ✅ search-term-optimizer.ts (8.75% coverage)
- [x] Export array of search terms
- [x] Contain only string values
- [x] Terms have minimum 4 character length
- [x] No empty strings
- [x] Contains common entity terms
- [x] Contains real estate terms
- **Tests**: 6 passing

### ✅ Documentation
- [x] Update TEST-STATUS.md with session summary
- [x] Document coverage improvements
- [x] Create roadmap to 70% coverage
- [x] Document testing patterns established
- [x] Create context document for handoff

---

## Phase 2: High-Impact Targets ✅ COMPLETED

**Estimated Time**: 4-6 hours
**Actual Time**: 3 hours
**Status**: ✅ Complete
**Coverage Gained**: +10.89% (11.67% → 22.56%)

### ✅ Property Controller Tests (~328 lines, 0% → 100%)
**Impact**: +8-10% coverage
**Time Estimate**: 2-3 hours

**File to Create**: `src/controllers/__tests__/property.controller.test.ts`

**Setup Required**:
```typescript
jest.mock('../../lib/prisma');
jest.mock('../../lib/redis-cache.service');
jest.mock('../../lib/claude.service');
jest.mock('../../queues/scraper.queue');
```

**Tests Written** (18 total):
- [x] GET /api/properties - Query properties
  - [x] Return cached properties when available
  - [x] Fetch from database on cache miss
  - [x] Apply filters correctly (city, type, value range, search term)

- [x] POST /api/properties/scrape - Create scrape job
  - [x] Queue a scrape job successfully
  - [x] Return 429 when rate limited

- [x] GET /api/properties/jobs/:jobId - Get job status
  - [x] Return job status for completed job
  - [x] Return job status for failed job
  - [x] Return 404 when job not found

- [x] GET /api/properties/stats - Get statistics
  - [x] Return statistics with cache
  - [x] Fetch statistics from database on cache miss

- [x] POST /api/properties/search - AI-powered search
  - [x] Perform natural language search successfully
  - [x] Return 400 when query is missing
  - [x] Return 400 when query is not a string

- [x] GET /api/properties/history - Scrape history
  - [x] Return scrape job history

- [x] GET /api/properties/test/claude - Test Claude connection
  - [x] Test Claude API connection successfully

- [x] POST /api/properties/monitored - Add monitored search
  - [x] Add a new monitored search
  - [x] Return 400 when search term is missing

- [x] GET /api/properties/monitored - Get monitored searches
  - [x] Return active monitored searches

### ✅ JSON-LD Utils Completion (~499 lines, 28.84% → 100%)
**Impact**: +2.13% coverage
**Actual Time**: 1 hour
**File Updated**: `src/utils/__tests__/json-ld.utils.test.ts`

**Tests Added** (32 new, 51 total):
- [x] generateBreadcrumbJsonLd (5 tests)
  - [x] Generate valid BreadcrumbList JSON-LD
  - [x] Set correct position for each item
  - [x] Include URLs when provided
  - [x] Omit item field when URL not provided
  - [x] Handle empty items array

- [x] generatePropertyCollectionJsonLd (8 tests)
  - [x] Generate valid CollectionPage JSON-LD
  - [x] Include correct number of items
  - [x] Limit list items to 10
  - [x] Calculate aggregate statistics correctly
  - [x] Include city metadata for city collections
  - [x] Omit city metadata for non-city collections
  - [x] Include modification date
  - [x] Include item URLs

- [x] injectJsonLdScript (3 tests)
  - [x] Generate valid script tag
  - [x] Include properly formatted JSON
  - [x] Handle complex nested objects

- [x] generatePageJsonLd (6 tests)
  - [x] Generate property page scripts
  - [x] Generate listing page scripts
  - [x] Generate home page scripts
  - [x] Include proper breadcrumbs for property page
  - [x] Include proper breadcrumbs for listing page
  - [x] Use custom website URL

- [x] validateJsonLd (10 tests)
  - [x] Return no errors for valid JSON-LD
  - [x] Detect missing @context
  - [x] Detect missing @type
  - [x] Validate RealEstateListing requires address
  - [x] Validate RealEstateListing requires offers or price
  - [x] Validate PostalAddress requires streetAddress
  - [x] Validate PostalAddress requires locality or region
  - [x] Accept valid RealEstateListing with price
  - [x] Handle array @type with RealEstateListing
  - [x] Accumulate multiple errors

### ✅ Deduplication Utils (~179 lines, 0% → 84.37%)
**Impact**: +4.62% coverage
**Actual Time**: 1 hour
**File Created**: `src/utils/__tests__/deduplication.test.ts`

**Tests Written** (15 total):
- [x] No duplicates scenarios (2 tests)
  - [x] Return zero removed when queue is empty
  - [x] Return zero removed when no duplicates exist

- [x] Duplicate pending jobs (3 tests)
  - [x] Remove duplicate pending jobs and keep highest priority
  - [x] Handle jobs with no priority (default to 10)
  - [x] Handle multiple duplicate groups

- [x] Already completed terms (2 tests)
  - [x] Remove all pending jobs for completed terms
  - [x] Handle mix of completed and unique terms

- [x] Mixed queue states (1 test)
  - [x] Process jobs from both waiting and delayed queues

- [x] Error handling (2 tests)
  - [x] Continue removing jobs even if some fail
  - [x] Track multiple failures correctly

- [x] Verbose logging (3 tests)
  - [x] Log information when verbose is true
  - [x] Not log when verbose is false
  - [x] Log errors for failed removals when verbose

- [x] Complex scenarios (2 tests)
  - [x] Handle combination of duplicates and completed terms
  - [x] Handle empty searchTerm gracefully

---

## Phase 3: Routes Testing ✅ COMPLETED (Target: 50%+ coverage achieved!)

**Estimated Time**: 1-2 hours
**Actual Time**: 2 hours
**Status**: ✅ Complete
**Coverage Gained**: +29.16% (22.56% → 51.72%) - **EXCEEDED TARGET BY 5X!**

### ✅ Routes Tests (~537 lines, 0% → 95%+)
**Impact**: +29.16% coverage (target was +5-7%)
**Actual Time**: 2 hours
**Files Created**:
- `src/routes/__tests__/property.routes.test.ts` (36 tests)
- `src/routes/__tests__/app.routes.test.ts` (22 tests - fixed and passing)

**Approach**: Integration-style tests with supertest and mocked controllers

**Setup Used**:
```typescript
import request from 'supertest';
import express from 'express';
import { propertyRouter } from '../property.routes';
import { propertyController } from '../../controllers/property.controller';

// Mock the controller
jest.mock('../../controllers/property.controller', () => ({
  propertyController: {
    scrapeProperties: jest.fn(),
    getJobStatus: jest.fn(),
    // ... all controller methods
  },
}));

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRouter);
```

**Tests Written** (58 total):
- [x] Route registration (1 test)
  - [x] All routes registered correctly with proper HTTP methods

- [x] Validation middleware (14 tests)
  - [x] POST /scrape - Body validation (searchTerm required, optional fields)
  - [x] GET /history - Query validation (limit, offset, status)
  - [x] GET /properties - Query validation (filters, pagination)
  - [x] POST /search - Body validation (query required, limit optional)
  - [x] POST /monitor - Body validation (searchTerm required)

- [x] Error responses (4 tests)
  - [x] 400 for validation errors (proper error structure)
  - [x] 404 for not found routes
  - [x] 500 for controller errors
  - [x] Async error handling

- [x] All property routes (10 tests)
  - [x] POST /scrape
  - [x] GET /jobs/:jobId
  - [x] GET /history
  - [x] GET /properties
  - [x] POST /search
  - [x] GET /search/test
  - [x] GET /stats
  - [x] POST /monitor
  - [x] GET /monitor

- [x] App routes (22 tests)
  - [x] GET / - HTML rendering
  - [x] GET /health - Health check
  - [x] CSP headers validation
  - [x] Security headers validation
  - [x] Initial data injection
  - [x] XSS prevention

### ✅ Deduplication Completion (~179 lines, 84% → 100%)
**Impact**: +2.5% coverage
**Actual Time**: 30 minutes
**File Updated**: `src/utils/__tests__/deduplication.test.ts` (15 → 22 tests)

**Tests Added** (7 new):
- [x] Verbose mode with no duplicates
- [x] Display >10 duplicate terms
- [x] Display >20 completed terms
- [x] Progress reporting with showProgress=true
- [x] Error handling for completed term removal

### 🔴 Redis Cache Service (~357 lines, 0% → BLOCKED)
**Status**: ⚠️ Deferred - Mock issue (see Session 2 Critical Issues)
**Alternative**: Skip for now, continue with Metrics Service

---

## Phase 4: TCAD Scraper (Target: 45-50% coverage - DEFERRED)

**Estimated Time**: 3-4 hours
**Status**: ⬜ Deferred (complex Playwright mocking)

### ⬜ TCAD Scraper Core Logic (~653 lines, 0% → 40%+)
**Impact**: +15-18% coverage
**Time Estimate**: 3-4 hours

**File to Test**: `src/lib/tcad-scraper.ts`

**Setup Required**:
```typescript
jest.mock('playwright');
```

**Tests to Write**:
- [ ] Authentication Flow
  - [ ] Successful authentication
  - [ ] Authentication failure
  - [ ] Token caching
  - [ ] Token refresh

- [ ] Property Search
  - [ ] Search with results
  - [ ] Search with no results
  - [ ] Search with pagination
  - [ ] Handle search errors

- [ ] Property Extraction
  - [ ] Extract property from HTML
  - [ ] Parse property ID
  - [ ] Parse address
  - [ ] Parse owner name
  - [ ] Parse valuation
  - [ ] Handle missing fields

- [ ] Data Normalization
  - [ ] Format currency values
  - [ ] Normalize addresses
  - [ ] Handle special characters

- [ ] Error Handling
  - [ ] Bot detection handling
  - [ ] Network errors
  - [ ] Timeout errors
  - [ ] Retry logic

**Mock Examples**:
```typescript
const mockPage = {
  goto: jest.fn(),
  type: jest.fn(),
  click: jest.fn(),
  waitForSelector: jest.fn(),
  evaluate: jest.fn(),
  $: jest.fn(),
  $$: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
};

const mockPlaywright = {
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
};
```

---

## Phase 4: Service Layer (Target: 60-70% coverage)

**Estimated Time**: 6-8 hours
**Status**: 🔶 Next Up

### ⬜ Metrics Service (~565 lines, 0% → 70%+)
**Impact**: +10-12% coverage
**Time Estimate**: 2-3 hours

**File to Test**: `src/lib/metrics.service.ts`

**Tests to Write**:
- [ ] POST /api/properties/monitor - Add monitored search
  - [ ] Happy path - create
  - [ ] Update existing
  - [ ] Validation errors

- [ ] GET /api/properties/monitor - List monitored searches
  - [ ] Happy path with results
  - [ ] Empty results
  - [ ] Active only filter

**Mock Examples**:
```typescript
const mockPrisma = {
  property: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  scrapeJob: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  monitoredSearch: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  invalidatePattern: jest.fn(),
};

const mockClaude = {
  parseNaturalLanguageQuery: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};
```

### ⬜ TCAD Scraper Core Logic (~653 lines, 0% → 40%+)
**Impact**: +15-18% coverage
**Time Estimate**: 3-4 hours

**File to Test**: `src/lib/tcad-scraper.ts`

**Setup Required**:
```typescript
jest.mock('playwright');
```

**Tests to Write**:
- [ ] Authentication Flow
  - [ ] Successful authentication
  - [ ] Authentication failure
  - [ ] Token caching
  - [ ] Token refresh

- [ ] Property Search
  - [ ] Search with results
  - [ ] Search with no results
  - [ ] Search with pagination
  - [ ] Handle search errors

- [ ] Property Extraction
  - [ ] Extract property from HTML
  - [ ] Parse property ID
  - [ ] Parse address
  - [ ] Parse owner name
  - [ ] Parse valuation
  - [ ] Handle missing fields

- [ ] Data Normalization
  - [ ] Format currency values
  - [ ] Normalize addresses
  - [ ] Handle special characters

- [ ] Error Handling
  - [ ] Bot detection handling
  - [ ] Network errors
  - [ ] Timeout errors
  - [ ] Retry logic

**Mock Examples**:
```typescript
const mockPage = {
  goto: jest.fn(),
  type: jest.fn(),
  click: jest.fn(),
  waitForSelector: jest.fn(),
  evaluate: jest.fn(),
  $: jest.fn(),
  $$: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
};

const mockPlaywright = {
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
};
```

### ⬜ Routes Tests (~537 lines, 0% → 50%+)
**Impact**: +5-7% coverage
**Time Estimate**: 1-2 hours

**Files to Test**:
- `src/routes/property.routes.ts`
- `src/routes/app.routes.ts`

**Approach**: Integration-style tests with supertest

**Setup Required**:
```typescript
import request from 'supertest';
import express from 'express';
import { propertyRoutes } from '../property.routes';

const app = express();
app.use(express.json());
app.use('/api/properties', propertyRoutes);
```

**Tests to Write**:
- [ ] Route registration
  - [ ] All routes registered correctly
  - [ ] Middleware chain applied

- [ ] Validation middleware
  - [ ] Body validation triggers
  - [ ] Query validation triggers
  - [ ] Params validation triggers

- [ ] Error responses
  - [ ] 400 for validation errors
  - [ ] 404 for not found
  - [ ] 500 for server errors

- [ ] Rate limiting
  - [ ] Rate limit headers present
  - [ ] Rate limit enforcement

---

## Phase 3: Service Layer (Target: 55-60% coverage)

**Estimated Time**: 6-8 hours
**Status**: ⬜ Not Started

### ⬜ Redis Cache Service (~357 lines, 0% → 70%+)
**Impact**: +8-10% coverage
**Time Estimate**: 2-3 hours

**File to Test**: `src/lib/redis-cache.service.ts`

**Tests to Write**:
- [ ] Cache get - hit
- [ ] Cache get - miss
- [ ] Cache set with TTL
- [ ] Cache invalidate by key
- [ ] Cache invalidate by pattern
- [ ] Cache statistics (hit rate, miss rate)
- [ ] Connection error handling

### ⬜ Metrics Service (~565 lines, 0% → 60%+)
**Impact**: +10-12% coverage
**Time Estimate**: 2-3 hours

**File to Test**: `src/lib/metrics.service.ts`

**Tests to Write**:
- [ ] Register gauge metric
- [ ] Register counter metric
- [ ] Register histogram metric
- [ ] Update gauge value
- [ ] Increment counter
- [ ] Record histogram observation
- [ ] HTTP request recording
- [ ] Prometheus format export

### ⬜ Token Refresh Service (~329 lines, 0% → 60%+)
**Impact**: +6-8% coverage
**Time Estimate**: 2 hours

**File to Test**: `src/services/token-refresh.service.ts`

**Tests to Write**:
- [ ] Token validation - valid
- [ ] Token validation - expired
- [ ] Token refresh - success
- [ ] Token refresh - failure
- [ ] Auto-refresh scheduling
- [ ] Error handling and retry

---

## Phase 4: Final Push to 70% (Target: 70%+ coverage)

**Estimated Time**: 4-6 hours
**Status**: ⬜ Not Started

### ⬜ Complete JSON-LD Utils (28.84% → 70%+)
**Impact**: +3-4% coverage
**Time Estimate**: 1-2 hours

**Remaining Functions to Test**:
- [ ] generateBreadcrumbJsonLd
- [ ] generateSearchResultsJsonLd
- [ ] generateWebPageJsonLd
- [ ] Edge cases for existing functions

### ⬜ Deduplication Utils (~179 lines, 0% → 60%+)
**Impact**: +4-5% coverage
**Time Estimate**: 2 hours

**File to Test**: `src/utils/deduplication.ts`

**Setup Required**:
```typescript
jest.mock('../queues/scraper.queue');
jest.mock('../lib/prisma');
```

**Tests to Write**:
- [ ] Find duplicate jobs in queue
- [ ] Find already completed terms
- [ ] Remove duplicate jobs
- [ ] Preserve highest priority job
- [ ] Statistics tracking

### ⬜ Queue Operations (~240 lines, 0% → 50%+)
**Impact**: +5-6% coverage
**Time Estimate**: 2 hours

**File to Test**: `src/queues/scraper.queue.ts`

**Setup Required**:
```typescript
jest.mock('bullmq');
```

**Tests to Write**:
- [ ] Queue initialization
- [ ] Job creation
- [ ] Job processing
- [ ] Job completion
- [ ] Job failure
- [ ] Retry logic
- [ ] Job cleanup

---

## Quick Reference Commands

### Development
```bash
# Run all tests with coverage
cd /Users/alyshialedlie/code/ISPublicSites/tcad-scraper/server
npm test -- --coverage

# Run specific test file
npm test -- --testPathPattern="property.controller"

# Watch mode for development
npm run test:watch

# Run tests matching pattern
npm test -- --testNamePattern="should handle errors"
```

### Coverage Analysis
```bash
# Generate coverage report
npm test -- --coverage --verbose=false

# Open coverage report in browser
open coverage/lcov-report/index.html

# Check coverage for specific file
npm test -- --coverage --collectCoverageFrom="src/controllers/property.controller.ts"
```

### Debugging
```bash
# Run with verbose output
npm test -- --verbose

# Run single test file with logs
npm test -- --testPathPattern="auth.test" --verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

## Success Criteria

### Phase 1 ✅
- [x] Middleware coverage > 95%
- [x] At least 3 utility functions tested
- [x] Overall coverage > 10%
- [x] All tests passing
- [x] Documentation updated

### Phase 2 ⬜
- [ ] Property controller coverage > 70%
- [ ] TCAD scraper coverage > 40%
- [ ] Routes coverage > 50%
- [ ] Overall coverage > 35%
- [ ] All tests passing

### Phase 3 ⬜
- [ ] Redis cache coverage > 70%
- [ ] Metrics service coverage > 60%
- [ ] Token refresh coverage > 60%
- [ ] Overall coverage > 55%
- [ ] All tests passing

### Phase 4 ⬜
- [ ] JSON-LD utils coverage > 70%
- [ ] Deduplication coverage > 60%
- [ ] Queue operations coverage > 50%
- [ ] **Overall coverage > 70%** ✨
- [ ] All tests passing
- [ ] CI/CD coverage enforcement enabled

---

## Notes & Observations

### What Worked Well
1. Starting with pure functions and middleware
2. Establishing clear testing patterns early
3. Using TypeScript strict mode to catch issues
4. Comprehensive mocking setup before writing tests
5. Testing happy paths first for quick coverage gains

### Challenges Encountered
1. JWT token includes `iat` timestamp - use `toMatchObject` not `toEqual`
2. Config module caching - must mock before imports
3. Express response chaining - mock must return object with methods
4. Async timing - use `setImmediate` for promise resolution

### Patterns to Reuse
1. Middleware test setup (mockReq, mockRes, mockNext)
2. Config mocking pattern
3. Event listener testing (finish events)
4. JWT token testing with `toMatchObject`

---

**Last Updated**: 2025-11-08 01:30 CST
**Next Update**: After Phase 2 completion
