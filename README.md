# TCAD Scraper

A production-grade web scraping system for automated collection of property tax information from the Travis Central Appraisal District (TCAD) website. Built with TypeScript, Cloudflare Workers (Hono), Prisma, and PostgreSQL with a workflow-based architecture for scalable data collection.

> **March 2026**: Production API migrated from Express/BullMQ/Render to Cloudflare Workers/Hono/Workflows. See [CLOUDFLARE_MIGRATION_PLAN.md](docs/CLOUDFLARE_MIGRATION_PLAN.md).

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
- [Known Issues](#known-issues)
- [Documentation](#documentation)
- [Recent Updates](#recent-updates)

## Overview

TCAD Scraper is a production application that automates the collection and storage of property tax data from travis.prodigycad.com. The system provides both a REST API and a React frontend for accessing property data, with continuous batch scraping using intelligent search term generation to discover and catalog properties across Travis County.

The application uses **API-direct scraping**: direct HTTP calls to the TCAD backend API, supporting 1000+ results per search with automatic token refresh via a Cloudflare Worker.

## Key Features

### Data Collection
- **API-Direct Scraping**: High-volume scraping via TCAD API with automatic token refresh
- **Continuous Batch Scraping**: Automated 24/7 scraping with intelligent, weighted search term generation
- **Workflow-Based Processing**: Cloudflare Workflows with 5-step scraper pipeline (token, fetch, dedup, upsert, analytics)
- **Persistent Storage**: PostgreSQL database with Prisma ORM for type-safe data access
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
- **Optional Authentication**: JWT and API key support for production environments
- **Health Monitoring**: Endpoints for application and queue health checks

### Infrastructure
- **Cloudflare Workers**: Production API at `api.alephatx.info`
- **Cloudflare Hyperdrive**: Connection pooling to Render PostgreSQL
- **Cloudflare KV**: Token cache + response cache (replaced Redis)
- **Cloudflare Queues + Workflows**: Distributed scrape job processing (replaced BullMQ)
- **Render PostgreSQL**: Database hosting (unchanged)
- **GitHub Pages**: Frontend deployed at `alephatx.info`
- **Sentry**: Error tracking via `@sentry/cloudflare`
- **Doppler Integration**: Secure secrets management for local dev

## Technology Stack

### Core Application
- **Cloudflare Workers** with **Hono** framework for REST API
- **Cloudflare Workflows** for multi-step scrape job processing
- **Cloudflare Queues** for job distribution
- **Cloudflare KV** for token + response caching
- **Cloudflare Hyperdrive** for PostgreSQL connection pooling
- **Prisma ORM** with `@prisma/adapter-pg` for type-safe database access
- **jose** for JWT verification (Workers-compatible)
- **Zod** for runtime type validation
- **Anthropic Claude AI** for natural language search parsing
- **@sentry/cloudflare** for error tracking

### Infrastructure & DevOps
- **PostgreSQL 15+** — Render-hosted (remote), accessed via Hyperdrive
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
- **jose** for JWT authentication (Workers-compatible)
- **API Key** authentication via `x-api-key` header

### Deployment Environment
- **Cloudflare Workers** (API at `api.alephatx.info`)
- **Render** (PostgreSQL database)
- **GitHub Pages** (frontend at `alephatx.info`)
## Architecture

### System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐     ┌─────────────┐
│  React Frontend │────▶│  CF Workers      │────▶│  Hyperdrive  │────▶│ PostgreSQL  │
│  (GitHub Pages) │     │  (Hono API)      │     │  (pool)      │     │ (Render)    │
└─────────────────┘     └──────────────────┘     └──────────────┘     └─────────────┘
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
   - **Step 4: upsert-properties** — Bulk upsert to PostgreSQL via Hyperdrive (chunks of 500)
   - **Step 5: update-analytics** — Update ScrapeJob + SearchTermAnalytics records

3. **Batch Generation** (CLI scripts, run locally)
   - `generate-next-200-terms.ts` — 5-tier priority: names, geographic, prefix expansions, re-scrape, gap fill
   - `enqueue-batch.ts` — 18 batch type configurations
   - `enqueue-tail-terms.ts` — Multi-phase tail term optimizer
   - Scripts POST to Workers API or use legacy BullMQ

4. **Cron Triggers** (Cloudflare)
   - Token refresh (every 4 min)
   - Stale job cleanup (hourly)
   - Monitored search execution (every 6 hours)

## Project Structure

Token counts generated by [Repomix](https://github.com/yamadashy/repomix). Regenerate with `bash scripts/repomix/token-tree.sh`.

```
tcad-scraper/
├── .github/workflows/          # CI/CD (ci, deploy, integration-tests, pr-checks, security)
├── config/
│   └── gtm-container-triggers.json    # GTM config
├── docs/                       # All documentation
│   ├── API.md, ANALYTICS.md, CI-CD.md, TOKEN_MANAGEMENT.md, SETUP.md
│   ├── BACKLOG.md, CHANGELOG.md, CODE_REVIEW_DRY.md, TEST-MOCK-PATHS.md
│   ├── archive/                # RELIABILITY_AUDIT.md, RENDER-MIGRATION.md
│   ├── changelog/              # Per-session changelogs
│   └── examples/               # Search algorithm examples
├── e2e/                        # Playwright E2E tests (a11y, search, visual, mobile, api-errors, answer-box)
├── scripts/                    # CLI tools, batch scripts, backfill, enqueue (root level)
│   ├── config/                 # 18 batch type definitions
│   ├── lib/                    # queue-utils, backfill-runner, searched-terms, backfill-utils
│   ├── requeue/                # Failed job requeue scripts
│   └── repomix/                # Repomix tooling
├── utils/                      # Shared constants (constants.ts)
├── server/                     # Legacy backend (Express + Prisma, reference only)
│   ├── prisma/                 # Schema + migrations (canonical location)
│   ├── scripts/                # DB setup, test infra, verification
│   └── src/
│       ├── index.ts            # Express + Sentry (read-only DB queries)
│       ├── config/             # App config + Swagger
│       ├── controllers/        # Route handlers (property, api-usage)
│       ├── lib/                # Core services (tcad-api-client, claude, redis-cache, metrics)
│       ├── middleware/         # Auth, error, validation, xcontroller
│       ├── routes/             # Express routes
│       ├── services/           # code-complexity, search-term-optimizer
│       ├── types/              # TypeScript types (property, queue)
│       └── utils/              # error-helpers, json-ld, timing
├── shared/                     # Shared types (index.ts, json-ld.utils.ts)
├── src/                        # Frontend (React 19 + Vite)
│   ├── components/
│   │   ├── features/PropertySearch/  # Search UI, PropertyCard, AnswerBox
│   │   ├── layout/                   # HeaderBadge, AttributionCard, Footer
│   │   └── ui/                       # Badge, Button, Card, Icon, Input, LoadingSkeleton
│   ├── hooks/                  # usePropertySearch, useAnalytics, usePagination
│   ├── lib/                    # analytics, api-config, sentry, xcontroller
│   ├── services/               # api.service
│   └── utils/                  # formatters, helpers
├── workers/
│   ├── tcad-api/               # Production API (CF Workers + Hono)
│   │   ├── src/
│   │   │   ├── index.ts        # Hono app + queue consumer + crons + Sentry
│   │   │   ├── bindings.d.ts   # Worker env type definitions
│   │   │   ├── db.ts           # Prisma + Hyperdrive
│   │   │   ├── controllers/    # property, api-usage
│   │   │   ├── middleware/     # auth (API key + JWT via jose)
│   │   │   ├── workflows/     # ScraperWorkflow (5-step pipeline)
│   │   │   ├── lib/           # claude.service
│   │   │   └── utils/         # constants, error-helpers
│   │   └── wrangler.toml      # Hyperdrive, KV, Queues, Workflows, Crons
│   └── tcad-token/             # Cloudflare Worker for token refresh
```

## Database Schema

The application uses PostgreSQL with three main models defined in `server/prisma/schema.prisma`:

### Property Model

Stores scraped property information with automatic timestamps and comprehensive indexing.

```prisma
model Property {
  id              String   @id @default(uuid())
  propertyId      String   @map("property_id")          // TCAD unique identifier
  name            String                                 // Owner name
  propType        String   @map("prop_type")            // Property type
  city            String?                                // City location
  propertyAddress String   @map("property_address")     // Full address
  assessedValue   Float?   @map("assessed_value")       // Tax assessed value
  appraisedValue  Float    @map("appraised_value")      // Appraised value
  geoId           String?  @map("geo_id")               // Geographic ID
  description     String?  @db.Text                      // Legal description
  searchTerm      String?  @map("search_term")          // Discovery search term
  scrapedAt       DateTime @default(now()) @map("scraped_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  year            Int                                    // Tax year

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
  id              String    @id @default(uuid())
  searchTerm      String    @map("search_term")
  status          String    // pending, processing, completed, failed
  resultCount     Int?      @map("result_count")
  totalApiResults Int?      @map("total_api_results")    // Raw TCAD API count (before dedup)
  updatedCount    Int?      @map("updated_count")        // Properties updated (not new)
  newPropertyIds  String[]  @map("new_property_ids")     // Property IDs for new inserts
  error           String?   @db.Text
  startedAt       DateTime  @default(now()) @map("started_at")
  completedAt     DateTime? @map("completed_at")

  @@index([status, startedAt])
  @@index([searchTerm])
  @@map("scrape_jobs")
}
```

### MonitoredSearch Model

Enables automated recurring scrapes with configurable frequency.

```prisma
model MonitoredSearch {
  id         String   @id @default(uuid())
  searchTerm String   @unique @map("search_term")
  active     Boolean  @default(true)
  frequency  String   @default("daily")  // daily, weekly, monthly
  lastRun    DateTime? @map("last_run")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@map("monitored_searches")
}
```

**Database Statistics** (as of March 2026):
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

- **Node.js 20+** and npm
- **Doppler CLI** (for secrets management — all DB/Redis credentials are remote)
- **Docker** (optional — only needed for local Redis fallback)

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

3. **Install server dependencies:**
```bash
cd server
npm install
```

### Database Configuration

The application requires a PostgreSQL database. The connection is configured using the `DATABASE_URL` environment variable.

**Example:**
`DATABASE_URL="postgresql://user:password@host:port/database"`

You can set this environment variable in a `.env` file in the `server/` directory or by using a secrets management tool like Doppler.

If the `DATABASE_URL` is not set, the application will throw an error and refuse to start.

4. **Set up Doppler (recommended for production):**
```bash
# Install Doppler CLI
brew install dopplerhq/cli/doppler  # macOS
# See doppler-setup.md for other platforms

# Login and setup
doppler login
cd server
doppler setup  # Select project and config

# Set required secrets
doppler secrets set DATABASE_URL="postgresql://user:password@host:5432/tcad_scraper"
doppler secrets set REDIS_URL="rediss://user:pass@oregon-keyvalue.render.com:6379"
doppler secrets set JWT_SECRET="your-secure-random-secret"
doppler secrets set API_KEY="your-api-key"
doppler secrets set FRONTEND_URL="http://localhost:5174"
doppler secrets set ANTHROPIC_API_KEY="sk-ant-api03-xxxxx"  # For Claude AI search
```

**Alternative**: Create `.env` file in `server/` directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/tcad_scraper"
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secure-random-secret
API_KEY=your-api-key
FRONTEND_URL=http://localhost:5174
FRONTEND_PORT=5174
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
NODE_ENV=development
PORT=3001
HOST=localhost
LOG_LEVEL=info
```

5. **Initialize database:**
```bash
cd server
doppler run -- npx prisma db push
# Or without Doppler:
npx prisma db push
```

7. **Start the Express API server:**
```bash
cd server
doppler run -- npm run dev
# Or without Doppler:
npm run dev
```

8. **Start the React frontend** (separate terminal):
```bash
# From project root
npm run dev
```

### Access Points

- **Frontend UI**: http://localhost:5174
- **Backend API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/health
- **Bull Dashboard**: http://localhost:3001/admin/queues
- **Prisma Studio**: Run `npx prisma studio` from server/ (opens on port 5555)

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
curl http://localhost:3001/api/properties?city=Austin&limit=25
```

#### GET /api/properties/:id
Retrieve a specific property by ID.

**Example:**
```bash
curl http://localhost:3001/api/properties/abc-123-def
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
curl -X POST http://localhost:3001/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "properties in Austin worth over 1 million"}'
```

**Supported Query Types:**
- Location: "properties in Austin", "homes in Round Rock"
- Value: "properties worth over 500k", "homes under $200,000"
- Type: "residential properties", "commercial buildings"
- Owner: "properties owned by Smith"
- Combined: "residential properties in Austin worth over 1M"

See `server/src/lib/claude.service.ts` for implementation details.

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
curl http://localhost:3001/api/properties/search/test
```

#### POST /api/properties/scrape/:propertyId
Trigger a scrape for a specific property ID.

**Rate Limited:** 5 requests per minute per IP

**Example:**
```bash
curl -X POST http://localhost:3001/api/properties/scrape/123456
```

#### POST /api/properties/scrape/batch
Queue multiple search terms for scraping.

**Rate Limited:** 5 requests per minute per IP

**Body:**
```json
{
  "searchTerms": ["Smith", "123 Oak St", "Austin TX"]
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/properties/scrape/batch \
  -H "Content-Type: application/json" \
  -d '{"searchTerms": ["Smith", "123 Oak St"]}'
```

### Health & Monitoring

#### GET /health
Application health check.

**Response:**
```json
{
  "status": "ok",
  "propertyCount": 418000,
  "runtime": "cloudflare-workers"
}
```

### Authentication

The API supports optional authentication via:

1. **JWT Bearer Token:**
```bash
curl -H "Authorization: Bearer your-jwt-token" \
  http://localhost:3001/api/properties
```

2. **API Key:**
```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:3001/api/properties
```

By default, authentication is optional in development. Configure `JWT_SECRET` and `API_KEY` in Doppler for production use.

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
# Generate and enqueue backfill terms (uses legacy BullMQ)
doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue

# Config-driven batch types (18 types)
doppler run -- npx tsx scripts/enqueue-batch.ts <batch-type>

# Tail term optimizer
TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts
```

### TCAD API Token Management

Tokens expire every ~5 minutes. In Workers, a cron trigger refreshes tokens every 4 minutes and caches in KV. See [TOKEN_MANAGEMENT.md](docs/TOKEN_MANAGEMENT.md).

### Available npm Scripts

```bash
# Workers (from workers/tcad-api/)
npm run dev                        # Local dev server (wrangler dev)
npm run deploy                     # Deploy to Cloudflare

# Server (from server/, legacy)
npm test                           # Unit tests (Vitest, 680+ tests)
npm run test:integration           # Integration tests
npm run prisma:generate            # Generate Prisma client
npm run prisma:studio              # Open Prisma Studio
```

## Docker Services (Optional)

Docker is **not required** for development. PostgreSQL is on Render (accessed via Hyperdrive in production, Doppler in local dev). Redis is no longer needed (replaced by KV).

## Deployment

The frontend deploys automatically to **GitHub Pages** via GitHub Actions on push to `main`. The custom domain `alephatx.info` is configured via CNAME.

The API runs on **Cloudflare Workers** at `api.alephatx.info`.

**Deploy Workers API:**
```bash
cd workers/tcad-api
npx wrangler deploy
```

**Workers Secrets** (set via `wrangler secret put`):
- `API_KEY`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `SENTRY_DSN`, `TOKEN_WORKER_URL`, `TOKEN_WORKER_SECRET`

**Required GitHub Secrets:**
- `DOPPLER_TOKEN`: Access to Doppler secrets (provides `VITE_API_URL` at build time)

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

### Database Queries

**Check property count (via Prisma):**
```bash
# From server/ directory (requires DATABASE_URL via Doppler or .env)
cd server
doppler run -- npx tsx --eval "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.property.count({ where: { year: 2025 } })
  .then(c => { console.log('2025 properties:', c); return p.\$disconnect(); })
  .then(() => process.exit(0));
"
```

**Check property count (via psql):**
```bash
psql $DATABASE_URL -c "SELECT year, COUNT(*) FROM properties GROUP BY year ORDER BY year;"
```

**Top search terms by effectiveness (from `search_term_analytics` table):**
```bash
cd server
doppler run -- npx tsx --eval "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.\$queryRaw\`
  SELECT search_term, total_results, total_searches, successful_searches,
         avg_results_per_search, max_results, efficiency, success_rate
  FROM search_term_analytics
  WHERE last_searched >= '2025-01-01' AND total_results > 0
  ORDER BY total_results DESC
  LIMIT 50
\`.then(r => { console.table(r); return p.\$disconnect(); })
  .then(() => process.exit(0));
"
```

**Enqueue top search terms for re-scraping:**
```bash
# Generate term list and pipe into enqueue script (from repo root)
# Note: enqueue-terms.ts filters out terms < 4 chars
echo "Pflugerville
John
Mary
James" | doppler run -- npx tsx scripts/enqueue-terms.ts
```

**View recent scrape jobs:**
```sql
SELECT search_term, status, result_count, started_at, completed_at
FROM scrape_jobs
ORDER BY started_at DESC
LIMIT 20;
```

**Property distribution by city:**
```sql
SELECT city, COUNT(*) as count
FROM properties
WHERE city IS NOT NULL
GROUP BY city
ORDER BY count DESC;
```

## Analytics

The TCAD Scraper frontend implements comprehensive user behavior tracking using **Google Analytics 4 (GA4)** and **Meta Pixel** to monitor application usage, search patterns, and user engagement.

### Tracking Overview

**Active Tracking IDs:**
- Google Analytics 4: `G-J7TL7PQH7S`
- Google Tag Manager: `G-ECH51H8L2Z`
- Meta Pixel: `25629020546684786`

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
- Property: TCAD Scraper (G-J7TL7PQH7S)
- Real-time Events: Reports → Real-Time → Events
- Custom Reports: 4 pre-configured reports (Search Performance, Property Engagement, User Journey Funnel, Error Monitoring)

**Meta Events Manager:**
- Access: https://business.facebook.com/events_manager
- Pixel: 25629020546684786
- Test Events: Real-time event verification
- Custom Conversions: Successful searches, high engagement sessions

### Implementation

Analytics are implemented using:
- **Core Library**: `src/lib/analytics.ts` (201 lines)
- **React Hook**: `src/hooks/useAnalytics.ts` (58 lines)
- **Error Boundary**: `src/components/ErrorBoundary.tsx`
- **Tracking Scripts**: Loaded in `index.html` (GA4 + Meta Pixel)

Components with integrated tracking:
- `App.tsx` - Page view tracking
- `PropertySearchContainer.tsx` - Search and results tracking
- `PropertyCard.tsx` - Property view tracking
- `ExampleQueries.tsx` - Example click tracking

### Documentation

For complete analytics implementation details, dashboard configuration, troubleshooting, and privacy compliance:

📖 **[docs/ANALYTICS.md](docs/ANALYTICS.md)** - Comprehensive analytics guide (1,052 lines)

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
# Open http://localhost:4174
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

### Database Issues

**Connection errors:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Prisma schema sync
cd server
npx prisma db push

# Regenerate Prisma client
npx prisma generate
```

**Slow queries:**
```bash
# Check indexes
psql $DATABASE_URL -c "
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'properties';
"

# Analyze table
psql $DATABASE_URL -c "ANALYZE properties;"
```

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

The canonical implementation is in `server/src/lib/tcad-api-client.ts`.

### 5. Truncated API Responses

Some TCAD search terms return malformed/truncated JSON responses regardless of specificity. See [docs/truncated-response-terms.md](docs/truncated-response-terms.md) for affected terms and status.

## Recent Updates

See [docs/CHANGELOG.md](docs/CHANGELOG.md) for complete version history.

**Latest** (March 30, 2026):
- **Legacy stack cleanup** — Removed BullMQ queues, Redis token service, Prometheus/Grafana monitoring, K6 load tests, CLI tools, and render.yaml (~9,800 lines deleted)
- **KV offload for large scrape results** — Workflow step outputs capped at 1MiB; large terms (e.g. "Trust" with 60K+ results) now stored in RESPONSE_CACHE KV with 1hr TTL
- **OpenAI fallback for natural language search** — claude.service.ts uses Anthropic primary with OpenAI fallback; Zod runtime validation on AI responses
- **Integration test safety** — Prevented integration tests from wiping production database
- **Search Term Efficiency Optimization** — Analyzed 313 unique search terms across 365K properties with zero overlap among top 30 terms. Tier 1-4 strategy: Tier 1 (15 terms) = 19.6% coverage, Tier 1+2 (50 terms) = 45.1%, Tier 1+2+3 (200 terms) = 92.1%
- **E2E Tests** — All 126 Playwright tests passing (API response shape + route mocking fixes)
- **Cloudflare Workers migration complete** (Phases 0-5): API, queue processing, caching, and scheduled tasks all running on Workers
- 680+ unit tests, 126 E2E tests passing

## Documentation

Comprehensive documentation is available in the `docs/` directory:

### Primary Documentation
- **[SETUP.md](docs/SETUP.md)** - Installation and setup guide
- **[TESTING.md](docs/TESTING.md)** - Testing strategy and test execution (Vitest)
- **[CHANGELOG.md](docs/CHANGELOG.md)** - Version history and detailed changes
- **[BACKLOG.md](docs/BACKLOG.md)** - Technical debt and open items tracking

### Frontend Documentation
- **[PropertySearch Component Guide](src/components/features/PropertySearch/README.md)** - PropertyCard expansion UI

### API & Monitoring
- **[ANALYTICS.md](docs/ANALYTICS.md)** - Analytics implementation guide (GA4 + Meta Pixel)
- **[API.md](docs/API.md)** - API documentation

### Technical Documentation
- **[SEARCH_TERM_STRATEGY.md](SEARCH_TERM_STRATEGY.md)** - Tier-based search term efficiency strategy with API call estimates
- **[SEARCH_TERM_ANALYSIS.md](SEARCH_TERM_ANALYSIS.md)** - Full ranked analysis of all 313 search terms with efficiency metrics
- **[CLOUDFLARE_MIGRATION_PLAN.md](docs/CLOUDFLARE_MIGRATION_PLAN.md)** - Workers migration plan (Phases 0-5, all complete)
- **[TOKEN_MANAGEMENT.md](docs/TOKEN_MANAGEMENT.md)** - Token management and auto-refresh
- **[doppler-setup.md](docs/doppler-setup.md)** - Doppler CLI installation and configuration
- **[CI-CD.md](docs/CI-CD.md)** - CI/CD pipeline configuration

### Server-Specific Documentation
- **[server/README.md](server/README.md)** - Server setup, troubleshooting, requeue scripts
- **[scripts/README.md](scripts/README.md)** - Full scripts inventory and usage

---

## Contributing

Server Configuration and Architecture: Micah Linsay
Front-end Architecture and initial tcad scraping logic: John Skelton
Authentication, API, Queue Management & Batch Optimization: Alyshia Ledlie

## License

Proprietary - All rights reserved.

## Contact

**Repository**: https://github.com/aledlie/tcad-scraper
**Issues**: https://github.com/aledlie/tcad-scraper/issues

---

**Built with ❤️  for Karen, by John, Micah, and Alyshia**
