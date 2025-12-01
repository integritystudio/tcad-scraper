# TCAD Scraper

Production web scraper for Travis Central Appraisal District property data. Uses Playwright for browser automation, BullMQ for job queue management, and PostgreSQL for data storage.

## Current Status

- **Properties Collected**: 282,125+
- **Peak Processing Rate**: 3,346 properties/minute
- **Average Rate**: 700-1,000 properties/minute (when token is valid)
- **Cities Covered**: Multiple cities across Travis County
- **Queue Status**: 100+ jobs in queue
- **Scraper**: Running 24/7 with optimized search term generation

## Important Database Notes

### Correct Database Connection
The production database is on **port 5432** (not 5433):
```bash
postgresql://postgres:postgres@localhost:5432/tcad_scraper
```

### MCP Postgres Tool Issue
The MCP postgres tool connects to port 5433 by default, which shows 0 rows. Always use direct psql commands for accurate data:
```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d tcad_scraper -c "SELECT COUNT(*) FROM properties;"
```

### Token Expiration
The TCAD API token expires every 5 minutes. The scraper needs the token refreshed regularly:
```bash
/home/aledlie/tcad-scraper/scripts/refresh-tcad-token.sh
```
When the token expires, jobs fail with HTTP 401 errors and the processing rate drops to near 0.

## Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL 15+** (via Docker)
- **Redis 7+** (via Docker)
- **Chromium browser** (installed by Playwright)
- **Doppler CLI** (for secrets management)

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install

# Install Playwright browsers and system dependencies
npx playwright install chromium
npx playwright install-deps chromium
```

### 2. Start Infrastructure

```bash
# From project root
cd /home/aledlie/tcad-scraper
docker-compose up -d

# Verify services are running
docker ps
# Should see: tcad-postgres and bullmq-redis
```

### 3. Initialize Database

```bash
cd server

# Push schema to database (creates tables)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" npx prisma db push

# Verify database
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "\dt"
```

### 4. Configure Doppler (Production)

```bash
doppler login
doppler setup
# Select: tcad-scraper project, dev config
```

### 5. Run the Continuous Scraper

```bash
cd server

# Production mode (with Doppler)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts > continuous-scraper.log 2>&1 &

# Save PID for later
echo $! > continuous-scraper.pid
```

### 6. Monitor the Scraper

```bash
# View live logs
tail -f continuous-scraper.log

# Check if running
ps aux | grep continuous-batch-scraper

# Check queue status
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:wait"

# Check database growth
watch -n 60 'docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT COUNT(*) FROM properties;"'
```

## Database Operations

### View Data in Prisma Studio
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" npx prisma studio
# Opens at http://localhost:5555
```

### Query Database Directly
```bash
# Count properties
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT COUNT(*) FROM properties;"

# View recent scrape jobs
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT search_term, status, result_count, started_at FROM scrape_jobs ORDER BY started_at DESC LIMIT 20;"

# Get job statistics
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT status, COUNT(*) FROM scrape_jobs GROUP BY status;"

# View property type distribution
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT prop_type, COUNT(*) FROM properties GROUP BY prop_type ORDER BY COUNT(*) DESC;"

# View cities
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT city, COUNT(*) FROM properties WHERE city IS NOT NULL GROUP BY city ORDER BY COUNT(*) DESC;"
```

### Queue Management
```bash
# Check queue sizes
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:wait"
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:active"
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:completed"
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:failed"

# Clear all waiting jobs (use with caution)
docker exec bullmq-redis redis-cli DEL "bull:scraper-queue:wait"

# View all Redis keys
docker exec bullmq-redis redis-cli KEYS "*"
```

### Clean Up Operations
```bash
# Remove failed jobs with specific patterns (e.g., ZIP codes)
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "DELETE FROM scrape_jobs WHERE status = 'failed' AND search_term ~ '^\d{5}$';"

# Update stuck processing jobs to failed
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "UPDATE scrape_jobs SET status = 'failed', error = 'Timeout - stuck in processing' WHERE status = 'processing' AND started_at < NOW() - INTERVAL '1 hour';"

# View duplicate properties (should be none due to unique constraint)
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT property_id, COUNT(*) FROM properties GROUP BY property_id HAVING COUNT(*) > 1;"
```

## Troubleshooting

### Scraper Not Running
```bash
# Check if process exists
ps aux | grep continuous-batch-scraper

# Check recent logs for errors
tail -50 continuous-scraper.log | grep -i error

# Restart scraper
pkill -f "continuous-batch-scraper"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts > continuous-scraper.log 2>&1 &
```

### Redis Connection Issues
```bash
# Check if Redis container is running
docker ps | grep bullmq-redis

# Test Redis connection
docker exec bullmq-redis redis-cli ping
# Should return: PONG

# Restart Redis
docker restart bullmq-redis
```

### PostgreSQL Connection Issues
```bash
# Check if PostgreSQL container is running
docker ps | grep tcad-postgres

# Test database connection
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT 1;"

# View PostgreSQL logs
docker logs tcad-postgres

# Restart PostgreSQL
docker restart tcad-postgres
```

### Playwright/Browser Issues
```bash
# Reinstall Chromium browser
npx playwright install chromium
npx playwright install-deps chromium

# Check for missing system dependencies (Linux)
ldd $(which chromium) | grep "not found"

# Test browser launch
npx playwright open https://travis.prodigycad.com/property-search
```

### Queue Not Processing
```bash
# Check queue sizes
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:wait"
docker exec bullmq-redis redis-cli LLEN "bull:scraper-queue:active"

# Check for stuck jobs
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT COUNT(*) FROM scrape_jobs WHERE status = 'processing' AND started_at < NOW() - INTERVAL '1 hour';"

# Clear stuck jobs
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "UPDATE scrape_jobs SET status = 'failed' WHERE status = 'processing' AND started_at < NOW() - INTERVAL '1 hour';"
```

### High Failure Rate
```bash
# Check recent failures
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT search_term, error, started_at FROM scrape_jobs WHERE status = 'failed' ORDER BY started_at DESC LIMIT 10;"

# Common errors and solutions:
# - "browser is not defined" -> Fixed in commit a8812a4
# - "Timeout waiting for text input" -> Fixed in commit a8812a4
# - "Element is not visible" (pagination) -> Known limitation, not a bug
```

## Architecture

```
┌──────────────────────────────────┐
│  Continuous Batch Scraper        │
│  - Generates search terms        │
│  - Queues jobs to BullMQ         │
│  - Maintains 100-500 queue size  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  BullMQ Queue (Redis)            │
│  - Job state management          │
│  - Retry logic                   │
│  - 2-4 concurrent workers        │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Scraper Workers (Playwright)    │
│  - Launch headless browsers      │
│  - Navigate to TCAD website      │
│  - Extract AG Grid data          │
│  - Save to PostgreSQL            │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  PostgreSQL Database             │
│  - properties (17,352 records)   │
│  - scrape_jobs (13,380 records)  │
│  - Unique constraint on PID      │
└──────────────────────────────────┘
```

## Search Term Strategy

The scraper uses weighted random search to maximize property discovery:

- **20%** Full Names (e.g., "John Smith")
- **18%** Street Addresses (e.g., "1234 Main")
- **15%** Last Names (e.g., "Johnson")
- **12%** Business Names (e.g., "Smith LLC")
- **12%** Street Numbers (e.g., "4567")
- **10%** Compound Names (e.g., "Brown Trust", "Smith & Johnson")
- **7%** Neighborhoods (e.g., "Hyde Park", "Zilker")
- **6%** Other patterns (property types, letter combos, etc.)

## Known Limitations

1. **20 Results Per Search**: TCAD's AG Grid pagination is hidden and inaccessible
2. **No API Access**: Direct scraping only, no official API available
3. **Rate Limiting**: Compensated by diverse search term generation
4. **Search Misses**: ~40-50% of searches return 0 results (expected with random terms)

## Project Goals

- **Target**: 400,000 properties (estimated total for Travis County)
- **Current Progress**: 17,352 properties (4.3%)
- **Strategy**: Exhaustive search term generation with intelligent pattern weighting
- **Completion**: Ongoing (depends on term diversity and result overlap)