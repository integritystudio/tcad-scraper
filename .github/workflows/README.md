# GitHub Actions Workflows

This directory contains all CI/CD workflows for the TCAD Scraper project.

## Workflows Overview

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **CI Pipeline** | `ci.yml` | Push, PR | Runs tests, linting, builds |
| **Integration Tests** | `integration-tests.yml` | Nightly, Manual, Label | Full integration & E2E tests |
| **PR Checks** | `pr-checks.yml` | PRs | PR-specific validation |
| **Security Scanning** | `security.yml` | Push, PR, Schedule | Security scans |
| **Deployment** | `deploy.yml` | Push to main | Deploy to GitHub Pages |

## Quick Reference

### CI Pipeline (`ci.yml`)

Fast test and build pipeline with 6 jobs:

1. **Lint & Type Check** - Code quality validation (multi-platform)
2. **Unit Tests** - Jest unit tests with coverage
3. **Cross-Platform Tests** - Compatibility tests on Ubuntu, macOS, Windows
4. **Build Verification** - Frontend and backend builds (multi-platform)
5. **Security Checks** - npm audit and security tests
6. **Dependency Review** - PR dependency validation

**Runtime**: ~6-8 minutes

### Integration Tests (`integration-tests.yml`)

Comprehensive integration and E2E test suite:

1. **Check Trigger** - Validates if tests should run
2. **Integration Tests** - Full system tests with real services
3. **E2E Tests** - End-to-end user workflow tests (when available)

**Trigger**:
- Nightly at 3 AM UTC (automatic)
- Push to main when server code changes
- PRs with `run-integration-tests` label
- Manual via "Run workflow" button

**Runtime**: ~10-15 minutes

**Features**:
- Uses PostgreSQL 16 and Redis 7 service containers
- Runs database migrations and seeding
- Generates separate integration coverage
- Optional debug mode for troubleshooting

### PR Checks (`pr-checks.yml`)

PR-specific validation and reporting:

1. **PR Validation** - Title format, merge conflicts
2. **Code Quality** - ESLint, Prettier
3. **Test Coverage** - Coverage report with PR comment
4. **Changed Files** - Analyze affected areas
5. **Bundle Size** - Frontend bundle size check

**Runtime**: ~5-8 minutes

### Security Scanning (`security.yml`)

Comprehensive security analysis:

1. **CodeQL** - Static code analysis
2. **Dependency Scan** - npm audit
3. **OWASP Check** - Known CVEs
4. **Secret Scan** - TruffleHog
5. **Docker Scan** - Trivy image scan
6. **Security Tests** - Dedicated test suite
7. **License Check** - License compliance

**Runtime**: ~15-20 minutes (scheduled scans only)

### Deployment (`deploy.yml`)

Frontend deployment to GitHub Pages:

1. **Build** - Build frontend with Vite
2. **Deploy** - Deploy to GitHub Pages

**Runtime**: ~3-5 minutes

## Workflow Status

Check workflow status:
- [Actions Tab](../../actions)
- Status badges (add to README)

## Common Tasks

### Manually Trigger Workflow

Several workflows can be triggered manually:

**Security Scanning**:
1. Go to Actions tab
2. Select "Security Scanning"
3. Click "Run workflow"
4. Choose branch and run

**Integration Tests**:
1. Go to Actions tab
2. Select "Integration Tests"
3. Click "Run workflow"
4. Optionally enable debug mode
5. Choose branch and run

**PR Integration Tests** (without manual trigger):
- Add the `run-integration-tests` label to any PR

### View Workflow Logs

1. Go to Actions tab
2. Click on workflow run
3. Click on job name
4. Expand steps to view logs

### Download Artifacts

Workflows upload artifacts for debugging:
1. Go to workflow run
2. Scroll to "Artifacts" section
3. Download desired artifact

## Configuration

### Required Secrets

Add these in repository settings:

| Secret | Required | Purpose |
|--------|----------|---------|
| `DOPPLER_TOKEN` | Yes | Access Doppler secrets |
| `CODECOV_TOKEN` | No | Upload coverage to Codecov |

### Environment Variables

Workflows use these test environment variables:
- `NODE_ENV=test`
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_HOST=localhost`
- `REDIS_PORT=6379`
- `CLAUDE_API_KEY=test-key`

## Development

### Testing Workflow Changes

Always test workflow changes in a feature branch before merging to main.

### Workflow Syntax

Validate syntax using:
```bash
# Install act (local GitHub Actions runner)
brew install act

# Test workflow locally
act -l  # List workflows
act push  # Run push event workflows
```

### Best Practices

1. **Keep workflows DRY** - Use reusable workflows for common tasks
2. **Use caching** - Cache npm packages to speed up runs
3. **Fail fast** - Set `fail-fast: true` in matrix builds
4. **Meaningful names** - Use descriptive job and step names
5. **Concurrency** - Cancel in-progress runs when new commits pushed

## Troubleshooting

### Workflow Not Triggering

- Check trigger conditions in `on:` section
- Verify branch names match
- Check if workflow is disabled

### Tests Failing in CI

- Check service container health
- Verify environment variables
- Review detailed logs
- Download coverage artifact

### Permission Errors

- Check workflow permissions
- Verify required secrets exist
- Check branch protection rules

## Monitoring

### Notifications

Configure notifications in GitHub settings:
- Settings → Notifications → Actions
- Enable email for workflow failures

### Slack Integration (Optional)

Add Slack notifications by setting `SLACK_WEBHOOK` secret.

## Resources

- [Complete CI/CD Documentation](../../docs/CI-CD.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)

## Support

For workflow issues:
1. Check [CI/CD Documentation](../../docs/CI-CD.md)
2. Review workflow logs
3. Open issue with `ci` label
4. Tag @devops team

---

*For detailed information, see [docs/CI-CD.md](../../docs/CI-CD.md)*
