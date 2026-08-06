# GitHub Actions Workflows

CI/CD workflows for the TCAD Scraper project.

## Workflows Overview

| Workflow | File | Trigger | Purpose | Runtime |
|----------|------|---------|---------|---------|
| **CI Pipeline** | `ci.yml` | Push, PR | Tests, linting, builds | ~6-8 min |
| **E2E Tests** | `e2e.yml` | Push, PR, manual | Playwright end-to-end tests | — |
| **PR Checks** | `pr-checks.yml` | PRs | PR-specific validation | ~5-8 min |
| **Security Scanning** | `security.yml` | Push, PR, schedule, manual | Security scans | ~15-20 min |
| **Deployment** | `deploy.yml` | Push to main, manual | Deploy frontend to GitHub Pages | ~3-5 min |

## Jobs per Workflow

- **`ci.yml`**: Lint & Type Check (Biome + tsc, OS matrix) → Unit Tests (Vitest + coverage) → Build Verification → Workers CI (tsc + tests + wrangler dry-run) → Security (npm audit) → `ci-success` gate
- **`pr-checks.yml`**: PR validation (title format, merge conflicts), code quality (Biome), test coverage (PR comment), changed-files analysis, bundle size, summary
- **`security.yml`**: CodeQL, dependency scan (npm audit), OWASP CVE check, secret scan (TruffleHog), license check, summary
- **`deploy.yml`**: Vite build → GitHub Pages deploy (concurrency-gated on the `pages` group)

Workflows with `workflow_dispatch` (e2e, security, deploy) can be run manually from the Actions tab.

## Required Secrets

| Secret | Required | Purpose |
|--------|----------|---------|
| `DOPPLER_TOKEN_PROD` | Yes | Access Doppler secrets (prd config) — provides `VITE_API_URL`, `CLOUDFLARE_D1_TOKEN` at build time |
| `CODECOV_TOKEN` | No | Upload coverage to Codecov |

---

*The detailed CI/CD guide (`docs/archive/CI-CD.md`) was deleted 2026-08-06; see git history if needed.*
