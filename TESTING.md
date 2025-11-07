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
  "name": "Jest Debug",
  "program": "${workspaceFolder}/server/node_modules/.bin/jest",
  "args": ["--runInBand", "--testPathPattern=${relativeFile}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Writing Tests

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

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

### Mocking Example

```typescript
jest.mock('../lib/external-service');

import { externalService } from '../lib/external-service';

const mockService = externalService as jest.MockedFunction<typeof externalService>;
mockService.mockResolvedValue({ data: 'mocked' });
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

- [Jest Documentation](https://jestjs.io/)
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
