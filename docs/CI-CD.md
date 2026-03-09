# CI/CD Pipeline Documentation

Continuous Integration and Deployment pipeline for the TCAD Scraper project.

## Overview

The project uses GitHub Actions for automated testing and deployment. Workflows are in `.github/workflows/`.

## Workflows

### 1. Deploy (`deploy.yml`)

**Trigger**: Push to `main` branch, or manual dispatch

**Custom Domain**: `alephatx.info` (configured via CNAME file + GitHub Pages settings)

**Jobs**:

#### Build
- Installs Node.js and dependencies
- Runs `npm rebuild` to ensure platform-specific native modules (e.g., rollup) are available
- Installs Doppler CLI for secrets
- Fetches `VITE_API_URL` from Doppler (baked into bundle at build time)
- Installs server dependencies for Prisma client (build-time constant generation)
- Builds frontend with Vite (`base: "/"` for root domain deployment)
- Uploads static assets

#### Deploy
- Deploys to GitHub Pages at `alephatx.info`
- API served separately via Render at `api.alephatx.info`

**Secrets Required**:
- `DOPPLER_TOKEN`: Doppler secrets access (provides `VITE_API_URL`, `DATABASE_URL`)

**Permissions**:
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

---

### 2. Integration Tests (`integration-tests.yml`)

**Trigger**:
- Nightly at 3 AM UTC (scheduled)
- Push to `main` branch (when server code changes)
- Pull requests with the `run-integration-tests` label
- Manual workflow dispatch (with optional debug mode)

**Purpose**: Runs comprehensive integration tests that require full service stack. Separated from local unit tests to keep CI fast while ensuring thorough testing.

**Jobs**:

#### Check Trigger Conditions
- Determines if tests should run based on trigger type
- For PRs, only runs when labeled with `run-integration-tests`
- Always runs for scheduled, manual, and push events

#### Integration Tests
- Runs full integration test suite with Vitest
- Uses PostgreSQL 16 and Redis 7 service containers
- Tests full system behavior with real dependencies
- Runs database migrations and optional seeding
- Set `RUN_INTEGRATION_TESTS=true` environment variable

**Test Suites**:
- API integration tests (`api.test.ts`)
- Database integration tests (`auth-database.integration.test.ts`)
- Queue integration tests (`enqueue.test.ts`)
- Route integration tests (`routes/__tests__/*.test.ts`)

**How to Trigger**:

1. **Automatic (Nightly)**: Runs every night at 3 AM UTC
2. **On Push**: Automatically runs when server code changes on `main`
3. **For PRs**: Add the `run-integration-tests` label to any PR
4. **Manual**: Use "Run workflow" button in GitHub Actions tab

**Environment Variables Required**:
```yaml
RUN_INTEGRATION_TESTS: 'true'
NODE_ENV: test
DATABASE_URL: postgresql://user:pass@localhost:5432/db
DATABASE_READ_ONLY_URL: postgresql://user:pass@localhost:5432/db
REDIS_URL: redis://localhost:6379
SENTRY_DSN: ""
CLAUDE_API_KEY: "test-key"
```

**Runtime**: ~10-15 minutes (longer than unit tests)

---

## Test Suite

### Test Structure

```
server/src/__tests__/
├── setup.ts                           # Test environment setup
├── security.test.ts                   # Security tests
├── integration.test.ts                # Integration tests
├── enqueue.test.ts                    # Queue tests
├── auth-database.connection.test.ts   # DB connection tests
├── auth-database.integration.test.ts  # Auth integration tests
├── api.test.ts                        # API endpoint tests
└── controller.test.ts                 # Controller unit tests
```

### Running Tests Locally

**All tests**:
```bash
cd server
npm test
```

**With coverage**:
```bash
npm run test:coverage
```

**Watch mode**:
```bash
npm run test:watch
```

**Specific test suites**:
```bash
npm run test:security          # Security tests
npm run test:auth-db          # Auth database tests
npm run test:enqueue          # Queue tests
```

### Test Coverage Goals

- **Line Coverage**: 70%+
- **Branch Coverage**: 65%+
- **Function Coverage**: 70%+
- **Statement Coverage**: 70%+

Coverage reports are generated in `server/coverage/` directory.

---

## Required Secrets

Configure these secrets in GitHub repository settings:

### Required
- `DOPPLER_TOKEN`: Access to Doppler secrets management

### Optional
- `CODECOV_TOKEN`: Upload coverage to Codecov

---

## Branch Model

**Single branch**: `main`

All development merges directly to `main`. Feature branches are created from `main` and merged back via PR.

### Pull Request Process

1. Create feature branch from `main`
2. Make changes and commit
3. Push branch and create PR
4. Wait for workflow checks to pass
5. Request review if needed
6. Merge when approved

---

## GitHub Actions Configuration

### Service Dependencies

Integration tests use Docker containers for services:

**PostgreSQL 16**:
```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_DB: tcad_scraper_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
```

**Redis 7**:
```yaml
services:
  redis:
    image: redis:7-alpine
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 6379:6379
```

### Caching

GitHub Actions caches npm dependencies:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

---

## Local Testing

Before pushing, run tests locally:

```bash
# Install dependencies
cd server && npm ci

# Run linting
npm run lint

# Run type checking
npx tsc --noEmit

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

---

## Debugging Failed Workflows

### View Logs

1. Go to Actions tab
2. Click failed workflow
3. Click failed job
4. Expand failed step
5. Review error messages

### Re-run Failed Jobs

Click "Re-run failed jobs" button to retry without re-running successful jobs.

### Enable Debug Logging

Add these secrets to enable verbose logging:
- `ACTIONS_STEP_DEBUG`: `true`
- `ACTIONS_RUNNER_DEBUG`: `true`

---

## Maintenance

### Regular Updates

- **Monthly**: Update dependencies (`npm update`)
- **Quarterly**: Review and optimize workflows, update action versions

---

## Resources

### Documentation
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Vitest Documentation](https://vitest.dev/)
- [Codecov Documentation](https://docs.codecov.com/)

### Tools
- [Supertest API](https://github.com/visionmedia/supertest)

---

*Last Updated: 2026-03-09*
