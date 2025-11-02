# TCAD Scraper

A production web scraping system for automated collection of property tax information from the Travis Central Appraisal District (TCAD) website. Built with TypeScript, Express, Playwright, and PostgreSQL with a distributed queue-based architecture for scalable data collection.

## Overview

TCAD Scraper is a production application that automates the collection and storage of property tax data from travis.prodigycad.com. The system uses continuous batch scraping with intelligent search term generation to discover and catalog properties across Travis County. Currently managing **17,352 properties** across **35 cities** with a **98.1% job success rate**.

## Key Features

- **Continuous Batch Scraping**: Automated 24/7 scraping with intelligent, weighted search term generation
- **Background Job Processing**: BullMQ queue system with Redis managing 500+ concurrent jobs
- **Persistent Storage**: PostgreSQL database with Prisma ORM for type-safe data access
- **Optimized Search Strategies**:
  - Weighted pattern distribution (street addresses, full names, businesses, neighborhoods)
  - 72 street names, 34 property types, 30 Austin neighborhoods
  - Compound names (trusts, estates, partnerships)
  - Duplicate detection and deduplication
- **Comprehensive Data Extraction**:
  - Owner name and property type
  - City and full property address
  - Assessed and appraised values
  - Property ID (PID) and Geographic ID
  - Legal descriptions
- **Production Infrastructure**:
  - Playwright-based headless browser automation
  - Docker Compose orchestration for PostgreSQL and Redis
  - Remote Linux environment (Ubuntu)
  - Doppler secrets management
- **Known Limitations**: TCAD website pagination is hidden, limiting results to 20 properties per search (compensated by diverse search term generation)

## Technology Stack

### Core Application
- **Node.js** with **TypeScript** for type safety
- **Playwright 1.41+** for headless browser automation (production environment)
- **Prisma ORM** for type-safe database access
- **BullMQ** for distributed job queue management
- **Winston** for structured logging

### Infrastructure
- **PostgreSQL 15** (Docker container `tcad-postgres`)
  - Database: `tcad_scraper`
  - Current dataset: 17,352 properties
- **Redis 7** (Docker container `bullmq-redis`)
  - Job queue and state management
  - Port: 6379
- **Docker Compose** for service orchestration
- **Doppler** for environment variable and secrets management

### Deployment Environment
- **Ubuntu Linux** (remote server)
- **Systemd** process management (planned)
- **Tailscale** for secure remote access

## Project Structure

```
tcad-scraper/
├── server/                       # Main application directory
│   ├── src/
│   │   ├── lib/
│   │   │   ├── tcad-scraper.ts   # Core Playwright scraper with pagination handling
│   │   │   └── prisma.ts         # Prisma database client
│   │   ├── queues/
│   │   │   └── scraper.queue.ts  # BullMQ job queue configuration
│   │   ├── scripts/
│   │   │   ├── continuous-batch-scraper.ts  # Main production scraper (currently running)
│   │   │   ├── test-optimized-search.ts     # Search pattern validation
│   │   │   ├── test-pagination.ts           # Pagination testing
│   │   │   └── diagnose-pagination.ts       # AG Grid investigation
│   │   └── types/                # TypeScript type definitions
│   ├── prisma/
│   │   └── schema.prisma         # Database schema (Property, ScrapeJob, MonitoredSearch)
│   ├── continuous-scraper.log    # Live scraper output log
│   ├── continuous-scraper.pid    # Process ID file
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml            # PostgreSQL and Redis orchestration
└── README.md                     # This file
```

**Active Scripts:**
- `continuous-batch-scraper.ts` - Running 24/7 with optimized search term generation
- `tcad-scraper.ts` - Core scraper library with AG Grid data extraction

**Database Tables:**
- `properties` - 17,352 property records with deduplication by propertyId
- `scrape_jobs` - 13,380 job records tracking all scraping operations
- `monitored_searches` - Scheduled recurring search terms (not currently used)

## Database Schema

The application uses PostgreSQL with three main models:

### Property
- **propertyId**: Unique TCAD identifier
- **name**: Owner name
- **propType**: Property type
- **city**: City location
- **propertyAddress**: Full address
- **assessedValue**: Tax assessed value
- **appraisedValue**: Appraised value
- **geoId**: Geographic identifier
- **description**: Legal description
- **searchTerm**: Search query that found this property
- **scrapedAt**: Timestamp of data collection

### ScrapeJob
Tracks scraping operations with status, results count, and error information.

### MonitoredSearch
Enables automated recurring scrapes with configurable frequency (daily/weekly/monthly).

## Getting Started

### Prerequisites

- **Node.js 18+** and npm
- **Docker and Docker Compose**
- **Doppler CLI** (for secrets management)
- **Playwright** with Chromium browser
- **Ubuntu/Linux environment** (for production deployment)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd tcad-scraper/server
```

2. **Install dependencies:**
```bash
npm install
npx playwright install chromium
npx playwright install-deps chromium  # Install system dependencies
```

3. **Set up Doppler (production):**
```bash
doppler login
doppler setup  # Select project and config
```

4. **Start infrastructure services:**
```bash
cd /path/to/tcad-scraper
docker-compose up -d  # Starts PostgreSQL and Redis
```

5. **Initialize database:**
```bash
cd server
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" npx prisma db push
```

### Running the Scraper

**Production continuous scraper (recommended):**
```bash
cd server
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts > continuous-scraper.log 2>&1 &
```

**Monitor scraper logs:**
```bash
tail -f continuous-scraper.log
```

**Check scraper status:**
```bash
ps aux | grep continuous-batch-scraper
```

**Stop the scraper:**
```bash
pkill -f "continuous-batch-scraper"
```

### Database Operations

**Query the database:**
```bash
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT COUNT(*) FROM properties;"
```

**View database statistics:**
```bash
npm run db:stats
```

**Check queue status:**
```bash
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:wait"
```

## Docker Services

The application uses Docker Compose for infrastructure:

**Active Services:**
- **PostgreSQL** (container: `tcad-postgres`, port: 5432)
  - Database: `tcad_scraper`
  - User: `postgres`
  - Data volume: `postgres_data`

- **Redis** (container: `bullmq-redis`, port: 6379)
  - BullMQ job queue
  - Job state management
  - Data volume: `redis_data`

**Service Management:**
```bash
# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker logs tcad-postgres
docker logs bullmq-redis

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

## Current System Status

**Database Statistics:**
- Total Properties: 17,352
- Unique Cities: 35
- Property Types: 3
- Job Success Rate: 98.1%

**Job Queue Statistics:**
- Completed Jobs: 13,115
- Failed Jobs: 261
- Waiting Jobs: ~500-600
- Processing Jobs: 2-4 (concurrent workers)

**Search Strategy Distribution:**
- Full Names: 20%
- Street Addresses: 18%
- Last Names: 15%
- Business Names: 12%
- Street Numbers: 12%
- Compound Names: 10%
- Other patterns: 13%

## Architecture

### System Workflow

1. **Continuous Batch Scraper** (`continuous-batch-scraper.ts`)
   - Generates diverse search terms using weighted strategies
   - Queues batches of 50 search jobs to BullMQ
   - Maintains queue size between 100-500 pending jobs
   - Runs continuously 24/7 in background

2. **BullMQ Job Queue** (Redis-backed)
   - Receives search term jobs from batch scraper
   - Manages 2-4 concurrent worker processes
   - Handles retries with exponential backoff
   - Tracks job state (waiting, active, completed, failed)

3. **Scraper Workers** (`tcad-scraper.ts` via queue)
   - Launch Playwright headless browsers
   - Navigate to travis.prodigycad.com
   - Search for properties using generated terms
   - Extract data from AG Grid results (limited to 20 per search)
   - Handle "no results" gracefully with screenshot logging

4. **Data Extraction**
   - Parse AG Grid DOM elements for property data
   - Extract: propertyId, name, address, city, propType, assessedValue, appraisedValue
   - Attempt pagination (currently blocked by hidden controls)
   - Store results in PostgreSQL with duplicate prevention

5. **Database Layer** (Prisma ORM)
   - Upsert properties by unique propertyId
   - Log all scrape jobs with status and timing
   - Track search terms and result counts

### Key Design Decisions

- **No API Server**: Direct scraper-to-database architecture for simplicity
- **Weighted Search**: Prioritizes high-yield patterns (addresses, names)
- **Duplicate Handling**: Database-level uniqueness on propertyId
- **Error Recovery**: Screenshots + logging for "no results" debugging
- **Queue Management**: Auto-fill queue to maintain constant scraping
- **Rate Limiting**: 20 results per search (TCAD limitation), compensated by search diversity

## Troubleshooting

### Scraper Issues

**Check if scraper is running:**
```bash
ps aux | grep continuous-batch-scraper
```

**View recent logs:**
```bash
tail -100 continuous-scraper.log
```

**Check for browser errors:**
```bash
grep -i "error\|failed" continuous-scraper.log | tail -20
```

**Restart scraper:**
```bash
pkill -f "continuous-batch-scraper"
cd server
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts > continuous-scraper.log 2>&1 &
```

### Database Issues

**Check PostgreSQL container:**
```bash
docker ps | grep tcad-postgres
docker logs tcad-postgres
```

**Test database connection:**
```bash
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT 1;"
```

**View recent scrape jobs:**
```bash
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT search_term, status, result_count, started_at FROM scrape_jobs ORDER BY started_at DESC LIMIT 20;"
```

### Queue Issues

**Check Redis container:**
```bash
docker ps | grep bullmq-redis
redis-cli ping  # Should return PONG
```

**View queue status:**
```bash
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:wait"
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:active"
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:completed"
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:failed"
```

**Clear stuck jobs:**
```bash
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "UPDATE scrape_jobs SET status = 'failed' WHERE status = 'processing' AND started_at < NOW() - INTERVAL '1 hour';"
```

## Known Issues and Limitations

1. **Pagination Limitation**: TCAD's AG Grid pagination controls are hidden (CSS class `ag-hidden`), limiting each search to 20 results maximum. This is mitigated by using diverse search term generation.

2. **Search Result Cap**: No way to programmatically change page size or navigate pagination. Attempted solutions:
   - AG Grid API access (gridOptions not exposed)
   - Page size input manipulation (pagination panel hidden)
   - Pagination button clicking (buttons not accessible)

3. **No Results Handling**: Many random search terms return 0 results (expected behavior). Screenshots are saved for debugging.

## Recent Updates

**November 2, 2025:**
- Implemented optimized search term generation with weighted strategies
- Added 30 Austin neighborhoods, expanded street names (72), property types (34)
- Added 5 new search strategies: neighborhoods, compound names, street numbers, property descriptors, partial addresses
- Successfully running on remote Linux environment
- Database grew to 17,352 properties with 98.1% job success rate

**November 1, 2025:**
- Fixed race condition in browser initialization (commit a8812a4)
- Added batch scraping capabilities
- Migrated to remote Linux environment
- Configured Docker Compose for PostgreSQL and Redis
- Implemented Doppler for secrets management

## Development Notes

- Target: 400,000 properties (Travis County estimate)
- Current coverage: 17,352 properties (4.3% of target)
- Average scraping rate: ~1 property per search term
- Estimated time to complete: Depends on search term diversity and TCAD result overlap
