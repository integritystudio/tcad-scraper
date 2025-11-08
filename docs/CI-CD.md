# CI/CD Pipeline Documentation

Comprehensive Continuous Integration and Continuous Deployment pipeline for the TCAD Scraper project.

## Overview

The project uses GitHub Actions for automated testing, security scanning, and deployment. The CI/CD pipeline ensures code quality, security, and reliability before deployment.

## Workflows

### 1. CI Pipeline (`ci.yml`)

**Trigger**: Push to `main`/`develop` branches, and all pull requests

**Jobs**:

#### Lint and Type Check
- Runs ESLint on root and server code
- Performs TypeScript type checking
- Ensures code quality standards

#### Unit Tests
- Runs Jest unit tests with coverage
- Uses PostgreSQL 16 and Redis 7 services
- Generates and uploads coverage reports
- Uploads to Codecov (optional)

#### Cross-Platform Compatibility Tests
- Tests on Ubuntu, macOS, and Windows
- Runs unit tests without database dependencies
- Ensures cross-platform compatibility

#### Build Verification
- Builds frontend (Vite)
- Builds backend (TypeScript)
- Generates Prisma client
- Uploads build artifacts

#### Security Checks
- Runs `npm audit` on dependencies
- Executes security test suite
- Continues on non-critical failures

#### Dependency Review (PR only)
- Reviews new dependencies
- Checks for known vulnerabilities
- Fails on moderate+ severity issues

#### CI Success
- Summary job that checks all results
- Fails if any critical job fails
- Posts success/failure status

**Environment Variables Required**:
```yaml
NODE_ENV: test
DATABASE_URL: postgresql://user:pass@localhost:5432/db
DATABASE_READ_ONLY_URL: postgresql://user:pass@localhost:5432/db
REDIS_HOST: localhost
REDIS_PORT: 6379
SENTRY_DSN: "" (empty for tests)
CLAUDE_API_KEY: "test-key"
```

---

### 2. PR Checks (`pr-checks.yml`)

**Trigger**: Pull request opened, synchronized, reopened, or marked ready for review

**Jobs**:

#### PR Validation
- Checks PR title format (Conventional Commits)
- Detects merge conflicts
- Validates branch status

**Supported PR Title Formats**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Test additions/changes
- `build:` - Build system changes
- `ci:` - CI/CD changes
- `chore:` - Other changes
- `revert:` - Revert previous commit

#### Code Quality Analysis
- Runs ESLint with annotations
- Checks code formatting with Prettier
- Reports formatting issues

#### Test Coverage Report
- Generates coverage report
- Posts coverage percentage as PR comment
- Updates comment on subsequent pushes

#### Changed Files Analysis
- Detects which areas of codebase changed:
  - 🔧 Server/Backend
  - 🎨 Frontend
  - 📚 Documentation
  - ⚙️ CI/CD Workflows
  - 📦 Dependencies
  - 🗄️ Database Schema
  - 🧪 Tests

#### Bundle Size Check
- Analyzes frontend bundle size
- Posts size as PR comment
- Warns if size is excessive

#### PR Summary
- Aggregates all check results
- Provides at-a-glance status
- Fails PR if critical checks fail

---

### 3. Integration Tests (`integration-tests.yml`)

**Trigger**:
- Nightly at 3 AM UTC (scheduled)
- Push to `main` branch (when server code changes)
- Pull requests with the `run-integration-tests` label
- Manual workflow dispatch (with optional debug mode)

**Purpose**: Runs comprehensive integration and E2E tests that require full service stack. Separated from main CI pipeline to keep CI fast while ensuring thorough testing.

**Jobs**:

#### Check Trigger Conditions
- Determines if tests should run based on trigger type
- For PRs, only runs when labeled with `run-integration-tests`
- Always runs for scheduled, manual, and push events

#### Integration Tests
- Runs full integration test suite with Playwright
- Uses PostgreSQL 16 and Redis 7 service containers
- Tests full system behavior with real dependencies
- Runs database migrations and optional seeding
- Generates and uploads integration coverage reports
- Uploads to Codecov with `integration` flag
- Set `RUN_INTEGRATION_TESTS=true` environment variable

**Test Suites**:
- API integration tests (`api.test.ts`)
- Database integration tests (`auth-database.integration.test.ts`)
- Queue integration tests (`enqueue.test.ts`)
- Route integration tests (`routes/__tests__/*.test.ts`)
- Security integration tests (`security.test.ts`)

#### E2E Tests (Optional)
- Placeholder for future end-to-end tests
- Automatically detects if E2E test directory exists
- Runs full user workflow tests if present
- Skips gracefully if no E2E tests found

#### Integration Success
- Summary job that validates all integration tests passed
- Provides comprehensive test results

**How to Trigger**:

1. **Automatic (Nightly)**: Runs every night at 3 AM UTC
2. **On Push**: Automatically runs when server code changes on `main`
3. **For PRs**: Add the `run-integration-tests` label to any PR
4. **Manual**: Use "Run workflow" button in GitHub Actions tab
   - Optional: Enable debug mode for interactive troubleshooting

**Environment Variables Required**:
```yaml
RUN_INTEGRATION_TESTS: 'true'
NODE_ENV: test
DATABASE_URL: postgresql://user:pass@localhost:5432/db
DATABASE_READ_ONLY_URL: postgresql://user:pass@localhost:5432/db
REDIS_HOST: localhost
REDIS_PORT: 6379
SENTRY_DSN: ""
CLAUDE_API_KEY: "test-key"
```

**Runtime**: ~10-15 minutes (longer than unit tests)

**Coverage**: Integration coverage uploaded separately from unit coverage

---

### 4. Security Scanning (`security.yml`)

**Trigger**:
- Push to `main`/`develop`
- Pull requests
- Daily at 2 AM UTC (scheduled)
- Manual workflow dispatch

**Jobs**:

#### CodeQL Security Analysis
- Scans JavaScript and TypeScript code
- Detects security vulnerabilities
- Uses extended security queries
- Uploads results to GitHub Security tab

#### Dependency Vulnerability Scanning
- Runs `npm audit` on root and server
- Generates JSON reports
- Uploads audit artifacts
- Continues on non-critical issues

#### OWASP Dependency Check
- Comprehensive dependency analysis
- Checks for known CVEs
- Generates HTML reports
- Fails on CVSS 7+ vulnerabilities

#### Secret Scanning
- Uses TruffleHog to detect secrets
- Scans entire git history
- Only reports verified secrets
- Prevents credential leaks

#### Docker Image Scanning
- Builds Docker image
- Scans with Trivy vulnerability scanner
- Detects OS and application vulnerabilities
- Uploads SARIF results to GitHub Security
- Runs on push and scheduled scans

#### Security Test Suite
- Runs dedicated security tests
- Tests authentication, authorization
- Checks for common vulnerabilities
- Located in `server/src/__tests__/security.test.ts`

#### License Compliance Check
- Scans all dependencies for licenses
- Generates license report
- Ensures compliance with project policies

#### Security Summary
- Aggregates all security scan results
- Fails on critical security issues
- Posts comprehensive summary

---

### 5. Deployment (`deploy.yml`)

**Trigger**: Push to `main` branch, or manual dispatch

**Jobs**:

#### Build
- Installs Node.js and dependencies
- Installs Doppler CLI for secrets
- Fetches API URL from Doppler
- Builds frontend with Vite
- Uploads static assets

#### Deploy
- Deploys to GitHub Pages
- Serves frontend application
- Uses GitHub Pages environment

**Secrets Required**:
- `DOPPLER_TOKEN`: Doppler secrets access

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
├── api.test.ts                        # API endpoint tests (NEW)
└── controller.test.ts                 # Controller unit tests (NEW)
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
- `SLACK_WEBHOOK`: Notify team of build status

---

## Branch Protection Rules

Recommended branch protection for `main`:

### Required Status Checks
- ✅ Lint & Type Check
- ✅ Unit Tests
- ✅ Integration Tests
- ✅ Build Verification
- ✅ Security Checks

### Additional Settings
- ✅ Require pull request reviews (1+ approvals)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Require conversation resolution
- ✅ Require signed commits (optional)
- ✅ Include administrators

---

## GitHub Actions Configuration

### Service Dependencies

The CI uses Docker containers for services:

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

This significantly speeds up workflow runs.

---

## Artifacts

### Uploaded Artifacts

All workflows upload artifacts for debugging:

| Artifact | Retention | Description |
|----------|-----------|-------------|
| `coverage-report` | 7 days | HTML coverage report |
| `build-artifacts` | 7 days | Compiled frontend & backend |
| `npm-audit-reports` | 30 days | Security audit JSON |
| `owasp-dependency-check-report` | 30 days | OWASP HTML report |
| `trivy-security-report` | 30 days | Docker scan results |
| `license-report` | 30 days | License compliance JSON |

### Accessing Artifacts

1. Go to Actions tab in GitHub
2. Click on a workflow run
3. Scroll to "Artifacts" section
4. Download desired artifact

---

## Workflow Permissions

Each workflow has specific permissions:

### CI Pipeline
```yaml
permissions:
  contents: read
  checks: write
```

### PR Checks
```yaml
permissions:
  contents: read
  pull-requests: write
  checks: write
```

### Security Scanning
```yaml
permissions:
  contents: read
  security-events: write
  actions: read
```

### Deployment
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

---

## Debugging Failed Workflows

### View Logs

1. Go to Actions tab
2. Click failed workflow
3. Click failed job
4. Expand failed step
5. Review error messages

### Download Artifacts

Failed runs still upload artifacts for debugging.

### Re-run Failed Jobs

Click "Re-run failed jobs" button to retry without re-running successful jobs.

### Enable Debug Logging

Add these secrets to enable verbose logging:
- `ACTIONS_STEP_DEBUG`: `true`
- `ACTIONS_RUNNER_DEBUG`: `true`

---

## Performance Optimization

### Parallel Jobs

Jobs run in parallel when possible:
- Lint/typecheck runs independently
- Unit and integration tests run separately
- Security scans run in parallel

### Caching Strategy

- **npm packages**: Cached between runs
- **Docker layers**: Cached for image builds
- **Prisma client**: Generated once per run

### Workflow Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Cancels in-progress runs when new commits are pushed.

---

## Local Testing

### Run Tests Locally

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

### Docker Compose for Services

Start services locally:

```bash
docker-compose up -d postgres redis
```

Stop services:

```bash
docker-compose down
```

---

## Monitoring and Notifications

### GitHub Checks

All workflows report status as GitHub Checks on PRs.

### Email Notifications

GitHub sends emails for workflow failures (configurable in settings).

### Slack Integration (Optional)

Add Slack webhook for notifications:

```yaml
- name: Slack Notification
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "❌ CI failed for ${{ github.repository }}"
      }
```

---

## Best Practices

### Commit Messages

Use Conventional Commits format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Example:
```
feat(api): add natural language search endpoint

Implements Claude AI-powered natural language search for properties.
Includes caching and rate limiting.

Closes #123
```

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes and commit
3. Push branch and create PR
4. Wait for CI checks to pass
5. Request review from team
6. Address review feedback
7. Merge when approved and CI passes

### Security

- Never commit secrets or credentials
- Use Doppler for environment variables
- Review security scan results regularly
- Update dependencies frequently

---

## Troubleshooting

### Tests Fail Locally But Pass in CI

- Check Node.js version matches CI (v20)
- Ensure services (Postgres, Redis) are running
- Check environment variables

### Tests Pass Locally But Fail in CI

- CI uses clean environment
- Check for hardcoded paths or assumptions
- Review CI logs for environment differences

### Build Failures

- Check TypeScript errors
- Verify all dependencies installed
- Check for missing environment variables

### Security Scan Failures

- Review vulnerability details
- Update vulnerable packages
- Add exceptions if false positive (with justification)

---

## Maintenance

### Regular Updates

- **Weekly**: Review security scan results
- **Monthly**: Update dependencies (`npm update`)
- **Quarterly**: Review and optimize workflows

### Dependency Updates

```bash
# Check for outdated packages
npm outdated

# Update packages
npm update

# For major version updates
npm install package@latest
```

### Workflow Updates

- Monitor GitHub Actions changelog
- Update action versions quarterly
- Test workflow changes in feature branches

---

## Resources

### Documentation
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Jest Documentation](https://jestjs.io/)
- [Supertest API](https://github.com/visionmedia/supertest)
- [Codecov Documentation](https://docs.codecov.com/)

### Tools
- [CodeQL](https://codeql.github.com/)
- [Trivy](https://aquasecurity.github.io/trivy/)
- [TruffleHog](https://github.com/trufflesecurity/trufflehog)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)

---

## Summary

The TCAD Scraper CI/CD pipeline provides:

✅ Automated testing on every push and PR
✅ Comprehensive security scanning
✅ Code quality enforcement
✅ Build verification
✅ Automated deployment to GitHub Pages
✅ Detailed coverage and security reports
✅ PR validation and feedback

This ensures high code quality, security, and reliability throughout the development lifecycle.

---

*Last Updated: 2025-01-07*
