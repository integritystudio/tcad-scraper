# TCAD Scraper

A production-grade web scraping system for automated collection of property tax information from the Travis Central Appraisal District (TCAD) website. Built with TypeScript, Cloudflare Workers (Hono), Prisma, and Cloudflare D1 (SQLite at the edge) with a workflow-based architecture for scalable data collection.

> **March 2026**: Full Cloudflare migration complete. API: Workers/Hono/Workflows. Database: D1 (SQLite, replacing PostgreSQL/Render/Hyperdrive). See [changelog/2026-03-30.md](docs/changelog/2026-03-30.md).

## Table of Contents

- [Quick Start](#quick-start-enqueueing-scrape-jobs)
- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Monitoring & Metrics](#monitoring--metrics)
- [Analytics](#analytics)
- [Troubleshooting](#troubleshooting)
- [Known Issues](#known-issues-and-limitations)
- [Documentation](#documentation)

## Quick Start: Enqueueing Scrape Jobs

```bash
# Single term via the Workers API
curl -X POST "https://api.alephatx.info/api/properties/scrape" \
  -H "Content-Type: application/json" -H "x-api-key: $TCAD_API_KEY" \
  -d '{"searchTerm": "Smith"}'

# Generate and enqueue the next 200 candidate terms
doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue

# Enqueue "tail" terms (low-yield, novel discovery); add --phase N for one phase
TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts
```

Queue status: `cd workers/tcad-api && npx wrangler queues list`. Backfill strategy and operations: [docs/SEARCH_TERMS.md](docs/SEARCH_TERMS.md). Scripts inventory: [scripts/README.md](scripts/README.md).

## Overview

TCAD Scraper automates the collection and storage of property tax data from travis.prodigycad.com, with a REST API and React frontend for accessing the data. Scraping is **API-direct** — HTTP calls straight to the TCAD backend API (1000+ results per search) with automatic token refresh — and runs continuously with intelligent, weighted search term generation to catalog properties across Travis County.

## Key Features

- **API-direct scraping** with automatic token refresh (Cloudflare cron → KV cache)
- **5-step ScraperWorkflow** (token, fetch, dedup, upsert, analytics) on Cloudflare Workflows
- **Smart search strategies**: weighted name/street patterns, dedup by property ID, coverage-driven term generation — see [docs/SEARCH_TERMS.md](docs/SEARCH_TERMS.md)
- **AI-powered search**: natural-language property queries via Claude AI
- **React 19 + Vite frontend**: expandable property cards, appraised-vs-assessed comparisons, data freshness badges, mobile-responsive, WCAG compliant — see the [PropertySearch guide](src/components/features/PropertySearch/README.md)
- **Full Cloudflare stack**: Workers (Hono) API at `api.alephatx.info`; D1 database; KV token/response caches; Queues + Workflows for job processing; cron triggers. Frontend on GitHub Pages at `alephatx.info`. Sentry (`@sentry/cloudflare`) error tracking. Doppler secrets for local dev; `wrangler secret` in production. Prisma ORM (`@prisma/adapter-d1`) and Zod validation.

**Data extracted per property**: owner name, property type, city, full address, assessed/appraised values, property ID (PID), geographic ID, legal description, discovering search term, scrape/update timestamps.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  React Frontend │────▶│  CF Workers      │────▶│  D1 (SQLite) │
│  (GitHub Pages) │     │  (Hono API)      │     │  (edge)      │
└─────────────────┘     └──────────────────┘     └──────────────┘
                               │
                               │ CF Queue
                               ▼
                        ┌──────────────────┐
                        │ ScraperWorkflow  │
                        │ (5 steps)        │
                        └──────────────────┘
                               │
                          ┌────┴────┐
                          ▼         ▼
                   ┌──────────┐ ┌──────────┐
                   │ TCAD API │ │ KV Cache │
                   └──────────┘ └──────────┘
```

### Scraping Pipeline

1. **Enqueue** — `POST /api/properties/scrape` or CLI scripts send `{ searchTerm, year }` to the Cloudflare Queue (`tcad-scraper-jobs`); the queue consumer creates a ScraperWorkflow instance
2. **ScraperWorkflow** (5 steps) — get-token (KV-cached) → fetch-properties (paginated, 1000/page, max 100 pages) → deduplicate → upsert-properties (Prisma `$transaction`, chunks of 500) → update-analytics
3. **Batch generation** (local CLI) — `generate-next-200-terms.ts` (5-tier priority), `enqueue-tail-terms.ts` (multi-phase tail optimizer), batch types in `scripts/config/batch-configs.ts`; all POST to the Workers API
4. **Cron triggers** — token refresh (every 4 min), stale job cleanup (hourly), search term optimization (daily 3am), monitored searches (every 6 hr)

## Project Structure

```
tcad-scraper/
├── .github/workflows/    # CI/CD (ci, deploy, e2e, pr-checks, security)
├── docs/                  # All documentation (+ changelog/, repomix/, examples/)
├── e2e/                   # Playwright E2E tests (a11y, search, visual, mobile, …)
├── scripts/               # CLI tools: batch enqueue, backfill, analysis (see scripts/README.md)
├── shared/                # Shared types (property.types, json-ld.utils)
├── src/                   # Frontend (React 19 + Vite): components/, hooks/, lib/, utils/
├── utils/                 # Shared constants
└── workers/
    ├── tcad-api/          # Production API: Hono app, controllers, ScraperWorkflow,
    │                      #   middleware, prisma/ (canonical schema), wrangler.toml
    └── tcad-token/        # Token refresh Worker
```

Component-level detail: [CLAUDE.md](CLAUDE.md#key-components). Repomix packs for AI-assisted reading live in `docs/repomix/` — regenerate with `npm run repomix`.

## Database Schema

Five Prisma models, canonical in [workers/tcad-api/prisma/schema.prisma](workers/tcad-api/prisma/schema.prisma):

| Model | Purpose |
|-------|---------|
| `Property` | Scraped property records; unique on (`propertyId`, `year`); indexed on search term, city, type, value |
| `ScrapeJob` | Per-scrape status, result counts, new-property IDs |
| `MonitoredSearch` | Recurring scrapes with configurable frequency |
| `SearchTermAnalytics` | Per-term totals, searches, and success rates |
| `ApiUsageLog` | API usage tracking |

D1 conventions (rationale in [CLAUDE.md](CLAUDE.md#architecture-decisions)):

- **Dates are epoch-millisecond strings** (`"1711773684000"`) — D1's JS binding corrupts ISO 8601 TEXT values
- **Arrays are JSON-serialized strings** (e.g. `ScrapeJob.newPropertyIds`)

**Scale**: 260K+ properties for tax year 2025 (live count via [`/health`](https://api.alephatx.info/health)). Coverage tiers, per-term yields, and scraping-rate metrics: [docs/SEARCH_TERMS.md](docs/SEARCH_TERMS.md) and [docs/2025_BACKFILL_OPTIMIZATION.json](docs/2025_BACKFILL_OPTIMIZATION.json).

## Getting Started

### Prerequisites

- **Node.js 22** (pinned in `.node-version`) and npm
- **Doppler CLI** (for secrets management — all credentials are remote)

### Setup

```bash
git clone git@github.com:aledlie/tcad-scraper.git
cd tcad-scraper
npm install                                    # root deps (React frontend)

# Workers API — local D1 + dev server
cd workers/tcad-api
npx prisma generate
npx wrangler d1 execute tcad-db --local --file prisma/migrations/0001_init.sql
npm run dev                                    # http://localhost:8787

# Frontend (separate terminal, from repo root)
npm run dev                                    # http://localhost:5174
```

No external database is needed — D1 is configured in `workers/tcad-api/wrangler.toml`; `wrangler dev` creates a local SQLite file under `.wrangler/state/v3/d1/`.

**Production secrets** (set from `workers/tcad-api/` via `npx wrangler secret put <NAME>`): `API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SENTRY_DSN`, `TOKEN_WORKER_URL`, `TOKEN_WORKER_SECRET`.

**Testing** (full command reference in [CLAUDE.md](CLAUDE.md#common-commands)):

```bash
npx vitest run                                    # Frontend unit tests (130)
npx vitest run --dir scripts --config /dev/null   # Scripts tests (29)
cd workers/tcad-api && npm test                   # Workers tests (16)
npm run test:e2e                                  # Playwright E2E (126)
```

## API Endpoints

### GET /api/properties

List properties with filtering and pagination. Query params: `page` (default 1), `limit` (default 50), `city`, `propType`, `minValue`, `maxValue`.

```bash
curl "https://api.alephatx.info/api/properties?city=Austin&limit=25"
```

### POST /api/properties/search

AI-powered natural-language search (Claude). Body: `{ "query": "...", "limit": 100, "offset": 0 }`; returns `data`, `pagination`, and a `query.explanation` of how the AI interpreted the request.

```bash
curl -X POST https://api.alephatx.info/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "residential properties in Austin worth over 1 million"}'
```

Supported query shapes: location ("properties in Austin"), value ("worth over 500k"), type ("commercial buildings"), owner ("owned by Smith"), and combinations. Implementation: `workers/tcad-api/src/lib/claude.service.ts`. `GET /api/properties/search/test` verifies the Claude API connection.

### POST /api/properties/scrape

Queue a search term for scraping (requires `x-api-key`). Body: `{ "searchTerm": "Smith" }` — see [Quick Start](#quick-start-enqueueing-scrape-jobs).

### Other endpoints

- `GET /api/properties/jobs/:jobId` — scrape job status
- `GET /api/properties/history` — recent scrape jobs
- `GET /api/properties/stats` — property/job statistics
- `POST /api/properties/monitor` (requires `x-api-key`) / `GET /api/properties/monitor` — monitored searches
- `GET /health` — health check: `{"status":"ok","propertyCount":N,"runtime":"cloudflare-workers"}`

### Authentication

Write endpoints (`POST .../scrape`, `POST .../monitor`) require the `x-api-key` header, checked against the Worker's `API_KEY` secret (value = Doppler `TCAD_API_KEY`). Read endpoints are public. There is no JWT auth and no request rate limiting in the Workers API.

## Deployment

- **API** — deploy from `workers/tcad-api/` with `npx wrangler deploy`; runs at `api.alephatx.info`. Verify: `curl -s https://api.alephatx.info/health | jq`
- **Frontend** — auto-deploys to GitHub Pages (`alephatx.info`) via GitHub Actions on push to `main`; requires the `DOPPLER_TOKEN_PROD` GitHub secret (provides `VITE_API_URL` and `CLOUDFLARE_D1_TOKEN` at build time)

## Monitoring & Metrics

```bash
cd workers/tcad-api
npx wrangler tail                                                      # Live logs
npx wrangler workflows instances list scraper-workflow --per-page 10  # Workflow status
npx wrangler queues list                                              # Queue status
npx wrangler d1 execute tcad-db --remote --command "SELECT year, COUNT(*) FROM properties GROUP BY year"
```

Workers analytics (requests, errors, CPU) at [dash.cloudflare.com](https://dash.cloudflare.com); errors in Sentry. More D1 query examples (top search terms, recent jobs, city distribution): [CLAUDE.md](CLAUDE.md#common-commands).

## Analytics

The frontend tracks usage with **Google Analytics 4** and **Meta Pixel**: page views, searches, results, property-card views, example-query clicks, and React errors (via ErrorBoundary). Core implementation: `src/lib/analytics.ts` + `src/hooks/useAnalytics.ts`; tracking scripts load in `index.html`.

📖 **[docs/ANALYTICS.md](docs/ANALYTICS.md)** is the complete guide — event reference, GA4/Meta dashboard setup, dev-mode verification, troubleshooting, and privacy/GDPR compliance.

## Troubleshooting

The debugging table in [CLAUDE.md](CLAUDE.md#debugging) maps symptoms to fixes (DB connection, TCAD auth/500s, stuck workflows, queue stalls, deploy failures, D1 date corruption). Most-used commands:

```bash
cd workers/tcad-api
npx wrangler tail                                                       # Live logs
npx wrangler workflows instances list scraper-workflow --status running
npx wrangler workflows instances terminate scraper-workflow <instance-id>
npx wrangler d1 execute tcad-db --remote --command "SELECT 1"           # D1 connectivity
npx tsc --noEmit && npx wrangler deploy --dry-run                       # Pre-deploy checks
npx wrangler secret list                                                # Verify secrets
```

D1-specific: `SQLITE_CONSTRAINT` usually means a missing required field; `overloaded` errors indicate write contention under concurrent scrape load (200–500ms latency, spikes to 3s).

## Known Issues and Limitations

1. **Token expiration (~5 min)** — handled by the 4-minute cron refresh to KV, plus exponential backoff and retry
2. **Search result variability** — many terms legitimately return 0 results; the system tracks used terms, weights successful patterns, and blacklists repeat failures
3. **TCAD rate limiting** — jobs spread over time via the queue (`max_batch_size: 1`) with workflow retries (3 attempts, exponential backoff)
4. **TCAD API request format** — the wrong body format returns an HTTP 500 with no useful message. Correct format (operator-wrapped body, query-param pagination, no double "Bearer " prefix) is documented in [CLAUDE.md](CLAUDE.md#code-standards); the live implementation is `workers/tcad-api/src/workflows/scraper.workflow.ts`

Scraping works with entity terms (Trust, LLC., Corp), single last names (4+ chars), street addresses, and suburb/city names; it does **not** work with ZIP codes, terms under 4 chars, compound names, or numeric-only terms.

## Recent Updates

See [docs/CHANGELOG.md](docs/CHANGELOG.md) for version history and [docs/changelog/](docs/changelog/) for per-session details. Highlights: full Cloudflare migration (March 2026), legacy Express/BullMQ/Redis stack removal (August 2026), Tier 1-4 search-term optimization.

## Documentation

- **[CLAUDE.md](CLAUDE.md)** — Development commands, architecture decisions, code standards, debugging
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)** — Version history
- **[docs/BACKLOG.md](docs/BACKLOG.md)** — Technical debt and open items
- **[docs/SEARCH_TERMS.md](docs/SEARCH_TERMS.md)** — Canonical search-term strategy: tiers, backfill operations, metrics
- **[docs/2025_BACKFILL_OPTIMIZATION.json](docs/2025_BACKFILL_OPTIMIZATION.json)** — Per-term yield data and tier arrays
- **[docs/ANALYTICS.md](docs/ANALYTICS.md)** — Analytics implementation guide (GA4 + Meta Pixel)
- **[scripts/README.md](scripts/README.md)** — Full scripts inventory and usage
- **[PropertySearch Component Guide](src/components/features/PropertySearch/README.md)** — PropertyCard expansion UI

Pre-migration docs (Express/BullMQ/Redis/PostgreSQL era) were deleted 2026-08-06; they remain in git history (formerly `docs/archive/`).

---

## Contributing

Front-end Architecture and initial tcad scraping logic: John Skelton
Authentication, API, Queue Management & Batch Optimization: Alyshia Ledlie

## License

Proprietary - All rights reserved.

## Contact

**Repository**: https://github.com/aledlie/tcad-scraper
**Issues**: https://github.com/aledlie/tcad-scraper/issues

---

**Built with ❤️  for Karen, by John, Micah, and Alyshia**
