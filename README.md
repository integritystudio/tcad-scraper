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
- **Bull Dashboard**: Web UI for monitoring job queues at `/admin/queues`
- **React Frontend**: Modern UI for searching and viewing property data (in development)
- **Optional Authentication**: JWT and API key support for production environments
- **Health Monitoring**: Endpoints for application and queue health checks

### Infrastructure
- **Playwright-based Automation**: Headless browser with anti-detection features
- **Docker Compose**: Orchestration for Redis, Prometheus, and BullMQ metrics
- **Doppler Integration**: Secure secrets management for environment variables
- **Winston Logging**: Structured logging for debugging and monitoring
- **Prometheus Metrics**: Queue performance and system metrics collection

## Technology Stack

### Core Application
- **Node.js 18+** with **TypeScript 5.3** for type safety
- **Express 4.18** for REST API server
- **Playwright 1.41+** for headless browser automation
- **Prisma ORM 5.8** for type-safe database access
- **BullMQ** for distributed job queue management
- **Bull Board** for queue monitoring dashboard
- **Winston** for structured logging
- **Zod** for runtime type validation

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
- **CSS** for component styling

### Security & Middleware
- **Helmet** for security headers
- **CORS** for cross-origin resource sharing
- **express-rate-limit** for API rate limiting
- **JWT** (jsonwebtoken) for authentication
- **API Key** authentication support

### Deployment Environment
- **Ubuntu Linux** (remote server)
- **Systemd** for process management
- **Tailscale** for secure remote access

## Architecture

### System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  Express API     │────▶│  PostgreSQL     │
│  (Port 5173)    │     │  (Port 3001)     │     │  Database       │
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
│   │   │   ├── batch-scrape.ts              # Manual batch scraping
│   │   │   ├── worker.ts                     # BullMQ worker process
│   │   │   └── test-*.ts                     # Various test scripts
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
├── prometheus.yml                   # Prometheus configuration
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
  propertyId      String   @unique @map("property_id")  // TCAD unique identifier
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

  @@index([searchTerm, scrapedAt])
  @@index([propertyId])
  @@index([city])
  @@index([propType])
  @@index([appraisedValue])
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

**Database Statistics** (as of last update):
- Properties: 150,000+ unique records
- Scrape Jobs: 13,000+ operations logged
- Success Rate: ~98%+ successful scrapes

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
doppler secrets set FRONTEND_URL="http://localhost:5173"
```

**Alternative**: Create `.env` file in `server/` directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/tcad_scraper"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secure-random-secret
API_KEY=your-api-key
FRONTEND_URL=http://localhost:5173
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

- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/health
- **Queue Health**: http://localhost:3001/health/queue
- **Bull Dashboard**: http://localhost:3001/admin/queues
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
curl http://localhost:3001/api/properties?city=Austin&limit=25
```

#### GET /api/properties/:id
Retrieve a specific property by ID.

**Example:**
```bash
curl http://localhost:3001/api/properties/abc-123-def
```

#### GET /api/properties/search
Search properties by address, owner name, or property ID.

**Query Parameters:**
- `q` - Search query string

**Example:**
```bash
curl "http://localhost:3001/api/properties/search?q=123%20Main%20St"
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
  http://localhost:3001/api/properties
```

2. **API Key:**
```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:3001/api/properties
```

By default, authentication is optional in development. Configure `JWT_SECRET` and `API_KEY` in Doppler for production use.

## Running the Scraper

### Continuous Production Scraper

The recommended way to run the scraper in production:

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
npm test                           # Run tests
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

#### Prometheus (prometheus)
- **Image**: prom/prometheus:latest
- **Port**: 9090
- **Purpose**: Metrics collection and monitoring
- **Volume**: `prometheus-data`
- **Config**: `./prometheus.yml`
- **Dependencies**: bullmq-metrics

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

## Monitoring & Metrics

### Bull Dashboard

Access the BullMQ dashboard at http://localhost:3001/admin/queues to monitor:
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

### Application Logs

**Winston Log Files:**
- `server/logs/combined.log` - All logs
- `server/logs/error.log` - Error logs only
- `server/continuous-scraper.log` - Continuous scraper output

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
curl http://localhost:3001/health/queue

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
open http://localhost:3001/admin/queues

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
- Monitor with Prometheus metrics
- Restart scraper process daily via cron
- Use systemd service with restart policies

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[MODERNIZATION_REPORT.md](docs/MODERNIZATION_REPORT.md)** - Architecture analysis and modernization recommendations
- **[DATABASE.md](docs/DATABASE.md)** - Database schema and query examples
- **[BATCH_SCRAPING_SUMMARY.md](docs/BATCH_SCRAPING_SUMMARY.md)** - Batch scraping strategies and patterns
- **[SCRAPER_DEBUG_SESSION.md](docs/SCRAPER_DEBUG_SESSION.md)** - Debugging notes and solutions
- **[CLAUDE.md](docs/CLAUDE.md)** - Context for AI assistants working with this codebase
- **[doppler-setup.md](doppler-setup.md)** - Doppler CLI installation and configuration
- **[SETUP.md](SETUP.md)** - Detailed setup instructions

## Recent Updates

### November 3, 2024
- Comprehensive README overhaul with current architecture
- Added API endpoint documentation
- Added monitoring and metrics section
- Updated Docker services documentation
- Added troubleshooting guide

### November 2, 2024
- Implemented optimized search term generation with weighted strategies
- Added 30 Austin neighborhoods, expanded to 150+ street names
- Expanded name database to 200+ first names, 500+ last names
- Added 34 property types for targeted searching
- Successfully running on remote Linux environment
- Database grew to 150,000+ properties

### November 1, 2024
- Implemented dual scraping methods (API + browser-based)
- Fixed race condition in browser initialization (commit a8812a4)
- Added batch scraping capabilities
- Migrated to remote Linux environment
- Configured Docker Compose for Redis, Prometheus, BullMQ metrics
- Implemented Doppler for secrets management
- Added Express API server with REST endpoints
- Integrated Bull Dashboard for queue monitoring

### October 2024
- Initial project creation
- Implemented Playwright-based scraper
- Set up PostgreSQL with Prisma ORM
- Created React frontend application
- Established basic Docker infrastructure

---

## Contributing

This is a private project for property data analysis. For questions or issues, please contact the repository owner.

## License

Proprietary - All rights reserved.

## Contact

**Repository**: https://github.com/aledlie/tcad-scraper
**Issues**: https://github.com/aledlie/tcad-scraper/issues

---

**Built with ❤️ for property data enthusiasts**
