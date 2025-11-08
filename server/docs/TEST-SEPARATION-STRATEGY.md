# Test Separation Strategy

This document explains the test separation strategy implemented in the TCAD Scraper project.

**Last Updated**: 2025-11-08

## Overview

We separate tests into two categories:
1. **Unit Tests** - Fast, isolated tests that don't require external services
2. **Integration Tests** - Tests that require database, Redis, or other external services

This separation allows for:
- Faster development feedback (unit tests run quickly)
- Better CI/CD pipeline organization
- Clear test ownership and expectations
- Easier debugging (isolated vs. integrated failures)

## Test Categories

### Unit Tests

**Purpose**: Test individual components in isolation

**Characteristics**:
- ✅ No external dependencies (database, Redis, APIs)
- ✅ Use mocks and stubs for dependencies
- ✅ Fast execution (< 10 seconds total)
- ✅ Can run in parallel
- ✅ No special setup required

**Examples**:
- `src/middleware/__tests__/xcontroller.middleware.test.ts`
- `src/lib/__tests__/search-term-deduplicator.test.ts`
- `src/lib/__tests__/claude.service.test.ts` (with mocked API)
- `src/__tests__/controller.test.ts` (with mocked dependencies)

**Configuration**: `jest.config.js`

**Run Commands**:
```bash
# Run all unit tests
npm test
npm run test:unit

# With coverage
npm run test:unit:coverage

# Watch mode
npm run test:unit:watch
```

### Integration Tests

**Purpose**: Test system behavior with real dependencies

**Characteristics**:
- ✅ Requires PostgreSQL database
- ✅ Requires Redis for queue operations
- ✅ May require external APIs (Claude, etc.)
- ✅ Slower execution (30+ seconds)
- ✅ Runs serially (maxWorkers: 1)
- ✅ Requires setup (database, migrations, services)

**Examples**:
- `src/__tests__/auth-database.integration.test.ts`
- `src/__tests__/integration.test.ts`
- `src/__tests__/enqueue.test.ts`
- `src/__tests__/api.test.ts`
- `src/__tests__/auth-database.connection.test.ts`
- `src/routes/__tests__/app.routes.test.ts`
- `src/routes/__tests__/property.routes.claude.test.ts`
- `src/__tests__/security.test.ts`

**Configuration**: `jest.integration.config.js`

**Run Commands**:
```bash
# Run all integration tests
npm run test:integration

# With coverage
npm run test:integration:coverage

# Watch mode
npm run test:integration:watch

# Specific integration test
npm run test:auth-db
npm run test:enqueue
npm run test:security
```

## File Naming Conventions

### Unit Tests
```
src/lib/__tests__/my-service.test.ts
src/middleware/__tests__/my-middleware.test.ts
```

### Integration Tests (Option 1: Explicit naming)
```
src/__tests__/my-feature.integration.test.ts
```

### Integration Tests (Option 2: Location-based)
```
src/__tests__/integration.test.ts
src/__tests__/enqueue.test.ts
src/routes/__tests__/*.test.ts
```

**Rule**: If a test file requires external services, it should either:
1. Have `.integration.test.ts` in the filename, OR
2. Be in a location designated for integration tests

## Configuration Files

### `jest.config.js` - Unit Tests

```javascript
module.exports = {
  // Exclude integration tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.test\\.ts$',
    '/src/__tests__/integration\\.test\\.ts$',
    '/src/__tests__/enqueue\\.test\\.ts$',
    // ... other integration test patterns
  ],

  // Fast settings
  testTimeout: 10000,
  maxWorkers: 'auto', // Parallel execution

  // Clean mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
```

### `jest.integration.config.js` - Integration Tests

```javascript
module.exports = {
  // Only match integration tests
  testMatch: [
    '**/__tests__/**/*.integration.test.ts',
    '**/src/__tests__/integration.test.ts',
    // ... other integration test patterns
  ],

  // Slower, more stable settings
  testTimeout: 30000,
  maxWorkers: 1, // Serial execution

  // Separate coverage directory
  coverageDirectory: 'coverage/integration',
};
```

## Running Tests

### Local Development

#### Unit Tests Only (Fast Feedback)
```bash
# Quick check during development
npm test

# With file watching
npm run test:unit:watch
```

#### Integration Tests (Full Validation)
```bash
# Setup services first
docker-compose up -d postgres redis

# Setup test database
./scripts/setup-test-db.sh

# Run integration tests
npm run test:integration
```

#### All Tests
```bash
# Run both unit and integration tests
npm run test:all

# With coverage for both
npm run test:all:coverage
```

### CI/CD Pipeline

The CI pipeline runs unit and integration tests separately:

**Unit Tests Job**:
- Runs on every push/PR
- No service dependencies needed
- Must pass to merge
- Fast execution (~1-2 minutes)

**Integration Tests Job**:
- Runs on every push/PR
- Provides PostgreSQL + Redis containers
- Allowed to fail (continue-on-error: true)
- Slower execution (~3-5 minutes)

## Test Setup Requirements

### Unit Tests
✅ No setup required
```bash
npm test
```

### Integration Tests
Requires:
1. **PostgreSQL** - Running on port 5432
2. **Redis** - Running on port 6379
3. **Test Database** - Created and migrated

**Automated Setup**:
```bash
# Start services
docker-compose up -d postgres redis

# Setup test database
./scripts/setup-test-db.sh

# Run integration tests
npm run test:integration
```

**Manual Setup**:
```bash
# Start services
docker-compose up -d postgres redis

# Create test database
createdb tcad_scraper_test

# Run migrations
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" \
  npx prisma migrate deploy

# Run integration tests
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" \
  npm run test:integration
```

## Coverage Reporting

Tests generate separate coverage reports:

- **Unit Tests**: `coverage/` (default location)
- **Integration Tests**: `coverage/integration/`

**View Coverage**:
```bash
# Generate unit test coverage
npm run test:unit:coverage
open coverage/lcov-report/index.html

# Generate integration test coverage
npm run test:integration:coverage
open coverage/integration/lcov-report/index.html

# Generate both
npm run test:all:coverage
```

## Best Practices

### Writing Unit Tests

1. **Mock External Dependencies**
   ```typescript
   jest.mock('../../lib/redis-cache.service');
   jest.mock('../../lib/prisma');
   ```

2. **Keep Tests Isolated**
   - Each test should be independent
   - Use `beforeEach` to set up fresh state
   - Clean up in `afterEach`

3. **Focus on Logic**
   - Test business logic
   - Test edge cases
   - Test error handling

4. **Keep Tests Fast**
   - No I/O operations
   - No setTimeout/delays
   - Mock slow operations

### Writing Integration Tests

1. **Test Real Scenarios**
   - Use actual database
   - Use real Redis connections
   - Test full request/response cycles

2. **Proper Cleanup**
   ```typescript
   afterEach(async () => {
     await prisma.property.deleteMany();
     await redis.flushdb();
   });
   ```

3. **Use Test Data Factories**
   ```typescript
   function createTestProperty(overrides = {}) {
     return {
       propertyId: 'TEST001',
       name: 'Test Owner',
       // ... defaults
       ...overrides,
     };
   }
   ```

4. **Test Integration Points**
   - Database transactions
   - Queue operations
   - API endpoints
   - Service interactions

## Migration Guide

### Converting Tests to Unit Tests

1. **Identify External Dependencies**
   ```typescript
   // Before: Uses real database
   const result = await prisma.property.findMany();

   // After: Use mock
   jest.mock('../lib/prisma');
   (prisma.property.findMany as jest.Mock).mockResolvedValue([]);
   ```

2. **Add Mocks**
   ```typescript
   jest.mock('../lib/redis-cache.service', () => ({
     RedisCacheService: {
       getInstance: jest.fn().mockReturnValue({
         get: jest.fn(),
         set: jest.fn(),
       }),
     },
   }));
   ```

3. **Remove Service Setup**
   ```typescript
   // Remove: Service connection
   // beforeAll(async () => {
   //   await redis.connect();
   // });

   // Keep: Mock setup
   beforeEach(() => {
     jest.clearAllMocks();
   });
   ```

### Converting Tests to Integration Tests

1. **Rename File**
   ```bash
   mv src/__tests__/my-test.test.ts \
      src/__tests__/my-test.integration.test.ts
   ```

2. **Add Service Setup**
   ```typescript
   beforeAll(async () => {
     await prisma.$connect();
     await redis.connect();
   });

   afterAll(async () => {
     await prisma.$disconnect();
     await redis.disconnect();
   });
   ```

3. **Use Real Services**
   ```typescript
   // Before: Mock
   // jest.mock('../lib/prisma');

   // After: Real database
   import { prisma } from '../lib/prisma';
   ```

## Troubleshooting

### Unit Tests Failing

**Problem**: Tests depend on external services

**Solution**: Add mocks for dependencies
```typescript
jest.mock('../lib/prisma');
jest.mock('../lib/redis-cache.service');
```

**Problem**: Tests are slow

**Solution**: Remove I/O operations, add mocks

### Integration Tests Failing

**Problem**: Cannot connect to database

**Solution**:
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Create test database
./scripts/setup-test-db.sh
```

**Problem**: Cannot connect to Redis

**Solution**:
```bash
# Start Redis
docker-compose up -d redis

# Verify it's running
redis-cli ping
```

**Problem**: Tests hang

**Solution**: Check for unclosed connections
```typescript
afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});
```

## Current Status

### Unit Tests
- **Test Suites**: 2 passing, 1 skipped, 1 failing
- **Tests**: 63 passing, 1 skipped, 18 failing
- **Coverage**: ~65% (middleware, utilities)
- **Execution Time**: ~3 seconds

### Integration Tests
- **Test Suites**: 4 passing, 2 skipped, 4 failing
- **Tests**: 135 passing, 27 skipped, 27 failing
- **Coverage**: ~55% (routes, services, queue)
- **Execution Time**: ~15-20 seconds

### Goals
- ✅ Separate unit and integration tests
- ✅ Fast unit test execution
- ✅ CI/CD pipeline integration
- ⏳ 100% unit test pass rate (currently 78%)
- ⏳ 80% integration test pass rate (currently 71%)
- ⏳ 80% code coverage overall

## Related Documentation

- [Test Database Setup](./TEST-DATABASE-SETUP.md)
- [Test Status Report](../../docs/TEST-STATUS.md)
- [Testing Guide](../../docs/TESTING.md)
- [CI/CD Documentation](../../docs/CI-CD.md)

## Summary

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|-------------------|
| **Speed** | Fast (< 10s) | Slow (30s+) |
| **Dependencies** | None (mocked) | PostgreSQL, Redis |
| **Parallelization** | Yes (auto workers) | No (serial) |
| **Setup** | None | Services + DB setup |
| **Scope** | Single component | System integration |
| **Execution** | `npm test` | `npm run test:integration` |
| **Coverage** | `coverage/` | `coverage/integration/` |
| **CI Requirement** | Must pass | Can fail |

---

**Next Steps**:
1. Increase unit test pass rate to 100%
2. Add more unit tests for untested code paths
3. Mock remaining external dependencies
4. Improve integration test stability
5. Reach 80% overall code coverage
