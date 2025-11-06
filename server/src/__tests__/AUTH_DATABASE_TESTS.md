# Authentication-Database Integration Test Suite

Comprehensive test suite for validating the authentication connection between the production UI and PostgreSQL database layer.

## Overview

This test suite ensures that the authentication system properly integrates with the database layer, verifying:
- Database connectivity and connection pooling
- JWT token validation
- Authenticated API requests
- Database operations (read/write)
- Transaction integrity
- Error handling
- Performance under load

## Test Files

### 1. `auth-database.connection.test.ts`
Tests the PostgreSQL database connection layer using Prisma ORM.

**Coverage:**
- ✅ Prisma client initialization (write and read-only clients)
- ✅ Database connectivity
- ✅ Schema validation (Property, ScrapeJob, MonitoredSearch tables)
- ✅ Read/write client separation
- ✅ Connection error handling
- ✅ Transaction support (commit and rollback)
- ✅ Connection pooling and concurrent queries
- ✅ Data type handling (dates, numbers, strings with special characters)

### 2. `auth-database.integration.test.ts`
Tests the complete flow from authenticated API requests through to database operations.

**Coverage:**
- ✅ API authentication with database reads (stats, search)
- ✅ API authentication with database writes (scrape job creation)
- ✅ Token validation (valid, expired, malformed)
- ✅ Optional authentication endpoints
- ✅ Job status retrieval
- ✅ Concurrent authenticated requests
- ✅ Database transaction integrity
- ✅ SQL injection prevention
- ✅ Rate limiting with authentication
- ✅ User context population
- ✅ Connection pool management under load

## Prerequisites

### Database Setup
Ensure PostgreSQL is running and configured:

```bash
# Check if PostgreSQL is running
pg_isready

# Connect to database
psql -U postgres -d tcad_scraper
```

### Environment Variables
Required environment variables in `.env` or Doppler:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/tcad_scraper"
DATABASE_READ_ONLY_URL="postgresql://user:password@localhost:5432/tcad_scraper" # Optional

# Authentication
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
AUTH_SKIP_IN_DEVELOPMENT="true" # Optional for dev

# Optional for full integration testing
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

### Database Schema
Ensure Prisma migrations are applied:

```bash
cd server
npm run prisma:generate
npm run prisma:migrate
```

## Running the Tests

### Run All Tests
```bash
cd server
npm test
```

### Run Only Auth-Database Tests
```bash
# Run both connection and integration tests
npm test -- auth-database

# Run only connection tests
npm test -- auth-database.connection.test.ts

# Run only integration tests
npm test -- auth-database.integration.test.ts
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode (for development)
```bash
npm run test:watch -- auth-database
```

### Verbose Output
```bash
npm test -- auth-database --verbose
```

## Test Categories

### Database Connection Tests

#### Basic Connectivity
- Tests Prisma client initialization
- Verifies database connection
- Validates schema existence

#### Read/Write Separation
- Tests read-only client for queries
- Tests write client for mutations
- Verifies data consistency across clients

#### Transaction Support
- Tests transaction commits
- Tests transaction rollbacks
- Verifies ACID properties

#### Performance
- Tests concurrent query handling
- Validates connection pool reuse
- Measures query performance

### Authentication-Database Integration Tests

#### Unauthenticated Requests
- Tests optional auth endpoints without tokens
- Verifies database access for public endpoints

#### Authenticated Requests
- Tests endpoints with valid JWT tokens
- Validates user context population
- Tests database operations with authentication

#### Token Validation
- Tests with valid tokens
- Tests with expired tokens
- Tests with malformed tokens
- Tests missing Authorization header

#### Database Operations
- Tests read operations (stats, search, job status)
- Tests write operations (scrape job creation)
- Validates data integrity

#### Error Handling
- Tests database error scenarios
- Validates SQL injection prevention
- Tests malformed request handling

#### Rate Limiting
- Tests rate limit enforcement
- Validates per-user rate limiting
- Tests concurrent request throttling

#### Load Testing
- Tests burst of authenticated requests
- Validates connection pool under load
- Measures response times

## Expected Test Results

### Success Criteria
- ✅ All database connections succeed
- ✅ Valid JWT tokens are accepted
- ✅ Database operations complete successfully
- ✅ Transactions maintain integrity
- ✅ No SQL injection vulnerabilities
- ✅ Connection pooling works correctly
- ✅ Rate limiting functions properly

### Known Limitations
- Some tests may return 500 if Redis is not running (queue operations)
- Rate limiting tests depend on timing and may vary
- Performance tests are environment-dependent

## Test Data Cleanup

All tests clean up after themselves by:
- Deleting test properties (searchTerm starts with `test-auth-`)
- Deleting test scrape jobs
- Disconnecting Prisma clients

To manually clean test data:
```sql
DELETE FROM "Property" WHERE "searchTerm" LIKE 'test-auth-%';
DELETE FROM "ScrapeJob" WHERE "searchTerm" LIKE 'test-auth-%';
```

## Debugging Failed Tests

### Database Connection Failures
```bash
# Check PostgreSQL status
pg_isready

# Check database exists
psql -U postgres -l | grep tcad_scraper

# Check connection string
echo $DATABASE_URL
```

### Authentication Failures
```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET

# Check token generation
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({id: 'test'}, process.env.JWT_SECRET));"
```

### Prisma Issues
```bash
# Regenerate Prisma client
cd server
npm run prisma:generate

# Check migration status
npx prisma migrate status

# View database schema
npx prisma studio
```

### Test Isolation Issues
If tests interfere with each other:
```bash
# Run tests sequentially
npm test -- --runInBand auth-database
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Test Auth-Database Integration

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: tcad_scraper
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: ./server
        run: npm install

      - name: Setup database
        working-directory: ./server
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/tcad_scraper
        run: |
          npm run prisma:generate
          npx prisma migrate deploy

      - name: Run tests
        working-directory: ./server
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/tcad_scraper
          JWT_SECRET: test-secret-key
          NODE_ENV: test
        run: npm test -- auth-database
```

## Performance Benchmarks

Expected performance metrics (on typical development machine):

| Test Category | Expected Duration | Notes |
|--------------|------------------|-------|
| Connection Tests | < 5 seconds | Basic connectivity |
| Integration Tests | < 30 seconds | Full API testing |
| Load Tests (20 concurrent) | < 10 seconds | Connection pooling |
| Single Query | < 100ms | With warm connection |

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to database"
**Solution:**
```bash
# Start PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql # Linux

# Verify connection
psql -U postgres
```

#### 2. "Prisma Client is not generated"
**Solution:**
```bash
cd server
npm run prisma:generate
```

#### 3. "JWT_SECRET is not defined"
**Solution:**
```bash
# Add to .env file
echo 'JWT_SECRET=your-test-secret' >> server/.env

# Or export temporarily
export JWT_SECRET=your-test-secret
```

#### 4. "Table does not exist"
**Solution:**
```bash
cd server
npm run prisma:migrate
```

#### 5. "Tests timing out"
**Solution:**
```bash
# Increase timeout in jest.config.js
# testTimeout: 30000

# Or run specific test
npm test -- auth-database.connection.test.ts --testTimeout=30000
```

## Contributing

When adding new authentication or database features:

1. **Add corresponding tests** to the appropriate test file
2. **Update this documentation** with new test coverage
3. **Run full test suite** before committing:
   ```bash
   npm run test:coverage
   ```
4. **Ensure cleanup** of any test data created

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing/integration-testing)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

## Test Coverage Goals

Current coverage targets:
- **Database Connection:** 95%+ coverage
- **Authentication Middleware:** 90%+ coverage
- **API Routes:** 85%+ coverage
- **Integration Flows:** 80%+ coverage

Check current coverage:
```bash
npm run test:coverage
```

## Support

For issues or questions:
1. Check this documentation
2. Review test output for specific error messages
3. Check the main project README
4. Consult the Prisma and Express documentation
