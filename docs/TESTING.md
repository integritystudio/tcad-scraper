# Testing Guide

Quick reference for running tests in the TCAD Scraper project.

## Quick Start

```bash
# Navigate to server directory
cd server

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testPathPattern="security"
```

## Prerequisites

### Local Development

Before running tests locally, you need:

1. **PostgreSQL** - Running on port 5432
2. **Redis** - Running on port 6379
3. **Test Database** - Created and migrated

#### Setup Commands

**Automated Setup (Recommended)**:
```bash
# Start services with Docker
docker-compose up -d postgres redis

# Run automated test database setup
cd server
./scripts/setup-test-db.sh
```

**Manual Setup**:
```bash
# Start services with Docker
docker-compose up -d postgres redis

# Create test database
createdb tcad_scraper_test

# Run migrations
cd server
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" \
  npx prisma migrate deploy
```

For detailed setup instructions, see [Test Database Setup Guide](../server/docs/TEST-DATABASE-SETUP.md).

## Test Commands

### Server Tests

```bash
cd server

# All tests
npm test

# Coverage report
npm run test:coverage

# Watch mode (re-run on changes)
npm run test:watch

# Security tests only
npm run test:security

# Auth/database tests
npm run test:auth-db

# Specific test file
npm test -- src/__tests__/security.test.ts
```

### Available Test Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:coverage` | Run with coverage report |
| `npm run test:watch` | Watch mode |
| `npm run test:security` | Security tests only |
| `npm run test:auth-db` | Auth/database tests |
| `npm run test:enqueue` | Queue tests |

## Test Structure

```
server/src/__tests__/
├── setup.ts                    # Global test setup
├── security.test.ts            # Security vulnerability tests
├── integration.test.ts         # Integration tests
├── enqueue.test.ts             # Queue/BullMQ tests
├── api.test.ts                 # API endpoint tests (skipped)
├── controller.test.ts          # Controller tests (skipped)
├── auth-database.*.test.ts     # Database auth tests
├── lib/__tests__/              # Library unit tests
├── middleware/__tests__/       # Middleware tests
└── routes/__tests__/           # Route handler tests
```

## Test Categories

### Unit Tests
- Fast, isolated tests
- Mock external dependencies
- Test single functions/classes

### Integration Tests
- Test multiple components together
- Use real database and services
- Slower but more realistic

### Security Tests
- Test for common vulnerabilities
- SQL injection, XSS, CSRF protection
- Input validation

## Environment Variables

Tests use these environment variables:

```bash
NODE_ENV=test
LOG_LEVEL=error
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tcad_scraper_test
DATABASE_READ_ONLY_URL=(same as above)
REDIS_HOST=localhost
REDIS_PORT=6379
SENTRY_DSN=""
CLAUDE_API_KEY="test-key"
```

## Coverage Reports

After running `npm run test:coverage`:

```bash
# View HTML report
open coverage/lcov-report/index.html

# View summary in terminal
cat coverage/coverage-summary.json
```

### Coverage Goals

- **Lines**: 70%+
- **Branches**: 65%+
- **Functions**: 70%+
- **Statements**: 70%+

## Known Issues

### Database Permission Errors

**Error**: `User 'postgres' was denied access`

**Fix**:
```bash
# Ensure DATABASE_URL points to test database
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test"

# Grant permissions if needed
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tcad_scraper_test TO postgres;"
```

### Redis Connection Errors

**Error**: `ECONNREFUSED localhost:6379`

**Fix**:
```bash
# Start Redis
docker-compose up -d redis

# Or with Homebrew
brew services start redis
```

### Module Not Found Errors

**Error**: `Cannot find module '@prisma/client'`

**Fix**:
```bash
cd server
npm ci
npx prisma generate
```

## CI/CD Testing

GitHub Actions runs tests automatically on every push and PR.

See [CI/CD Documentation](docs/CI-CD.md) for details.

### CI Test Environment

- PostgreSQL 16 container
- Redis 7 container
- Automated database migrations
- All environment variables configured

## Debugging Tests

### Run Single Test

```bash
npm test -- --testNamePattern="should return healthy status"
```

### Enable Verbose Output

```bash
npm test -- --verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Vitest Debug",
  "program": "${workspaceFolder}/server/node_modules/.bin/vitest",
  "args": ["run", "--reporter=verbose", "${relativeFile}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Writing Tests

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = someFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Best Practices

1. **One assertion per test** - Tests should be focused
2. **Descriptive names** - `should return error when input is invalid`
3. **Arrange-Act-Assert** - Clear test structure
4. **Clean up** - Use afterEach to prevent test pollution
5. **Mock external dependencies** - Don't call real APIs in tests
6. **No `any` types** - Use the patterns below instead
7. **No `console.*`** - Use `logger` from `../lib/logger` (lint warns in test files)

### Mocking Example

```typescript
vi.mock('../lib/external-service');

import { externalService } from '../lib/external-service';

const mockService = vi.mocked(externalService);
mockService.mockResolvedValue({ data: 'mocked' });
```

### Type-Safe Test Patterns

These patterns replace `as any` casts throughout test files. Use them when mocking dependencies or accessing internal APIs.

#### Mock Objects with `Record<string, ReturnType<typeof vi.fn>>`

For flat mock objects (services, queues, loggers):

```typescript
let scraperQueue: Record<string, ReturnType<typeof vi.fn>>;
let cacheService: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  scraperQueue = { add: vi.fn(), getJob: vi.fn() };
  cacheService = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
});
```

For nested mock objects (Prisma client with model methods):

```typescript
let prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;

beforeEach(() => {
  prisma = {
    property: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn() },
    scrapeJob: { findMany: vi.fn(), create: vi.fn() },
  };
});
```

#### Partial Types with `Pick<Type, "key">`

When you only need a subset of a complex type:

```typescript
import type { IRoute } from "express";

const mockRoute = {
  path: "/api/properties",
} as Pick<IRoute, "path">;
```

#### Safe Casting with `as unknown as Type`

For module-level mock overrides where types don't align:

```typescript
import { scraperQueue } from "../queues/scraper.queue";

const mockScraperQueue = scraperQueue as unknown as {
  add: ReturnType<typeof vi.fn>;
  getJob: ReturnType<typeof vi.fn>;
};
```

For Prisma client access in tests with dynamic imports:

```typescript
import type { PrismaClient } from "@prisma/client";
const mockPrisma = prisma as unknown as PrismaClient;
```

#### Config Mutation with `Record<string, unknown>`

For overriding readonly config properties in tests:

```typescript
import { config } from "../config";

(config.env as Record<string, unknown>).isProduction = true;
(config.frontend as Record<string, unknown>).apiUrl = "http://test";
```

#### Dynamic Imports with Proper Types

For integration tests that dynamically import app or database:

```typescript
import type { PrismaClient } from "@prisma/client";
import type { Express } from "express";

let app: Express;
let prisma: PrismaClient;

beforeAll(async () => {
  const prismaModule = await import("../lib/prisma");
  prisma = prismaModule.prisma;

  const appModule = await import("../index");
  app = appModule.default;
});
```

## Troubleshooting

### Tests Hanging

**Solution**: Force exit after timeout
```bash
npm test -- --forceExit
```

### Tests Pass Locally, Fail in CI

**Causes**:
- Different Node.js version
- Missing environment variables
- Service not running

**Solution**: Check CI logs and match local environment to CI

### Flaky Tests

**Causes**:
- Race conditions
- Insufficient timeouts
- Shared state between tests

**Solution**:
- Add `await` for async operations
- Increase test timeout
- Clean up properly in afterEach

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Supertest](https://github.com/visionmedia/supertest)
- [CI/CD Docs](docs/CI-CD.md)
- [Test Status Report](docs/TEST-STATUS.md)

## Getting Help

1. Check [TEST-STATUS.md](docs/TEST-STATUS.md) for known issues
2. Review test logs in CI
3. Run tests locally with `--verbose`
4. Check environment configuration

---

*For detailed CI/CD setup, see [docs/CI-CD.md](docs/CI-CD.md)*
