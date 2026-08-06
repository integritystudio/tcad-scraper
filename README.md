# TCAD Scraper

A production-grade web scraping system for automated collection of property tax information from the Travis Central Appraisal District (TCAD) website. Built with TypeScript, Cloudflare Workers (Hono), Prisma, and Cloudflare D1 (SQLite at the edge) with a workflow-based architecture for scalable data collection.

> **March 2026**: Full Cloudflare migration complete. API: Workers/Hono/Workflows. Database: D1 (SQLite, replacing PostgreSQL/Render/Hyperdrive). See [changelog/2026-03-30.md](docs/changelog/2026-03-30.md).

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Running the Scraper](#running-the-scraper)
- [Monitoring & Metrics](#monitoring--metrics)
- [Analytics](#analytics)
- [Troubleshooting](#troubleshooting)
- [Known Issues](#known-issues-and-limitations)
- [Documentation](#documentation)
- [Recent Updates](#recent-updates)

## Quick Start: Enqueueing Scrape Jobs

**For 2025 tax year scraping:**

```bash
# Generate and enqueue the next 200 candidate terms (fastest start)
doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue

# Enqueue "tail" terms (low-yield, novel discovery) in all 3 phases
TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts

# Enqueue Phase 2 only (analytics tail, diminishing returns)
TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts --phase 2
```

All jobs enqueue via Cloudflare Workers API (`https://api.alephatx.info/api/properties/scrape`). Queue status: `cd workers/tcad-api && npx wrangler queues list`

---

## Overview

TCAD Scraper is a production application that automates the collection and storage of property tax data from travis.prodigycad.com. The system provides both a REST API and a React frontend for accessing property data, with continuous batch scraping using intelligent search term generation to discover and catalog properties across Travis County.

The application uses **API-direct scraping**: direct HTTP calls to the TCAD backend API, supporting 1000+ results per search with automatic token refresh via a Cloudflare Worker.

## Key Features

### Data Collection
- **API-Direct Scraping**: High-volume scraping via TCAD API with automatic token refresh
- **Continuous Batch Scraping**: Automated 24/7 scraping with intelligent, weighted search term generation
- **Workflow-Based Processing**: Cloudflare Workflows with 5-step scraper pipeline (token, fetch, dedup, upsert, analytics)
- **Persistent Storage**: Cloudflare D1 (SQLite) with Prisma ORM for type-safe data access
- **Smart Search Strategies**:
  - Weighted pattern distribution (200+ first names, 500+ last names, 150+ Austin streets)
  - Multiple search patterns: full names, last names, street addresses, numbers, partial matches
  - Duplicate detection and deduplication by property ID
  - Dynamic adjustment based on database coverage

### Data Extracted
- Owner name and property type
- City and full property address
- Assessed and appraised values
- Property ID (PID) and Geographic ID
- Legal descriptions
- Search term that discovered the property
- Timestamps for scraping and updates

### API & Frontend
- **RESTful API**: Cloudflare Workers (Hono) with CORS, security headers, API key auth
- **AI-Powered Search**: Natural language property search using Claude AI (Anthropic)
- **React Frontend**: Modern UI for searching and viewing property data
  - **Expandable Property Cards**: Progressive disclosure UI pattern for detailed property information
  - **Financial Analysis**: Visual comparison of appraised vs assessed values with difference calculations
  - **Data Freshness Indicators**: Color-coded badges showing data age and quality
  - **Mobile Responsive**: Optimized layouts for mobile (< 640px), tablet (640px-1024px), and desktop
  - **WCAG Compliant**: Full keyboard navigation and screen reader support
- **API Key Authentication**: `x-api-key` header on write endpoints
- **Health Monitoring**: Endpoints for application and queue health checks

### Infrastructure
- **Cloudflare Workers**: Production API at `api.alephatx.info`
- **Cloudflare D1**: SQLite database at the edge (replaced PostgreSQL/Render/Hyperdrive)
- **Cloudflare KV**: Token cache + response cache (replaced Redis)
- **Cloudflare Queues + Workflows**: Distributed scrape job processing (replaced BullMQ)
- **GitHub Pages**: Frontend deployed at `alephatx.info`
- **Sentry**: Error tracking via `@sentry/cloudflare`
- **Doppler Integration**: Secure secrets management for local dev

## Technology Stack

### Core Application
- **Cloudflare Workers** with **Hono** framework for REST API
- **Cloudflare Workflows** for multi-step scrape job processing
- **Cloudflare Queues** for job distribution
- **Cloudflare KV** for token + response caching
- **Cloudflare D1** (SQLite at the edge) for database
- **Prisma ORM** with `@prisma/adapter-d1` for type-safe database access
- **Zod** for runtime type validation
- **Anthropic Claude AI** for natural language search parsing
- **@sentry/cloudflare** for error tracking

### Infrastructure & DevOps
- **Cloudflare D1** — Managed SQLite database (edge reads, single-region writes)
- **Cloudflare Workers** — Production API with auto-deploy via `wrangler deploy`
- **Doppler** for local dev secrets management
- **`wrangler secret`** for Workers production secrets

### Frontend (React Application)
- **React 19.2** with TypeScript
- **Vite 7.1** for development and building
- **CSS Modules** for component styling
- **Progressive UI** with expandable property cards

### Security & Middleware
- **Hono secure-headers** for security headers
- **Hono CORS** for cross-origin resource sharing
- **API Key** authentication via `x-api-key` header

### Deployment Environment
- **Cloudflare Workers** (API at `api.alephatx.info`)
- **Cloudflare D1** (SQLite database `tcad-db`)
- **GitHub Pages** (frontend at `alephatx.info`)
## Architecture

### System Overview

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

### Data Flow

#### Scraping Pipeline (Cloudflare Workers)

1. **Enqueue** via `POST /api/properties/scrape` or CLI scripts
   - Sends `{ searchTerm, year }` to Cloudflare Queue (`tcad-scraper-jobs`)
   - Queue consumer creates a ScraperWorkflow instance

2. **ScraperWorkflow** (5-step Cloudflare Workflow)
   - **Step 1: get-token** — Fetch auth token from token worker, cache in KV
   - **Step 2: fetch-properties** — Paginated TCAD API calls (1000/page, max 100 pages)
   - **Step 3: deduplicate** — Remove duplicate propertyIds
   - **Step 4: upsert-properties** — Prisma upsert to D1 via `$transaction` (chunks of 500)
   - **Step 5: update-analytics** — Update ScrapeJob + SearchTermAnalytics records

3. **Batch Generation** (CLI scripts, run locally)
   - `generate-next-200-terms.ts` — 5-tier priority: names, geographic, prefix expansions, re-scrape, gap fill
   - `config/batch-configs.ts` — batch type configurations (used via `scripts/lib/queue-utils.ts::enqueueBatch()`)
   - `enqueue-tail-terms.ts` — Multi-phase tail term optimizer
   - Scripts POST to the Workers API

4. **Cron Triggers** (Cloudflare)
   - Token refresh (every 4 min)
   - Stale job cleanup (hourly)
   - Search term optimization (daily, 3am)
   - Monitored search execution (every 6 hours)

## Project Structure

Repomix packs live in `docs/repomix/`. Regenerate with `npm run repomix` (or `bash scripts/repomix/repomix-token-tree.sh` for the token tree alone).

```
tcad-scraper/
├── .github/workflows/          # CI/CD (ci, deploy, integration-tests, pr-checks, security)
├── config/
│   └── gtm-container-triggers.json    # GTM config
├── docs/                       # All documentation
│   ├── ANALYTICS.md, BACKLOG.md, CHANGELOG.md
│   ├── archive/                # Pre-migration docs (API, SETUP, TESTING, CI-CD, …)
│   ├── changelog/              # Per-session changelogs
│   ├── repomix/                # Generated repomix packs
│   └── examples/               # Search algorithm examples
├── e2e/                        # Playwright E2E tests (a11y, search, visual, mobile, api-errors, answer-box)
├── scripts/                    # CLI tools, batch scripts, backfill, enqueue (root level)
│   ├── config/                 # Batch type definitions
│   ├── lib/                    # queue-utils, backfill-runner, searched-terms, backfill-utils
│   ├── utils/                  # list-all-search-terms
│   └── repomix/                # Repomix tooling
├── utils/                      # Shared constants (constants.ts)
├── shared/                     # Shared types (index.ts, property.types.ts, json-ld.utils.ts)
├── src/                        # Frontend (React 19 + Vite)
│   ├── components/
│   │   ├── features/PropertySearch/  # Search UI, PropertyCard, AnswerBox
│   │   ├── layout/                   # HeaderBadge, AttributionCard, Footer
│   │   └── ui/                       # Badge, Button, Card, Icon, Input, LoadingSkeleton
│   ├── hooks/                  # usePropertySearch, useAnalytics, usePagination
│   ├── lib/                    # analytics, api-config, sentry, xcontroller
│   └── utils/                  # formatters, helpers
├── workers/
│   ├── tcad-api/               # Production API (CF Workers + Hono)
│   │   ├── src/
│   │   │   ├── index.ts        # Hono app + queue consumer + crons + Sentry
│   │   │   ├── bindings.d.ts   # Worker env type definitions
│   │   │   ├── db.ts           # Prisma + D1 (PrismaD1 adapter)
│   │   │   ├── controllers/    # property, api-usage
│   │   │   ├── middleware/     # auth (x-api-key) + Zod validation
│   │   │   ├── workflows/     # ScraperWorkflow (5-step pipeline)
│   │   │   ├── lib/           # claude.service + sanitizeWhereClause
│   │   │   └── utils/         # constants, epoch-dates, json-array, error-helpers
│   │   ├── prisma/            # D1/SQLite schema + migrations (canonical)
│   │   └── wrangler.toml      # D1, KV, Queues, Workflows, Crons
│   └── tcad-token/             # Cloudflare Worker for token refresh
```

## Database Schema

The application uses Cloudflare D1 (SQLite) with five models defined in `workers/tcad-api/prisma/schema.prisma`. Dates are stored as epoch millisecond strings to avoid D1's type coercion on ISO 8601 TEXT values. Arrays are JSON-serialized strings.

### Property Model

Stores scraped property information with comprehensive indexing.

```prisma
model Property {
  id              String  @id @default(uuid())
  propertyId      String  @map("property_id")          // TCAD unique identifier
  name            String                                // Owner name
  propType        String  @map("prop_type")             // Property type
  city            String?                               // City location
  propertyAddress String  @map("property_address")      // Full address
  assessedValue   Float?  @map("assessed_value")        // Tax assessed value
  appraisedValue  Float   @map("appraised_value")       // Appraised value
  geoId           String? @map("geo_id")                // Geographic ID
  description     String?                               // Legal description
  searchTerm      String? @map("search_term")           // Discovery search term
  scrapedAt       String  @default("0") @map("scraped_at")   // Epoch ms string
  createdAt       String  @default("0") @map("created_at")   // Epoch ms string
  updatedAt       String  @default("0") @map("updated_at")   // Epoch ms string
  year            Int                                   // Tax year

  @@unique([propertyId, year])
  @@index([searchTerm, scrapedAt])
  @@index([propertyId])
  @@index([city])
  @@index([propType])
  @@index([appraisedValue])
  @@index([year])
  @@map("properties")
}
```

### ScrapeJob Model

Tracks all scraping operations for monitoring and analytics.

```prisma
model ScrapeJob {
  id              String  @id @default(uuid())
  searchTerm      String  @map("search_term")
  status          String                                // pending, processing, completed, failed
  resultCount     Int?    @map("result_count")
  totalApiResults Int?    @map("total_api_results")     // Raw TCAD API count (before dedup)
  updatedCount    Int?    @map("updated_count")         // Properties updated (not new)
  newPropertyIds  String  @default("[]") @map("new_property_ids")  // JSON-serialized string[]
  error           String?
  startedAt       String  @default("0") @map("started_at")   // Epoch ms string
  completedAt     String? @map("completed_at")               // Epoch ms string

  @@index([status, startedAt])
  @@index([searchTerm])
  @@map("scrape_jobs")
}
```

### MonitoredSearch Model

Enables automated recurring scrapes with configurable frequency.

```prisma
model MonitoredSearch {
  id         String  @id @default(uuid())
  searchTerm String  @unique @map("search_term")
  active     Boolean @default(true)
  frequency  String  @default("daily")                  // daily, weekly, monthly
  lastRun    String? @map("last_run")                   // Epoch ms string
  createdAt  String  @default("0") @map("created_at")   // Epoch ms string
  updatedAt  String  @default("0") @map("updated_at")   // Epoch ms string

  @@map("monitored_searches")
}
```

**Database Statistics** (as of March 2026; coverage percentages are relative to this snapshot — the live D1 count was 170,320 as of Aug 2026, see `/health`):
- Properties: 365,371 unique records
- Unique Search Terms: 313 terms
- Zero Overlap: Top 30 search terms return distinct property sets (no duplication)
- Tier 1 Coverage (15 terms): 19.6% (71,626 properties)
- Tier 1+2 Coverage (50 terms): 45.1% (164,894 properties)
- Tier 1+2+3 Coverage (200 terms): 92.1% (336,367 properties)
- Scraping Rate: ~42,000 properties/hour (API method)
- Success Rate: ~80%
- Peak Single Scrape: 8,660 properties ("David")

## Getting Started

### Prerequisites

- **Node.js 22** (pinned in `.node-version`) and npm
- **Doppler CLI** (for secrets management — all credentials are remote)

### Installation

1. **Clone the repository:**
```bash
git clone git@github.com:aledlie/tcad-scraper.git
cd tcad-scraper
```

2. **Install root dependencies (React frontend):**
```bash
npm install
```

### Database Configuration

The application uses Cloudflare D1 (SQLite). No external database connection needed. D1 is configured in `workers/tcad-api/wrangler.toml`.

For local development, `wrangler dev` creates a local SQLite file at `.wrangler/state/v3/d1/`.

3. **Set up Workers secrets:**
```bash
cd workers/tcad-api

# Set production secrets
npx wrangler secret put API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put SENTRY_DSN
npx wrangler secret put TOKEN_WORKER_URL
npx wrangler secret put TOKEN_WORKER_SECRET
```

4. **Initialize local D1 database:**
```bash
cd workers/tcad-api
npx prisma generate
npx wrangler d1 execute tcad-db --local --file prisma/migrations/0001_init.sql
```

5. **Start the Workers API (local dev):**
```bash
cd workers/tcad-api
npm run dev
```

6. **Start the React frontend** (separate terminal):
```bash
# From project root
npm run dev
```

### Access Points

- **Frontend UI**: http://localhost:5174
- **Workers API (local)**: http://localhost:8787
- **Health Check**: http://localhost:8787/health

## API Endpoints

### Property Endpoints

#### GET /api/properties
Retrieve all properties with optional filtering and pagination.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)
- `city` - Filter by city
- `propType` - Filter by property type
- `minValue` - Minimum appraised value
- `maxValue` - Maximum appraised value

**Example:**
```bash
curl "http://localhost:8787/api/properties?city=Austin&limit=25"
```

#### POST /api/properties/search
**AI-Powered Natural Language Search** - Search properties using plain English queries powered by Claude AI.

**Request Body:**
```json
{
  "query": "residential properties in Austin worth over 500k",
  "limit": 100,
  "offset": 0
}
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "total": 1234,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  },
  "query": {
    "original": "residential properties in Austin worth over 500k",
    "explanation": "Searching for residential properties in Austin with appraised value over $500,000"
  }
}
```

**Example:**
```bash
curl -X POST https://api.alephatx.info/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "properties in Austin worth over 1 million"}'
```

**Supported Query Types:**
- Location: "properties in Austin", "homes in Round Rock"
- Value: "properties worth over 500k", "homes under $200,000"
- Type: "residential properties", "commercial buildings"
- Owner: "properties owned by Smith"
- Combined: "residential properties in Austin worth over 1M"

See `workers/tcad-api/src/lib/claude.service.ts` for implementation details.

#### GET /api/properties/search/test
Test Claude AI API connection and configuration.

**Response:**
```json
{
  "success": true,
  "message": "Claude API connection successful",
  "testQuery": "properties in Austin",
  "result": {...}
}
```

**Example:**
```bash
curl http://localhost:8787/api/properties/search/test
```

#### POST /api/properties/scrape
Queue a search term for scraping (requires `x-api-key`).

**Body:**
```json
{
  "searchTerm": "Smith"
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/properties/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TCAD_API_KEY" \
  -d '{"searchTerm": "Smith"}'
```

#### Other endpoints
- `GET /api/properties/jobs/:jobId` — scrape job status
- `GET /api/properties/history` — recent scrape jobs
- `GET /api/properties/stats` — property/job statistics
- `POST /api/properties/monitor` (requires `x-api-key`) / `GET /api/properties/monitor` — monitored searches

### Health & Monitoring

#### GET /health
Application health check.

**Response:**
```json
{
  "status": "ok",
  "propertyCount": 170320,
  "runtime": "cloudflare-workers"
}
```

### Authentication

Write endpoints (`POST /api/properties/scrape`, `POST /api/properties/monitor`) require an API key sent as the `x-api-key` header, checked against the Worker's `API_KEY` secret (value = Doppler `TCAD_API_KEY`):

```bash
curl -X POST https://api.alephatx.info/api/properties/scrape \
  -H "x-api-key: $TCAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"searchTerm": "Smith"}'
```

Read endpoints are public. There is no JWT auth and no request rate limiting in the Workers API.

## Running the Scraper

### Enqueue via Workers API (Production)

```bash
# Single term
curl -X POST "https://api.alephatx.info/api/properties/scrape" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TCAD_API_KEY" \
  -d '{"searchTerm": "Smith"}'

# Check job history
curl "https://api.alephatx.info/api/properties/history?limit=10" \
  -H "x-api-key: $TCAD_API_KEY"
```

### Batch Enqueue (CLI Scripts)

```bash
# Generate and enqueue next 200 candidate terms
doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue

# Tail term optimizer
TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts
```

### TCAD API Token Management

Tokens expire every ~5 minutes. In Workers, a cron trigger refreshes tokens every 4 minutes and caches in KV. See [TOKEN_MANAGEMENT.md](docs/archive/TOKEN_MANAGEMENT.md) (archived — describes the legacy server flow).

### Available npm Scripts

```bash
# Workers (from workers/tcad-api/)
npm run dev                        # Local dev server (wrangler dev)
npm run deploy                     # Deploy to Cloudflare

# Frontend / scripts (from repo root)
npx vitest run                     # Frontend unit tests (130 tests)
npx vitest run --dir scripts --config /dev/null  # Scripts tests (29 tests)
```

## Deployment

The frontend deploys automatically to **GitHub Pages** via GitHub Actions on push to `main`. The custom domain `alephatx.info` is configured via CNAME.

The API runs on **Cloudflare Workers** at `api.alephatx.info`.

**Deploy Workers API:**
```bash
cd workers/tcad-api
npx wrangler deploy
```

**Workers Secrets** (set via `wrangler secret put`):
- `API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SENTRY_DSN`, `TOKEN_WORKER_URL`, `TOKEN_WORKER_SECRET`

**Required GitHub Secrets:**
- `DOPPLER_TOKEN_PROD`: Access to Doppler secrets (provides `VITE_API_URL` and `CLOUDFLARE_D1_TOKEN` at build time)

**Production URLs:**
- Frontend: https://alephatx.info
- API: https://api.alephatx.info/api
- Health: https://api.alephatx.info/health

## Monitoring & Metrics

### Cloudflare Dashboard

- **Workers Analytics**: Request volume, error rates, CPU time at dash.cloudflare.com
- **Workflow Instances**: `wrangler workflows instances list scraper-workflow`
- **Queue Status**: `wrangler queues list`
- **Live Logs**: `wrangler tail` (from `workers/tcad-api/`)
- **Sentry**: Error tracking via `@sentry/cloudflare`

### Database Queries (D1)

```bash
cd workers/tcad-api

# Property count
npx wrangler d1 execute tcad-db --remote --command "SELECT year, COUNT(*) FROM properties GROUP BY year ORDER BY year"

# Top search terms
npx wrangler d1 execute tcad-db --remote --command "SELECT search_term, total_results, total_searches, success_rate FROM search_term_analytics WHERE total_results > 0 ORDER BY total_results DESC LIMIT 50"

# Recent scrape jobs
npx wrangler d1 execute tcad-db --remote --command "SELECT search_term, status, result_count, started_at, completed_at FROM scrape_jobs ORDER BY started_at DESC LIMIT 20"

# Property distribution by city
npx wrangler d1 execute tcad-db --remote --command "SELECT city, COUNT(*) as count FROM properties WHERE city IS NOT NULL GROUP BY city ORDER BY count DESC"
```

## Analytics

The TCAD Scraper frontend implements comprehensive user behavior tracking using **Google Analytics 4 (GA4)** and **Meta Pixel** to monitor application usage, search patterns, and user engagement.

### Tracking Overview

**Events Tracked:**
1. **Page Views** - Initial application loads
2. **Search Events** - Property search queries
3. **Search Results** - Results count and AI explanation presence
4. **Property Views** - Individual property card impressions
5. **Example Query Clicks** - Usage of example queries
6. **Error Events** - React errors via ErrorBoundary
7. **Custom Engagement** - User interaction metrics

### Features

✅ **Dual Platform Tracking** - GA4 for detailed analytics + Meta Pixel for marketing insights
✅ **User Journey Tracking** - Complete flow from page load to property views
✅ **Error Monitoring** - Automatic tracking of React errors
✅ **Development Mode** - Console logging for debugging (disabled in production)
✅ **Performance Optimized** - Async script loading, minimal overhead
✅ **Type Safe** - Full TypeScript coverage

### Dashboards

**Google Analytics 4:**
- Access: https://analytics.google.com/
- Real-time Events: Reports → Real-Time → Events
- Custom Reports: 4 pre-configured reports (Search Performance, Property Engagement, User Journey Funnel, Error Monitoring)

**Meta Events Manager:**
- Access: https://business.facebook.com/events_manager
- Pixel: 25629020546684786
- Test Events: Real-time event verification
- Custom Conversions: Successful searches, high engagement sessions

### Implementation

Analytics are implemented using:
- **Core Library**: `src/lib/analytics.ts`
- **React Hook**: `src/hooks/useAnalytics.ts`
- **Error Boundary**: `src/components/ErrorBoundary.tsx`
- **Tracking Scripts**: Loaded in `index.html` (GA4 + Meta Pixel)

Components with integrated tracking:
- `App.tsx` - Page view tracking
- `PropertySearchContainer.tsx` - Search and results tracking
- `PropertyCard.tsx` - Property view tracking

### Documentation

For complete analytics implementation details, dashboard configuration, troubleshooting, and privacy compliance:

📖 **[docs/ANALYTICS.md](docs/ANALYTICS.md)** - Comprehensive analytics guide

Includes:
- Event tracking reference with parameters
- GA4 custom reports setup (step-by-step)
- Meta Pixel configuration guide
- Development & testing workflows
- Troubleshooting common issues
- Privacy & GDPR compliance
- Best practices for maintenance

### Quick Verification

**Development Mode:**
```bash
npm run dev
# Open http://localhost:5174
# Check browser console for: [Analytics Event: ...]
```

**Production Testing:**
```bash
npm run build && npm run preview
# Open http://localhost:4173
# Check Network tab for requests to:
#   - google-analytics.com/g/collect
#   - facebook.com/tr
```

## Troubleshooting

### Workers Issues

**Check workflow status:**
```bash
cd workers/tcad-api
npx wrangler workflows instances list scraper-workflow --per-page 10
npx wrangler workflows instances describe scraper-workflow <instance-id>
```

**View live logs:**
```bash
cd workers/tcad-api
npx wrangler tail
```

**Terminate stuck workflows:**
```bash
npx wrangler workflows instances terminate scraper-workflow <instance-id>
```

**No properties being scraped:**
```bash
# Check queue
npx wrangler queues list

# Check health
curl https://api.alephatx.info/health
```

### Database Issues (D1)

**Connection errors:**
```bash
cd workers/tcad-api

# Test D1 connection
npx wrangler d1 execute tcad-db --remote --command "SELECT 1"

# Regenerate Prisma client
npx prisma generate

# Check tables exist
npx wrangler d1 execute tcad-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

**D1-specific issues:**
- Dates stored as ISO 8601 instead of epoch ms: re-scrape affected records
- `SQLITE_CONSTRAINT` errors: check for missing required fields in create calls
- D1 `overloaded` errors: write contention under concurrent scrape load (200-500ms latency, can spike to 3s)

### Queue Issues

**Workers queue stuck:**
```bash
cd workers/tcad-api
npx wrangler queues list
npx wrangler tail  # Check for consumer errors
```

**Failed jobs (DLQ):**
```bash
# Check dead letter queue
npx wrangler queues list  # Look at tcad-scraper-dlq
```

### API Issues

**Workers deploy failing:**
```bash
cd workers/tcad-api
npx tsc --noEmit           # Check types
npx wrangler deploy --dry-run  # Check bundle
```

**Check secrets are set:**
```bash
npx wrangler secret list
```

## Known Issues and Limitations

### 1. API Token Expiration

The API-based scraping method requires token refresh every ~5 minutes. The scraper handles this automatically, but rapid scraping may occasionally hit rate limits.

**Solution Implemented**:
- Cloudflare cron trigger auto-refreshes tokens to KV every 4 minutes
- Provides buffer before expiration
- Prevents HTTP 401 errors during continuous scraping

**Mitigation**: The system implements exponential backoff and automatic retry logic.

### 2. Search Result Variability

Many random search terms return 0 results (expected behavior). The system:
- Tracks used search terms to avoid repetition
- Weights search strategies toward successful patterns
- Blacklists terms with repeated failures

### 3. Rate Limiting

Aggressive scraping may trigger TCAD rate limiting. The system:
- Distributes jobs across time via Cloudflare Queue (`max_batch_size: 1`)
- Workflow retry with exponential backoff (3 attempts)

### 4. TCAD API Request Format

The TCAD API requires a specific request body format. Using the wrong format returns HTTP 500 with no useful error message:
- **Correct body**: `{ pYear: { operator: "=", value: "2025" }, fullTextSearch: { operator: "match", value: "Smith" } }`
- **Pagination**: Query params `?page=1&pageSize=1000` (1-indexed)
- **Auth header**: `Authorization: <token>` — token from token worker already includes "Bearer " prefix
- **Response shape**: `{ totalProperty: { propertyCount: N }, results: [...] }`

The live implementation is `workers/tcad-api/src/workflows/scraper.workflow.ts` (the original `server/src/lib/tcad-api-client.ts` reference implementation lives in git history).

## Recent Updates

See [docs/CHANGELOG.md](docs/CHANGELOG.md) for complete version history.

**Latest** (March 30, 2026):
- **D1 migration complete** — Database migrated from PostgreSQL (Render/Hyperdrive) to Cloudflare D1 (SQLite at edge). Dates stored as epoch ms strings to avoid D1 type coercion. Bulk upserts via Prisma `$transaction`. See [changelog/2026-03-30.md](docs/changelog/2026-03-30.md)
- **Legacy stack cleanup** — Removed BullMQ queues, Redis token service, Prometheus/Grafana monitoring, K6 load tests, CLI tools, and render.yaml (~9,800 lines deleted)
- **KV offload for large scrape results** — Workflow step outputs capped at 1MiB; large terms stored in RESPONSE_CACHE KV with 1hr TTL
- **Search Term Efficiency Optimization** — Tier 1-4 strategy: Tier 1 (15 terms) = 19.6% coverage, Tier 1+2 (50 terms) = 45.1%, Tier 1+2+3 (200 terms) = 92.1%
- **Full Cloudflare stack** — All infrastructure on Cloudflare: Workers, D1, KV, Queues, Workflows, Crons
- 130 frontend + 29 scripts + 16 workers unit tests, 126 E2E tests passing

## Documentation

Comprehensive documentation is available in the `docs/` directory:

### Primary Documentation
- **[CHANGELOG.md](docs/CHANGELOG.md)** - Version history and detailed changes
- **[BACKLOG.md](docs/BACKLOG.md)** - Technical debt and open items tracking

### Frontend Documentation
- **[PropertySearch Component Guide](src/components/features/PropertySearch/README.md)** - PropertyCard expansion UI

### API & Monitoring
- **[ANALYTICS.md](docs/ANALYTICS.md)** - Analytics implementation guide (GA4 + Meta Pixel)

### Technical Documentation
- **[SEARCH_TERM_STRATEGY.md](SEARCH_TERM_STRATEGY.md)** - Tier-based search term efficiency strategy with API call estimates
- **[SEARCH_TERM_ANALYSIS.md](SEARCH_TERM_ANALYSIS.md)** - Full ranked analysis of all 313 search terms with efficiency metrics

### Archived Documentation
Pre-migration docs (Express/BullMQ/Redis/PostgreSQL era) now live in **[docs/archive/](docs/archive/)**: SETUP, TESTING, API, SECURITY, MONITORING, CI-CD, TOKEN_MANAGEMENT, doppler-setup, BRANCH-PROTECTION, TEST-MOCK-PATHS, and the two Cloudflare planning docs.

### Scripts Documentation
- **[scripts/README.md](scripts/README.md)** - Full scripts inventory and usage

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
