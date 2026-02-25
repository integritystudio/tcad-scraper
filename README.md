# TCAD Scraper

A production-grade web scraping system for automated collection of property tax information from the Travis Central Appraisal District (TCAD) website. Built with TypeScript, Express, Playwright, Prisma, and PostgreSQL with a distributed queue-based architecture for scalable data collection.

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
- [Docker Services](#docker-services)
- [Monitoring & Metrics](#monitoring--metrics)
- [Analytics](#analytics)
- [Troubleshooting](#troubleshooting)
- [Known Issues](#known-issues)
- [Documentation](#documentation)
- [Recent Updates](#recent-updates)

## Overview

TCAD Scraper is a production application that automates the collection and storage of property tax data from travis.prodigycad.com. The system provides both a REST API and a React frontend for accessing property data, with continuous batch scraping using intelligent search term generation to discover and catalog properties across Travis County.

The application supports two scraping methods:
1. **API-based scraping** (Recommended): Direct API calls bypassing the UI limitation, supporting 1000+ results per search
2. **Browser-based scraping** (Fallback): Playwright automation extracting data from AG Grid UI (limited to 20 results per search)

## Key Features

### Data Collection
- **Dual Scraping Methods**: API-based (high-volume) and browser-based (fallback) scraping
- **Continuous Batch Scraping**: Automated 24/7 scraping with intelligent, weighted search term generation
- **Background Job Processing**: BullMQ queue system with Redis managing distributed scraping jobs
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
- **RESTful API**: Express server with rate limiting, CORS, security middleware
- **AI-Powered Search**: Natural language property search using Claude AI (Anthropic)
- **Bull Dashboard**: Web UI for monitoring job queues at `/admin/queues`
- **React Frontend**: Modern UI for searching and viewing property data
  - **Expandable Property Cards**: Progressive disclosure UI pattern for detailed property information
  - **Financial Analysis**: Visual comparison of appraised vs assessed values with difference calculations
  - **Data Freshness Indicators**: Color-coded badges showing data age and quality
  - **Mobile Responsive**: Optimized layouts for mobile (< 640px), tablet (640px-1024px), and desktop
  - **WCAG Compliant**: Full keyboard navigation and screen reader support
- **Optional Authentication**: JWT and API key support for production environments
- **Health Monitoring**: Endpoints for application and queue health checks

### Infrastructure
- **Playwright-based Automation**: Headless browser with anti-detection features
- **Docker Compose**: Orchestration for Redis, Prometheus, and BullMQ metrics
- **Doppler Integration**: Secure secrets management for environment variables
- **Pino Logging**: Structured JSON logging for debugging and monitoring
- **Prometheus Metrics**: Queue performance and system metrics collection

## Technology Stack

### Core Application
- **Node.js 18+** with **TypeScript 5.3** for type safety
- **Express 4.18** for REST API server
- **Playwright 1.41+** for headless browser automation
- **Prisma ORM 5.8** for type-safe database access
- **BullMQ** for distributed job queue management
- **Bull Board** for queue monitoring dashboard
- **Zod** for runtime type validation
- **Anthropic Claude AI** for natural language search parsing

### Infrastructure & DevOps
- **PostgreSQL 15+** - Primary database
- **Redis 7** (Docker container `bullmq-redis`) - Job queue and state management
- **Prometheus** (Docker container `prometheus`) - Metrics collection and monitoring
- **BullMQ Metrics Exporter** - Custom metrics exporter for queue statistics
- **Docker Compose** for service orchestration
- **Doppler** for environment variable and secrets management

### Frontend (React Application)
- **React 19.2** with TypeScript
- **Vite 7.1** for development and building
- **CSS Modules** for component styling
- **Progressive UI** with expandable property cards

### Security & Middleware
- **Helmet** for security headers
- **CORS** for cross-origin resource sharing
- **express-rate-limit** for API rate limiting
- **JWT** (jsonwebtoken) for authentication
- **API Key** authentication support

### Deployment Environment
- **Ubuntu Linux** (remote server)
- **PM2** for process management
## Architecture

### System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  Express API     │────▶│  PostgreSQL     │
│  (Port 5174)    │     │  (Port 3001)     │     │  Database       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               │ BullMQ Jobs
                               ▼
                        ┌──────────────────┐
                        │  Redis Queue     │
                        │  (Port 6379)     │
                        └──────────────────┘
                               │
                               │ Process Jobs
                               ▼
                        ┌──────────────────┐
                        │  Scraper Workers │
                        │  (Playwright)    │
                        └──────────────────┘
                               │
                        ┌──────┴──────┐
                        ▼             ▼
                  API Method     Browser Method
```

### Data Flow

#### Continuous Batch Scraping (Production)

1. **Batch Generator** (`continuous-batch-scraper.ts`)
   - Generates diverse search terms using weighted strategies
   - Loads previously used terms from database to avoid duplicates
   - Queues batches of 75 search jobs to BullMQ
   - Maintains queue size between 100-500 pending jobs
   - Runs continuously 24/7 targeting 400,000+ properties
   - Refresh database term cache every hour

2. **BullMQ Job Queue** (Redis-backed)
   - Receives search term jobs from batch generator
   - Distributes jobs to available workers
   - Handles retries with exponential backoff
   - Tracks job state (waiting, active, completed, failed)
   - Provides metrics to Prometheus for monitoring

3. **Scraper Workers** (`tcad-scraper.ts` via queue)
   - **API Method** (Primary):
     - Direct HTTP calls to TCAD backend API
     - Fetches 1000+ results per search
     - Parses JSON responses directly
     - Handles token refresh every ~5 minutes
   - **Browser Method** (Fallback):
     - Launch Playwright headless browsers
     - Navigate to travis.prodigycad.com
     - Search for properties using generated terms
     - Parse AG Grid DOM elements (limited to 20 results)
     - Handle "no results" gracefully

4. **Data Processing**
   - Extract property data from API/browser responses
   - Transform and validate using Zod schemas
   - Store in PostgreSQL via Prisma ORM
   - Upsert properties by unique propertyId (deduplication)
   - Log scrape jobs with status, timing, and results

5. **Database Layer** (Prisma ORM)
   - Upsert properties to prevent duplicates
   - Log all scrape jobs with status and timing
   - Track search terms and result counts
   - Index optimization for fast queries

## Project Structure

```
tcad-scraper/
├── server/                          # Express API application
│   ├── src/
│   │   ├── index.ts                 # Main Express server entry point
│   │   ├── lib/
│   │   │   ├── tcad-scraper.ts      # Core Playwright scraper with dual methods
│   │   │   └── prisma.ts            # Prisma database client singleton
│   │   ├── queues/
│   │   │   └── scraper.queue.ts     # BullMQ job queue configuration
│   │   ├── routes/
│   │   │   └── property.routes.ts   # API routes for property endpoints
│   │   ├── middleware/
│   │   │   └── auth.ts              # JWT and API key authentication
│   │   ├── schedulers/
│   │   │   └── scrape-scheduler.ts  # Cron job scheduler
│   │   ├── scripts/
│   │   │   ├── continuous-batch-scraper.ts  # Main production scraper
│   │   │   ├── enqueue-batch.ts             # Config-driven batch enqueue runner
│   │   │   ├── config/
│   │   │   │   └── batch-configs.ts         # Batch type definitions (14 configs)
│   │   │   ├── batch-scrape.ts              # Manual batch scraping
│   │   │   ├── worker.ts                    # BullMQ worker process
│   │   │   └── test-*.ts                    # Various test scripts
│   │   ├── utils/
│   │   │   ├── error-helpers.ts             # getErrorMessage() utility
│   │   │   ├── property-transformers.ts     # transformPropertyToSnakeCase()
│   │   │   ├── timing.ts                    # humanDelay() shared timing
│   │   │   ├── browser-console-suppression.ts
│   │   │   ├── deduplication.ts
│   │   │   └── json-ld.utils.ts
│   │   └── types/
│   │       └── index.ts             # TypeScript type definitions
│   ├── prisma/
│   │   └── schema.prisma            # Database schema
│   ├── logs/                        # Application logs
│   ├── continuous-scraper.log       # Live scraper output
│   ├── package.json
│   └── tsconfig.json
├── src/                             # React frontend application
│   ├── App.tsx                      # Main React component
│   ├── components/                  # React components
│   ├── types/                       # Frontend type definitions
│   └── main.tsx                     # React entry point
├── docs/                            # Documentation
│   ├── MODERNIZATION_REPORT.md      # Architecture modernization guide
│   ├── DATABASE.md                  # Database documentation
│   ├── BATCH_SCRAPING_SUMMARY.md    # Batch scraping strategy
│   ├── SCRAPER_DEBUG_SESSION.md     # Debugging notes
│   └── CLAUDE.md                    # AI assistant context
├── bullmq-exporter/                 # Custom Prometheus exporter
├── docker-compose.yml               # Infrastructure services
├── docker-compose.override.yml      # Local overrides
├── doppler-setup.md                 # Doppler configuration guide
├── SETUP.md                         # Setup instructions
└── README.md                        # This file
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
  id          String    @id @default(uuid())
  searchTerm  String    @map("search_term")
  status      String    // pending, processing, completed, failed
  resultCount Int?      @map("result_count")
  error       String?   @db.Text
  startedAt   DateTime  @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")

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

**Database Statistics** (as of February 2026):
- Properties: 418,000+ unique records
- Scraping Rate: ~42,000 properties/hour (API method)
- Success Rate: ~80%
- Peak Single Scrape: 6,174 properties ("Ridge")

## Getting Started

### Prerequisites

- **Node.js 18+** and npm
- **Docker and Docker Compose** (for Redis, Prometheus)
- **PostgreSQL 15+** (local or remote instance)
- **Doppler CLI** (optional, for secrets management)
- **Playwright** with Chromium browser

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
npx playwright install chromium
npx playwright install-deps chromium  # Install system dependencies
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
doppler secrets set REDIS_HOST="localhost"
doppler secrets set REDIS_PORT="6379"
doppler secrets set JWT_SECRET="your-secure-random-secret"
doppler secrets set API_KEY="your-api-key"
doppler secrets set FRONTEND_URL="http://localhost:5174"
doppler secrets set ANTHROPIC_API_KEY="sk-ant-api03-xxxxx"  # For Claude AI search
```

**Alternative**: Create `.env` file in `server/` directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/tcad_scraper"
REDIS_HOST=localhost
REDIS_PORT=6379
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

5. **Start infrastructure services:**
```bash
# From project root
docker-compose up -d

# Verify services are running
docker-compose ps
```

6. **Initialize database:**
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
- **Backend API**: http://localhost:5050/api
- **Health Check**: http://localhost:5050/health
- **Queue Health**: http://localhost:5050/health/queue
- **Bull Dashboard**: http://localhost:5050/admin/queues
- **Prisma Studio**: Run `npx prisma studio` from server/ (opens on port 5555)
- **Prometheus**: http://localhost:9090 (if enabled)
- **BullMQ Metrics**: http://localhost:3000 (if enabled)

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
curl http://localhost:5050/api/properties?city=Austin&limit=25
```

#### GET /api/properties/:id
Retrieve a specific property by ID.

**Example:**
```bash
curl http://localhost:5050/api/properties/abc-123-def
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
curl -X POST http://localhost:5050/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "properties in Austin worth over 1 million"}'
```

**Supported Query Types:**
- Location: "properties in Austin", "homes in Round Rock"
- Value: "properties worth over 500k", "homes under $200,000"
- Type: "residential properties", "commercial buildings"
- Owner: "properties owned by Smith"
- Combined: "residential properties in Austin worth over 1M"

See [docs/CLAUDE_SEARCH.md](docs/CLAUDE_SEARCH.md) for detailed documentation.

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
curl http://localhost:5050/api/properties/search/test
```

#### POST /api/properties/scrape/:propertyId
Trigger a scrape for a specific property ID.

**Rate Limited:** 5 requests per minute per IP

**Example:**
```bash
curl -X POST http://localhost:5050/api/properties/scrape/123456
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
curl -X POST http://localhost:5050/api/properties/scrape/batch \
  -H "Content-Type: application/json" \
  -d '{"searchTerms": ["Smith", "123 Oak St"]}'
```

### Health & Monitoring

#### GET /health
Application health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-11-03T12:00:00.000Z",
  "uptime": 3600,
  "environment": "development"
}
```

#### GET /health/queue
Queue system health check.

**Response:**
```json
{
  "status": "healthy",
  "queue": {
    "name": "scraper-queue",
    "waiting": 250,
    "active": 4,
    "completed": 12543,
    "failed": 45
  }
}
```

### Authentication

The API supports optional authentication via:

1. **JWT Bearer Token:**
```bash
curl -H "Authorization: Bearer your-jwt-token" \
  http://localhost:5050/api/properties
```

2. **API Key:**
```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:5050/api/properties
```

By default, authentication is optional in development. Configure `JWT_SECRET` and `API_KEY` in Doppler for production use.

## Running the Scraper

### Continuous Production Scraper

#### Using PM2 (Recommended)

The preferred way to run the scraper in production with PM2 process management:

```bash
cd server

# Start with PM2 using ecosystem config
pm2 start ecosystem.config.js

# Or start just the continuous-enqueue process
pm2 start continuous-enqueue

# Monitor processes
pm2 list
pm2 status continuous-enqueue

# View logs
pm2 logs continuous-enqueue
pm2 logs continuous-enqueue --lines 100

# Restart process
pm2 restart continuous-enqueue

# Stop process
pm2 stop continuous-enqueue

# Save PM2 configuration (persists across reboots)
pm2 save
pm2 startup  # Follow instructions to enable auto-start on boot
```

#### Using Direct Process

Alternative method without PM2:

```bash
cd server

# With Doppler
doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts > continuous-scraper.log 2>&1 &

# Without Doppler
DATABASE_URL="postgresql://localhost:5432/tcad_scraper" \
  npx tsx src/scripts/continuous-batch-scraper.ts > continuous-scraper.log 2>&1 &

# Save PID for later
echo $! > continuous-scraper.pid
```

**Monitor scraper logs:**
```bash
tail -f continuous-scraper.log
```

**Check scraper status:**
```bash
ps aux | grep continuous-batch-scraper
# Or using saved PID:
ps -p $(cat continuous-scraper.pid)
```

**Stop the scraper:**
```bash
pkill -f "continuous-batch-scraper"
# Or using saved PID:
kill $(cat continuous-scraper.pid)
```

#### TCAD API Token Management

The TCAD API requires token refresh every ~5 minutes. An automated cron job handles this:

```bash
# View current cron jobs
crontab -l

# The cron job (already configured):
# */4 * * * * /home/aledlie/tcad-scraper/scripts/refresh-tcad-token.sh >> /home/aledlie/tcad-scraper/logs/token-refresh-cron.log 2>&1

# Monitor token refresh logs
tail -f /home/aledlie/tcad-scraper/logs/token-refresh-cron.log

# Manually refresh token if needed
/home/aledlie/tcad-scraper/scripts/refresh-tcad-token.sh
```

**Token refresh runs every 4 minutes automatically**, preventing HTTP 401 errors during continuous scraping.

### Priority Search Terms

Add high-value search terms to the front of the queue with priority 1:

```bash
cd server

# Use the priority enqueue script (edit terms in the file)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" \
  doppler run -- npx tsx src/scripts/enqueue-priority-terms.ts

# The script adds terms like "Real", "Estate", "Trust", "Part", "Hill"
# These process before other pending jobs
```

**Performance Notes:**
- Priority 1 jobs process first
- High-value terms like "Real", "Estate" return 3,000-6,000 properties each
- Typical scraping rate: ~3,000 properties/minute
- Peak performance: 10,000-15,000 properties/minute during large job completions

### Manual Batch Scraping

Run one-time batch scrapes with specific strategies:

```bash
cd server

# Scrape using city names
npm run scrape:batch:cities

# Scrape using ZIP codes
npm run scrape:batch:zipcodes

# Comprehensive scrape with custom parameters
npm run scrape:batch:comprehensive
# Or manually:
doppler run -- tsx src/scripts/batch-scrape.ts comprehensive 10 5000
```

### Worker Process

Run a standalone worker to process queued jobs:

```bash
cd server
doppler run -- npx tsx src/scripts/worker.ts
```

### Available npm Scripts

From `server/` directory:

```bash
npm run dev                        # Start Express API in development mode
npm run build                      # Compile TypeScript to JavaScript
npm run start                      # Run compiled production build
npm run scrape:batch               # Run batch scraper
npm run scrape:batch:cities        # Scrape with city names
npm run scrape:batch:zipcodes      # Scrape with ZIP codes
npm run scrape:batch:comprehensive # Comprehensive scraping
npm run prisma:generate            # Generate Prisma client
npm run prisma:migrate             # Run database migrations
npm run prisma:studio              # Open Prisma Studio
npm test                           # Run unit tests (Vitest, 617 tests)
npm run test:integration           # Run integration tests
npm run lint                       # Run ESLint
```

## Docker Services

The application uses Docker Compose for infrastructure services defined in `docker-compose.yml`:

### Services

#### Redis (bullmq-redis)
- **Image**: redis:7-alpine
- **Port**: 6379
- **Purpose**: BullMQ job queue and state management
- **Volume**: `redis-data`
- **Features**: AOF persistence enabled

#### BullMQ Metrics Exporter (bullmq-metrics)
- **Build**: `./bullmq-exporter`
- **Port**: 3000
- **Purpose**: Export BullMQ metrics to Prometheus
- **Environment**:
  - `REDIS_HOST=redis`
  - `REDIS_PORT=6379`
  - `PORT=3000`
- **Dependencies**: redis

### Service Management

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs redis
docker-compose logs prometheus
docker-compose logs bullmq-metrics

# View live logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v

# Restart a single service
docker-compose restart redis
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect a volume
docker volume inspect tcad-scraper_redis-data

# Backup Redis data
docker run --rm -v tcad-scraper_redis-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/redis-backup.tar.gz /data
```

### PostgreSQL Note

PostgreSQL is **not** included in docker-compose.yml. The application expects a PostgreSQL instance configured via `DATABASE_URL` environment variable. This can be:
- Local PostgreSQL installation
- Remote hosted database (RDS, DigitalOcean, etc.)
- Docker container managed separately

To run PostgreSQL in Docker manually:
```bash
docker run --name tcad-postgres -d \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tcad_scraper \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine
```

## Deployment

The frontend deploys automatically to **GitHub Pages** via GitHub Actions on push to `main`. The custom domain `alephatx.info` is configured via CNAME.

The API runs on **Render** at `api.alephatx.info`.

**Required GitHub Secrets:**
- `DOPPLER_TOKEN`: Access to Doppler secrets (provides `VITE_API_URL` at build time)

**Production URLs:**
- Frontend: https://alephatx.info
- API: https://api.alephatx.info/api
- Health: https://api.alephatx.info/health

## Monitoring & Metrics


### Bull Dashboard

Access the BullMQ dashboard at http://localhost:5050/admin/queues to monitor:
- Queue status (waiting, active, completed, failed jobs)
- Job processing times
- Error rates and failed jobs
- Individual job details and logs
- Retry attempts

### Prometheus Metrics

Access Prometheus at http://localhost:9090 to query metrics:

**Useful Queries:**
```promql
# Queue length over time
bull_queue_waiting{queue="scraper-queue"}

# Job processing rate
rate(bull_queue_completed_total[5m])

# Failed jobs
bull_queue_failed_total

# Active workers
bull_queue_active
```

**View logs:**
```bash
# Tail all logs
tail -f server/logs/combined.log

# Search for errors
grep -i error server/logs/combined.log

# View recent scraper activity
tail -100 server/continuous-scraper.log
```

### Database Queries

**Check property count:**
```bash
# If using local PostgreSQL:
psql -U postgres -d tcad_scraper -c "SELECT COUNT(*) FROM properties;"

# Via Docker (if running PostgreSQL in container):
docker exec tcad-postgres psql -U postgres -d tcad_scraper \
  -c "SELECT COUNT(*) FROM properties;"
```

**View recent scrape jobs:**
```sql
SELECT search_term, status, result_count, started_at, completed_at
FROM scrape_jobs
ORDER BY started_at DESC
LIMIT 20;
```

**Top search terms by results:**
```sql
SELECT search_term, COUNT(*) as property_count
FROM properties
WHERE search_term IS NOT NULL
GROUP BY search_term
ORDER BY property_count DESC
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

### Scraper Issues

**Scraper not running:**
```bash
# Check if process exists
ps aux | grep continuous-batch-scraper

# Check for errors in log
tail -100 continuous-scraper.log | grep -i error

# Restart scraper
pkill -f "continuous-batch-scraper"
cd server
doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts > continuous-scraper.log 2>&1 &
```

**No properties being scraped:**
```bash
# Check queue status
curl http://localhost:5050/health/queue

# Check Redis connection
docker exec bullmq-redis redis-cli PING
# Should return: PONG

# Check queue lengths
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:wait"
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:active"
```

**Browser/Playwright errors:**
```bash
# Reinstall Playwright
cd server
npx playwright install chromium
npx playwright install-deps chromium

# Check for system dependencies (Linux)
npx playwright install-deps
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

### Redis/Queue Issues

**Queue stuck:**
```bash
# Check Redis container
docker ps | grep bullmq-redis
docker logs bullmq-redis

# Clear completed jobs (older than 1 day)
docker exec bullmq-redis redis-cli --scan --pattern "bull:scraper-queue:*" | \
  xargs docker exec -i bullmq-redis redis-cli DEL

# Restart Redis
docker-compose restart redis
```

**Failed jobs accumulating:**
```bash
# View failed jobs in Bull Dashboard
open http://localhost:5050/admin/queues

# Or query Redis directly
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:failed"

# Retry all failed jobs (via Bull Dashboard UI)
```

### API Server Issues

**Server won't start:**
```bash
# Check for port conflicts
lsof -i :3001

# Check environment variables
cd server
doppler run -- env | grep -E "(DATABASE_URL|REDIS)"

# Check server logs
tail -50 server/logs/error.log
```

**High memory usage:**
```bash
# Check Node.js heap usage
node --inspect server/dist/index.js

# Monitor with htop
htop -p $(pgrep -f "node.*index.js")
```

### Docker Issues

**Services not starting:**
```bash
# Check Docker daemon
docker info

# View service logs
docker-compose logs

# Restart all services
docker-compose restart

# Rebuild services
docker-compose down
docker-compose up -d --build
```

**Volume permission issues:**
```bash
# Fix volume permissions (Linux)
sudo chown -R $(whoami):$(whoami) ./redis-data

# Or recreate volumes
docker-compose down -v
docker-compose up -d
```

## Known Issues and Limitations

### 1. TCAD Website Pagination Limitation (Browser Method)

When using browser-based scraping, TCAD's AG Grid pagination controls are hidden (CSS class `ag-hidden`), limiting each search to **20 results maximum**.

**Workaround**: The system uses two strategies:
- **Primary**: API-based scraping (1000+ results per search) - **RECOMMENDED**
- **Fallback**: Diverse search term generation to maximize unique property discovery

**Attempted Solutions** (all unsuccessful for browser method):
- AG Grid API access (gridOptions not exposed to page context)
- Page size input manipulation (pagination panel hidden via CSS)
- Pagination button clicking (buttons not accessible in DOM)
- JavaScript injection to modify grid state

### 2. API Token Expiration

The API-based scraping method requires token refresh every ~5 minutes. The scraper handles this automatically, but rapid scraping may occasionally hit rate limits.

**Solution Implemented**:
- Automated cron job refreshes token every 4 minutes
- Cron logs to `/home/aledlie/tcad-scraper/logs/token-refresh-cron.log`
- Provides 1-minute buffer before expiration
- Prevents HTTP 401 errors during continuous scraping

**Mitigation**: The system implements exponential backoff and automatic retry logic.

### 3. Search Result Variability

Many random search terms return 0 results (expected behavior). The system:
- Tracks used search terms to avoid repetition
- Weights search strategies toward successful patterns
- Saves screenshots of empty results for debugging

### 4. Rate Limiting

Aggressive scraping may trigger TCAD rate limiting. The system:
- Uses human-like delays between requests
- Distributes jobs across time
- Rotates user agents and viewports
- (Optional) Bright Data proxy support (currently disabled)

### 5. Memory Usage

Long-running scraper processes can accumulate memory. Recommended:
- Restart scraper process daily via cron
- Use systemd service with restart policies

## Recent Updates

See [docs/CHANGELOG.md](docs/CHANGELOG.md) for complete version history.

**Latest** (February 9, 2026): All technical debt cleared (TD-2 through TD-40). 617 tests passing. DRY refactoring consolidated 10 enqueue scripts, extracted shared utilities, added configurable `TCAD_YEAR` and `QUEUE_BATCH_CHUNK_SIZE` env vars.

## Documentation

Comprehensive documentation is available in the `docs/` directory:

### Primary Documentation
- **[SETUP.md](docs/SETUP.md)** - Installation and setup guide
- **[TESTING.md](docs/TESTING.md)** - Testing strategy and test execution (Vitest)
- **[CHANGELOG.md](docs/CHANGELOG.md)** - Version history and detailed changes
- **[BACKLOG.md](docs/BACKLOG.md)** - Technical debt tracking (currently cleared)

### Frontend Documentation
- **[PropertySearch Component Guide](src/components/features/PropertySearch/README.md)** - PropertyCard expansion UI
- **[VISUAL_DESIGN_PLAN.md](docs/VISUAL_DESIGN_PLAN.md)** - Visual design system and UI patterns
- **[VISUAL_WIREFRAMES.md](docs/VISUAL_WIREFRAMES.md)** - ASCII wireframes and interaction diagrams

### API & Monitoring
- **[ANALYTICS.md](docs/ANALYTICS.md)** - Analytics implementation guide (GA4 + Meta Pixel)
- **[API.md](docs/API.md)** - API documentation

### Technical Documentation
- **[API_TOKEN_IMPLEMENTATION.md](docs/API_TOKEN_IMPLEMENTATION.md)** - API token authentication implementation
- **[TOKEN_AUTO_REFRESH.md](docs/TOKEN_AUTO_REFRESH.md)** - Automatic token refresh system
- **[XCONTROLLER-MIGRATION.md](docs/XCONTROLLER-MIGRATION.md)** - DataController migration guide
- **[doppler-setup.md](docs/doppler-setup.md)** - Doppler CLI installation and configuration
- **[CI-CD.md](docs/CI-CD.md)** - CI/CD pipeline configuration

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
