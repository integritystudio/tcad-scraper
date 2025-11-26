# Test Suite Organization

This directory contains both **unit tests** and **integration tests** for the TCAD Scraper backend.

## Test Structure

```
src/
├── __tests__/
│   ├── *.test.ts              # Unit tests (mocked, fast)
│   ├── *.integration.test.ts  # Integration tests (real services)
│   ├── setup.ts               # Test environment setup
│   └── README.md              # This file
├── controllers/__tests__/
├── lib/__tests__/
├── middleware/__tests__/
├── routes/__tests__/
├── services/__tests__/
├── utils/__tests__/
└── .../__tests__/
```

## Unit Tests vs Integration Tests

### Unit Tests (`*.test.ts`)

**Purpose**: Test individual components in isolation with mocked dependencies

**Characteristics**:
- Fast execution (< 10 seconds)
- No external service dependencies
- All database/Redis/API calls are mocked
- Run in parallel
- Suitable for CI/CD pipelines

**Configuration**: `vitest.config.ts`

**Run with**:
```bash
npm test              # Run all unit tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

**Excluded from unit tests**:
- `*.integration.test.ts`
- `src/__tests__/integration.test.ts`
- `src/__tests__/api.test.ts`
- `src/__tests__/auth-database.connection.test.ts`
- `src/__tests__/enqueue.test.ts`
- `src/__tests__/security.test.ts`

### Integration Tests (`*.integration.test.ts`)

**Purpose**: Test complete workflows with real services

**Characteristics**:
- Longer execution time (up to 60 seconds per test)
- Requires external services (PostgreSQL, Redis)
- Tests actual API endpoints
- Runs sequentially to avoid conflicts
- Retries once on failure

**Configuration**: `vitest.integration.config.ts`

**Prerequisites**:
- ✅ **Tailscale VPN** must be running (`tailscale status`)
- ✅ **PostgreSQL** database accessible via Tailscale
- ✅ **Redis** must be running (local or hobbes via Tailscale)
  - For production scraping: Use hobbes Redis (`REDIS_HOST=hobbes`)
  - For local testing: Can use `REDIS_HOST=localhost`
  - Tests auto-skip if Redis unavailable (using `isRedisAvailable()` helper)
- ✅ **DATABASE_URL** configured in environment

**Run with**:
```bash
npm run test:integration              # Run all integration tests
npm run test:integration:watch        # Watch mode
npm run test:auth-db                  # Auth-database tests only
npm run test:auth-db:connection       # Connection test only
npm run test:enqueue                  # Queue enqueue test only
```

## Test Files by Category

### Unit Tests (22 files, 282 tests)

**Middleware**:
- `middleware/__tests__/auth.test.ts` - JWT authentication
- `middleware/__tests__/error.middleware.test.ts` - Error handling
- `middleware/__tests__/metrics.middleware.test.ts` - Prometheus metrics
- `middleware/__tests__/validation.middleware.test.ts` - Zod validation
- `middleware/__tests__/xcontroller.middleware.test.ts` - XController CSP

**Controllers**:
- `controllers/__tests__/property.controller.test.ts` - Property CRUD operations

**Services**:
- `services/__tests__/token-refresh.service.test.ts` - TCAD token refresh
- `services/__tests__/search-term-optimizer.test.ts` - Search term generation

**Utilities**:
- `utils/__tests__/deduplication.test.ts` - Queue deduplication
- `utils/__tests__/json-ld.utils.test.ts` - JSON-LD schema generation

**Library**:
- `lib/__tests__/metrics.service.test.ts` - Prometheus service
- `lib/__tests__/prisma.test.ts` - Database client
- `lib/__tests__/redis-cache.service.test.ts` - Redis caching
- `lib/__tests__/tcad-scraper.test.ts` - Scraping engine
- `lib/__tests__/search-term-deduplicator.test.ts` - Search dedup
- `lib/__tests__/claude.service.test.ts` - Claude AI service

**Routes**:
- `routes/__tests__/property.routes.test.ts` - Property API routes
- `routes/__tests__/property.routes.claude.test.ts` - Claude integration routes
- `routes/__tests__/app.routes.test.ts` - General app routes

**Queues**:
- `queues/__tests__/scraper.queue.test.ts` - BullMQ queue operations (17 tests passing, 1 skipped)

**Schedulers**:
- `schedulers/__tests__/scrape-scheduler.test.ts` - Cron job scheduler (27 tests passing)

### Integration Tests (6 files, 141 tests)

**Full System Tests**:
- `__tests__/integration.test.ts` - Server health, API routes
- `__tests__/api.test.ts` - Complete API endpoint testing
- `__tests__/auth-database.integration.test.ts` - Auth → Database flow
- `__tests__/auth-database.connection.test.ts` - Database connectivity
- `__tests__/enqueue.test.ts` - Queue job enqueueing
- `__tests__/security.test.ts` - Security middleware, rate limiting

## Current Test Status

**Migration Status**: Jest → Vitest (95% complete)

### Unit Tests
- ✅ **489 passing** (88%)
- ⚠️ **0 failing** (0%)
- ℹ️ **67 skipped** (12%)
- **Total**: 556 tests in 25 files

**Pass Rate**: 88% (100% excluding intentionally skipped tests)

### Integration Tests
- ✅ **15 passing** (11%)
- ⚠️ **3 failing** (2%)
- ℹ️ **27 skipped** (19%)
- **Total**: 141 tests in 6 files

**Status** (as of 2025-11-26):
- Database connectivity tests: ✅ All passing (22 tests)
- Auth-database integration: ✅ All passing (26 tests)
- Security tests: ⚠️ 1 nonce test failing (30/31 passing)
- Queue tests: ⚠️ Failing due to Redis unavailable (requires hobbes connection)
- Server health checks: ⚠️ Queue health failing due to Redis

**Note**: Integration tests require external services (PostgreSQL via Tailscale, Redis on hobbes). Tests automatically skip when infrastructure is unavailable to prevent timeouts and false failures.

## Running All Tests

```bash
# Run both unit and integration tests
npm run test:all

# With coverage
npm run test:all:coverage
```

## Test Utilities

### Infrastructure Availability Checking

`src/__tests__/test-utils.ts` provides helper functions for handling infrastructure dependencies:

**`isRedisAvailable(timeoutMs?: number): Promise<boolean>`**
- Checks if Redis is responsive within the timeout (default 2000ms)
- Returns `true` if Redis can be pinged, `false` otherwise
- Uses fail-fast connection strategy to avoid test timeouts

**Usage in tests**:
```typescript
import { isRedisAvailable } from './test-utils';

// Skip entire test suite if Redis unavailable
describe.skipIf(!(await isRedisAvailable()))('Queue Tests', () => {
  // Tests that require Redis
});

// Skip individual test
test('should use queue', async () => {
  if (!(await isRedisAvailable())) {
    console.log('⏭️  Skipping: Redis not available');
    return;
  }
  // Test code
});
```

**Other utilities**:
- `skipIfRedisUnavailable()` - Programmatically skip test if Redis unavailable
- `skipIfDatabaseUnavailable()` - Skip if DATABASE_URL not configured
- `isTailscaleConnected()` - Heuristic check for Tailscale VPN requirement

## Common Test Patterns

### Mocking with Vitest

```typescript
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock a module
vi.mock('../../lib/prisma', () => ({
  prisma: {
    property: {
      findMany: vi.fn(),
    },
  },
}));

// Use the mock
const mockFindMany = prisma.property.findMany as Mock;
mockFindMany.mockResolvedValue([{ id: '1', name: 'Test' }]);
```

### Testing Express Middleware

```typescript
let mockReq: Partial<Request>;
let mockRes: Partial<Response>;
let mockNext: NextFunction;

beforeEach(() => {
  mockReq = { body: {}, query: {}, params: {} };
  mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  mockNext = vi.fn();
});
```

### Testing with Supertest (Integration)

```typescript
import request from 'supertest';
import app from '../index';

it('should return properties', async () => {
  const response = await request(app)
    .get('/api/properties')
    .expect(200);

  expect(response.body.data).toBeDefined();
});
```

## Known Issues

### Skipped Tests (67 tests)

Tests are intentionally skipped when:
- Database is not accessible (Tailscale VPN down)
- Redis is not running
- Required environment variables are missing
- Tests are marked with `.skip()` for CI environments
- Complex Playwright browser mocks need additional configuration:
  - `tcad-scraper.test.ts` (21 tests)
  - `token-refresh.service.test.ts` (3 tests)
- Redis cache tests skipped by design (40 tests)

## Recent Fixes (November 26, 2025)

### Trust Proxy Configuration Fixed
Fixed `ERR_ERL_PERMISSIVE_TRUST_PROXY` error from express-rate-limit:
- **Root cause**: `app.set('trust proxy', true)` was too permissive
- **Solution**: Changed to `app.set('trust proxy', 1)` to trust only first hop (nginx)
- **Impact**: Resolved rate limiting ValidationError, improved security
- **File**: `server/src/index.ts:48`

### BullMQ Queue Tests Fixed
Fixed 8 previously skipped tests in `queues/__tests__/scraper.queue.test.ts`:
- **Queue Configuration** (2 tests): Module initialization timing issues resolved
- **Queue Event Listeners** (6 tests): Event registration verification now works
- **Solution**: Used `vi.resetModules()` pattern to force fresh module import per test

### Scheduler Tests Fixed
Fixed all 27 previously skipped tests in `schedulers/__tests__/scrape-scheduler.test.ts`:
- **Root cause**: Missing mock variable definitions (`mockPrisma`, `mockScraperQueue`)
- **Solution**: Added proper imports and type casting to expose Mock types
- **Coverage**: initialize (7), runScheduledScrapes (8), cleanupOldJobs (5), stop (3), triggerDailyScrapes (3), Module Export (1)

## Coverage Goals

**Current Coverage**: 34.55%
**Target Coverage**: 60%

Focus areas:
- Service layer testing
- Repository pattern testing
- Error handling paths
- Edge cases in business logic

## Related Documentation

- **Main CLAUDE.md**: `../../CLAUDE.md` - Project overview
- **Vitest Config**: `../../vitest.config.ts` - Unit test configuration
- **Integration Config**: `../../vitest.integration.config.ts` - Integration test configuration
- **Package Scripts**: `../../package.json` - All test commands

---

**Last Updated**: 2025-11-26
