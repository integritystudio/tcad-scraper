# TCAD Scraper

Production web scraper for Travis Central Appraisal District property data. Uses Playwright for browser automation, BullMQ for job queue management, and PostgreSQL for data storage.

## Current Status

- **Properties Collected**: 401,600+
- **Peak Processing Rate**: 3,346 properties/minute
- **Average Rate**: 700-1,000 properties/minute (when token is valid)
- **Cities Covered**: Multiple cities across Travis County
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
The TCAD API token expires every 5 minutes. The `token-refresh.service.ts` auto-refreshes tokens via Cloudflare Worker. When the token expires, jobs fail with HTTP 401 errors and the processing rate drops to near 0.

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
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml up -d

# Verify services are running
docker ps
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
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx scripts/continuous-batch-scraper.ts > continuous-scraper.log 2>&1 &

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

### Requeue Scripts

Recovery scripts for failed jobs live in `scripts/requeue/`:

| Script | When to Use |
|--------|-------------|
| `requeue-all-failed-with-error-tracking.ts` | General recovery: categorizes all failed jobs by error type, saves a JSON error report, refreshes token, re-enqueues all. Stays running for auto-refresh. |
| `requeue-analytics-failed-jobs.ts` | Targeted: re-enqueues only jobs that failed due to missing `search_term_analytics` table. One-shot (exits after enqueue). |
| `requeue-with-fresh-tokens.ts` | Token expiry recovery: collects failed 401s + pending jobs, clears queue, refreshes token, re-enqueues all. Stays running for auto-refresh. |

```bash
cd server

# General requeue (analyzes errors, saves report, re-enqueues all failed)
doppler run -- npx tsx scripts/requeue/requeue-all-failed-with-error-tracking.ts

# Requeue only analytics-related failures
doppler run -- npx tsx scripts/requeue/requeue-analytics-failed-jobs.ts

# Requeue after token expiry (clears queue, refreshes, re-enqueues)
doppler run -- npx tsx scripts/requeue/requeue-with-fresh-tokens.ts
```

### Scraper Not Running
```bash
# Check if process exists
ps aux | grep continuous-batch-scraper

# Check recent logs for errors
tail -50 continuous-scraper.log | grep -i error

# Restart scraper
pkill -f "continuous-batch-scraper"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx scripts/continuous-batch-scraper.ts > continuous-scraper.log 2>&1 &
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

## Debugging Scripts

Ad-hoc debugging and manual testing scripts live in `scripts/utils/test-scripts/`:

| Script | Purpose |
|--------|---------|
| `test-api-direct.ts` | Test TCAD API calls directly |
| `test-api-scraper.ts` | Test scraper against TCAD API |
| `test-api-token-config.ts` | Verify token configuration (`npm run test:token-config`) |
| `test-enqueue.ts` | Manually enqueue test jobs |
| `test-queue-job-flow.ts` | Trace a job through the queue lifecycle (`npm run test:queue-flow`) |
| `test-single-job.ts` | Run a single scrape job end-to-end |
| `test-token-refresh.ts` | Verify token refresh cycle (`npm run test:token-refresh`) |
| `batch-scrape.ts` | Legacy batch scraper with configurable strategy (cities/zips/types) |
| `batch-scrape-100.ts` | Legacy one-shot batch with 100 hardcoded search terms |
| `batch-scrape-comprehensive.ts` | Legacy comprehensive scraper with toggleable categories |

```bash
cd server
doppler run -- npx tsx scripts/utils/test-scripts/test-api-direct.ts
```

One-off campaign and batch enqueue scripts live in `scripts/one-off-and-test-batches/`:

| Script | Purpose |
|--------|---------|
| `enqueue-40k-sprint.ts` | Bulk enqueue targeting 40K property milestone |
| `enqueue-high-value-batch.ts` | Enqueue high-value entity terms (Trust, LLC, etc.) |
| `enqueue-optimized-100.ts` | Enqueue 100 optimized terms with deduplication |

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
│  PostgreSQL Database (Render)     │
│  - properties (401,600+ records) │
│  - scrape_jobs                   │
│  - Unique constraint on PID+year │
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

1. **20 Results Per Search** (browser method): TCAD's AG Grid pagination is hidden and inaccessible
2. **API JSON Parse Failures**: ~17% of jobs may fail with truncated/empty TCAD API responses (see BACKLOG.md)
3. **Rate Limiting**: Compensated by diverse search term generation
4. **Search Misses**: ~40-50% of searches return 0 results (expected with random terms)

## Project Goals

- **Target**: 420,000 properties (estimated total for Travis County)
- **Current Progress**: 401,600+ properties (~96%)
- **Strategy**: Exhaustive search term generation with intelligent pattern weighting
- **Completion**: Approaching saturation; diminishing returns on new term discovery