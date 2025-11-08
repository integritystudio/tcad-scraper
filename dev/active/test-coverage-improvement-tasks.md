# Test Coverage Improvement - Task List

**Last Updated**: 2025-11-08 01:30 CST
**Status**: Phase 1 Complete ✅ - Moving to Phase 2
**Current Coverage**: 11.67% (Target: 70%)

---

## Progress Tracker

| Phase | Target Coverage | Status | Tests Added | Time Spent |
|-------|----------------|--------|-------------|------------|
| Phase 1 | 11-15% | ✅ Complete | 84 tests | 3 hours |
| Phase 2 | 35-40% | ⬜ Not Started | 0 tests | 0 hours |
| Phase 3 | 55-60% | ⬜ Not Started | 0 tests | 0 hours |
| Phase 4 | 70%+ | ⬜ Not Started | 0 tests | 0 hours |

**Current**: 11.67% coverage
**Next Milestone**: 35-40% coverage

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

## Phase 2: High-Impact Targets (Target: 35-40% coverage)

**Estimated Time**: 4-6 hours
**Status**: ⬜ Not Started

### ⬜ Property Controller Tests (~328 lines, 0% → 70%+)
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

**Tests to Write**:
- [ ] GET /api/properties - Query properties
  - [ ] Happy path with results
  - [ ] Empty results
  - [ ] With pagination
  - [ ] With filters (city, type, value range)
  - [ ] Cache hit scenario
  - [ ] Cache miss scenario

- [ ] POST /api/properties/scrape - Create scrape job
  - [ ] Happy path - job created
  - [ ] Validation errors
  - [ ] Queue enqueue success
  - [ ] Return job ID

- [ ] GET /api/properties/jobs/:jobId - Get job status
  - [ ] Job found - pending
  - [ ] Job found - completed
  - [ ] Job found - failed
  - [ ] Job not found (404)

- [ ] GET /api/properties/stats - Get statistics
  - [ ] Happy path with data
  - [ ] Cache hit
  - [ ] No data scenario

- [ ] POST /api/properties/search - AI-powered search
  - [ ] Happy path with Claude response
  - [ ] Claude fallback to simple search
  - [ ] Validation errors

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
