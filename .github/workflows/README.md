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
| **Link Check** | `link-check.yml` | Weekly cron, manual, PRs touching `link-check/**` | External links still resolve | <1 min |

## Jobs per Workflow

- **`ci.yml`**: Lint & Type Check (Biome + tsc, OS matrix) → Unit Tests (Vitest + coverage) → Build Verification → Workers CI (tsc + tests + wrangler dry-run) → Security (npm audit) → `ci-success` gate
- **`pr-checks.yml`**: PR validation (title format, merge conflicts), code quality (Biome), test coverage (PR comment), changed-files analysis, bundle size, summary
- **`security.yml`**: CodeQL, dependency scan (npm audit), OWASP CVE check, secret scan (TruffleHog), license check, summary
- **`deploy.yml`**: Vite build → GitHub Pages deploy (concurrency-gated on the `pages` group)
- **`link-check.yml`**: HEAD-requests every external URL in `link-check/external-links.test.ts`. Deliberately *not* in the unit suite — it makes real network calls, and an `ECONNRESET` against someone else's host once reddened an unrelated PR. On a cron failure it opens (or comments on) a `link-check`-labelled issue, since there is no PR to annotate

Workflows with `workflow_dispatch` (e2e, security, deploy, link-check) can be run manually from the Actions tab.

Two trigger details worth knowing:

- `pr-checks.yml` includes `edited` in its `pull_request` types. Without it, retitling a PR never re-runs the conventional-commit title check, so a corrected title stays red until an unrelated push.
- A PR with merge conflicts runs **no** `pull_request` workflows at all — GitHub cannot build the merge ref — and shows "no checks reported" rather than a failure. Resolve the conflict to get checks.

All actions are pinned to majors running Node 24; Node 20 was deprecated on GitHub runners in September 2025.

## Required Secrets

| Secret | Required | Purpose |
|--------|----------|---------|
| `DOPPLER_TOKEN_PROD` | Yes | Access Doppler secrets (prd config) — provides `VITE_API_URL`, `CLOUDFLARE_D1_TOKEN` at build time |
| `CODECOV_TOKEN` | No | Upload coverage to Codecov |

---

*The detailed CI/CD guide (`docs/archive/CI-CD.md`) was deleted 2026-08-06; see git history if needed.*
