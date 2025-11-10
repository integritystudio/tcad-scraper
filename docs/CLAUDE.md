# CLAUDE.md

This file provides guidance to Claude Code when working with the TCAD Scraper database and codebase.

**Last Updated**: November 10, 2025


## Project Overview

TCAD Scraper is a production web scraper for extracting property tax data from Travis Central Appraisal District (TCAD). The system uses:
- **Backend**: Node.js/TypeScript with Express API
- **Database**: PostgreSQL (remote instance via Tailscale)
- **Queue**: BullMQ with Redis
- **Scraping**: Playwright with dual methods (API-based primary, browser-based fallback)
- **ORM**: Prisma

---

## Database Configuration

### ⚠️ IMPORTANT: Remote Database Only

**The application now uses a REMOTE PostgreSQL database accessible via Tailscale.**

- **Local PostgreSQL is DISABLED** (Docker container stopped)
- All database operations use the remote server
- Tailscale VPN must be connected to access the database

### Connection Details

**Primary Database URL** (via Tailscale):
```
postgresql://[user]:[password]@[tailscale-hostname]:5432/tcad_scraper
```

**Connection Requirements**:
- Tailscale VPN must be active and connected
- Remote server must be accessible via Tailscale network
- Database user must have appropriate permissions

**Environment Variable** (managed by Doppler):
```bash
DATABASE_URL="postgresql://[user]:[password]@[tailscale-hostname]:5432/tcad_scraper"
```

### Setting Up the Remote Connection

1. **Connect to Tailscale**:
   ```bash
   # Ensure Tailscale is running
   tailscale status
   ```

2. **Update DATABASE_URL in Doppler**:
   ```bash
   # Set the remote database URL
   doppler secrets set DATABASE_URL "postgresql://[user]:[password]@[tailscale-host]:5432/tcad_scraper"
   ```

3. **Verify the connection**:
   ```bash
   # Test database connectivity
   DATABASE_URL="postgresql://[user]:[password]@[tailscale-host]:5432/tcad_scraper" \
   npx prisma db execute --stdin <<< "SELECT 1 as test;"
   ```

### Accessing the Database

**Via psql (command line)**:
```bash
# Ensure Tailscale is connected first
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper -c "SELECT COUNT(*) FROM properties;"
```

**Via Prisma (in code)**:
```typescript
import { prisma } from './src/lib/prisma';
// DATABASE_URL is automatically loaded from Doppler
// Must be connected to Tailscale VPN
```

**Via Doppler-wrapped commands**:
```bash
# DATABASE_URL is pulled from Doppler automatically
doppler run -- npm run <script>
```

**Important Notes**:
- Tailscale VPN MUST be active for database access
- Connection will fail if Tailscale is disconnected
- The remote server hostname is only accessible via Tailscale network
- Local PostgreSQL Docker container is disabled

### Development Environment Configuration

**⚠️ DEVELOPMENT ONLY - Production uses API layer**

For local development, two database connection URLs are available via Doppler:

#### MAC_DB_URL
Connection string for **Mac development machines** to access the database on hobbes:
```bash
MAC_DB_URL="postgresql://postgres:postgres@hobbes:5432/tcad_scraper"
```

**Usage**: Mac developers should use this URL (or DATABASE_URL which points to hobbes) for direct database access during development.

#### HOBBES_DB_URL
Connection string for **Hobbes server** to access its local database:
```bash
HOBBES_DB_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper"
```

**Usage**: When running on the Hobbes server itself, use this URL to connect to the local PostgreSQL instance.

#### Current Configuration

The `DATABASE_URL` environment variable in Doppler dev configs currently points to:
```bash
DATABASE_URL="postgresql://postgres:postgres@hobbes:5432/tcad_scraper"
```

This allows Mac development machines to connect to the hobbes database via Tailscale.

**⚠️ CRITICAL NOTES**:
1. **These URLs are for DEVELOPMENT database access ONLY**
2. **Production and staging environments should NEVER use direct database access**
3. **All production/staging requests MUST go through the API layer**
4. Direct database access bypasses:
   - API authentication and authorization
   - Rate limiting and request validation
   - Monitoring and logging
   - Caching layers
5. Only use direct database access for:
   - Local development and testing
   - Database migrations
   - Administrative scripts
   - CLI tools and debugging

---

## Database Schema

### Tables

The database has **3 main tables**:

#### 1. `properties` Table

Stores scraped property data from TCAD.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT (UUID) | NO | Primary key |
| `property_id` | TEXT | NO | TCAD property ID (unique) |
| `name` | TEXT | NO | Owner name |
| `prop_type` | TEXT | NO | Property type (R=Residential, P=Personal, etc.) |
| `city` | TEXT | YES | City name |
| `property_address` | TEXT | NO | Full property address |
| `assessed_value` | DOUBLE PRECISION | YES | Assessed value in dollars |
| `appraised_value` | DOUBLE PRECISION | NO | Appraised value in dollars |
| `geo_id` | TEXT | YES | Geographic ID |
| `description` | TEXT | YES | Legal description |
| `search_term` | TEXT | YES | Search term that found this property |
| `scraped_at` | TIMESTAMP(3) | NO | When property was scraped |
| `created_at` | TIMESTAMP(3) | NO | When record was created |
| `updated_at` | TIMESTAMP(3) | NO | When record was last updated |

**Indexes**:
- Primary key: `id`
- Unique: `property_id` (enables deduplication via upsert)
- Performance: `city`, `prop_type`, `appraised_value`, `search_term`, `(search_term, scraped_at)`

**Prisma Model Mapping**:
```prisma
model Property {
  id              String   @id @default(uuid())
  propertyId      String   @map("property_id") @unique
  name            String
  propType        String   @map("prop_type")
  city            String?
  propertyAddress String   @map("property_address")
  assessedValue   Float?   @map("assessed_value")
  appraisedValue  Float    @map("appraised_value")
  geoId           String?  @map("geo_id")
  description     String?  @db.Text
  searchTerm      String?  @map("search_term")
  scrapedAt       DateTime @default(now()) @map("scraped_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("properties")
}
```

#### 2. `scrape_jobs` Table

Tracks all scraping job executions for monitoring and analytics.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT (UUID) | NO | Primary key |
| `search_term` | TEXT | NO | Search term used |
| `status` | TEXT | NO | Job status (pending, processing, completed, failed) |
| `result_count` | INTEGER | YES | Number of properties found |
| `error` | TEXT | YES | Error message if failed |
| `started_at` | TIMESTAMP(3) | NO | When job started |
| `completed_at` | TIMESTAMP(3) | YES | When job completed |

**Indexes**: `(status, started_at)`, `search_term`

#### 3. `monitored_searches` Table

Stores search terms to periodically re-scrape.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT (UUID) | NO | Primary key |
| `search_term` | TEXT (UNIQUE) | NO | Search term to monitor |
| `active` | BOOLEAN | NO | Whether monitoring is active |
| `frequency` | TEXT | NO | Frequency: daily, weekly, monthly |
| `last_run` | TIMESTAMP(3) | YES | Last execution time |
| `created_at` | TIMESTAMP(3) | NO | When monitoring started |
| `updated_at` | TIMESTAMP(3) | NO | Last update time |

---

## Migration History

### Initial Migration: `20251028203525_init`

**Date**: October 28, 2025

**Status**: ✅ Applied on November 6, 2025

**What it does**:
- Creates all 3 tables with correct schema
- Creates all indexes for performance
- Sets up unique constraints for deduplication

**How to verify migration status**:
```bash
cd /home/aledlie/tcad-scraper/server
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" npx prisma migrate status
```

**Note**: The migration was initially created in October but wasn't applied to the database until November 6, 2025. The old database had incorrect column names (`owner_name`, `property_type`, `legal_description`) which were fixed during this migration.

---

## Current Database State

**Database Location**: Remote server via Tailscale

**Quick Stats Query**:
```bash
# Ensure Tailscale is connected
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper -c "
  SELECT
    COUNT(*) as total,
    COUNT(DISTINCT city) as cities,
    COUNT(DISTINCT prop_type) as property_types,
    MIN(scraped_at) as first_scrape,
    MAX(scraped_at) as last_scrape
  FROM properties;
"
```

**Note**: All database statistics reflect the remote production database

---

## Common Database Operations

### Query Properties
```bash
# IMPORTANT: Ensure Tailscale is connected before running these commands

# Get total count
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper -c "SELECT COUNT(*) FROM properties;"

# Search by city
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper -c "SELECT * FROM properties WHERE city = 'AUSTIN' LIMIT 10;"

# Get properties by search term
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper -c "SELECT * FROM properties WHERE search_term = 'Smith' LIMIT 5;"
```

### Using Prisma
```typescript
import { prisma } from './src/lib/prisma';

// Count all properties
const count = await prisma.property.count();

// Find by city
const austinProps = await prisma.property.findMany({
  where: { city: 'AUSTIN' },
  take: 10
});

// Upsert (insert or update)
await prisma.property.upsert({
  where: { propertyId: '123456' },
  update: { scrapedAt: new Date() },
  create: {
    propertyId: '123456',
    name: 'John Doe',
    propType: 'R',
    propertyAddress: '123 Main St',
    appraisedValue: 500000,
  }
});
```

---

## Testing the Database

### Test Database Connection
```bash
# Ensure Tailscale is connected first
cd /Users/alyshialedlie/code/ISPublicSites/tcad-scraper/server
doppler run -- npx tsx src/scripts/test-db-save.ts
```

This script:
1. Scrapes 20 properties for "Smith"
2. Saves them to the remote database (via Tailscale)
3. Verifies data quality
4. Shows sample property

**Expected output**: "✅ Database schema verification PASSED!"

**Important**: Tailscale must be active for this test to succeed

### Verify Schema
```bash
# Ensure Tailscale is connected
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper -c "\d properties"
```

Shows table structure with all columns and indexes.

---

## Scraper Configuration

### API-Based Scraping (Primary Method)

The scraper uses TCAD's backend API for efficient scraping:

**Endpoint**: `https://prod-container.trueprodigyapi.com/public/property/searchfulltext`

**Features**:
- Can fetch up to 1000 properties per search
- Requires Bearer token (set in `TCAD_API_KEY` environment variable)
- Token expires every ~5 minutes (needs refresh)

**Authentication**:
```bash
# Set in Doppler or .env
TCAD_API_KEY="<bearer-token>"
```

**Search Term Requirements**:
- ✅ **Minimum length**: 4 characters (3 or fewer will fail)
- ✅ **BEST performing searches** (entity/business terms):
  - "Trust", "Real", "Part" (Partnership)
  - "Park", "Parc", "Family"
  - "Assoc" (Association), "Corp" (Corporation)
  - "LLC.", "Limit", "LMTD" (Limited)
  - "Inc." (Incorporated), "Manage" (Management)
  - "Home", "Group", "Company"
- ✅ **Also works**:
  - Single last names (4+ chars): "Smith", "Johnson", "Garcia"
  - Street addresses: "1234 Lamar", "456 Congress"
- ❌ **Does NOT work**:
  - City names: "Austin", "Lakeway", "Manor"
  - ZIP codes: "78701", "78704", "78759"
  - Short terms: "Lee", "Kim", "Ng" (under 4 characters)
  - Compound names: "Smith Jones", "John Smith"
  - Generic geographic terms alone
- ⚠️ **Note**: Currently returns max 20 results per search (can be increased to 1000 with pagination)

### Browser-Based Scraping (Fallback)

Uses Playwright headless browser as fallback:
- Limited to ~20 results per search
- Slower but more reliable for some search types
- Automatically used if API method fails

---

## Data Quality Standards

All properties should have:
- ✅ `name` (owner name)
- ✅ `property_address` (full address)
- ✅ `city` (city name)
- ✅ `appraised_value` (numeric, > 0)
- ✅ `prop_type` (property type code)
- ✅ `property_id` (unique TCAD ID)

**Validation before saving**:
```typescript
function validatePropertyData(prop: PropertyData): boolean {
  const required = ['propertyId', 'name', 'propertyAddress', 'appraisedValue'];
  return required.every(field => prop[field] && prop[field] !== '');
}
```

Current data quality: **100% complete** (40/40 properties have all required fields)

---

## Known Issues & Gotchas

### Issue 1: MCP Tool Read-Only Access
The `mcp__postgres__query` tool has **read-only** access. It cannot:
- Run `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER` statements
- Modify schema or data

**Solution**: Use `psql` directly with `PGPASSWORD=postgres` for write operations.

### Issue 2: Search Term Restrictions
The TCAD API has specific requirements for search terms that will return results.

**What DOESN'T work**:
1. **City names**: "Austin", "Lakeway", "Cedar Park", "Manor", etc.
2. **ZIP codes**: "78701", "78704", "78759", any 5-digit ZIP code
3. **Short terms** (< 4 characters): "Lee", "Kim", "Ng", "Fox", "Cox"
4. **Compound names**: "Smith Jones", "John Smith", "Mary Johnson"
5. **State abbreviations**: "TX", "CA"
6. **Generic location terms**: County names, region names

**What WORKS BEST** (High-yield entity terms):
1. **Trust/Estate terms**: "Trust", "Estate", "Family"
2. **Business entities**: "LLC.", "Corp", "Inc.", "Limit", "LMTD"
3. **Partnership terms**: "Part" (Partnership), "Assoc" (Association)
4. **Property terms**: "Real", "Park", "Parc", "Home", "Manage"
5. **Organization terms**: "Group", "Company", "Partners"

**Also works** (Lower yield):
1. **Single last names** (4+ characters): "Smith", "Johnson", "Williams", "Garcia"
2. **Street addresses**: "1234 Lamar", "5678 Congress", "910 Vanguard"

**Why entity terms work best**:
- Many properties are owned by trusts, LLCs, partnerships, and corporations
- Entity names contain consistent patterns (e.g., "Smith Family Trust")
- Avoids compound name issues (single word matches better)
- Higher average properties per search (~70+ for entity terms)

**Why this matters**:
- Original plan to use ZIP codes for comprehensive scraping won't work
- Cannot use city filtering to target specific areas
- Cannot use compound names or full person names
- Must rely on entity patterns and single-word search strategies
- 3-letter last names (common in Asian surnames) won't work

**Optimal scraping strategy**:
1. **Prioritize entity terms** (highest yield): Trust, LLC., Corp, Part, Family, etc.
2. Use common single last names (4+ characters only)
3. Use street address patterns
4. Avoid compound names entirely

### Issue 3: Token Expiration
TCAD_API_KEY expires every ~5 minutes.

**Solution**: Implement auto-refresh token manager (see Phase 3 in optimization plan).

### Issue 4: Multiple Database Connections
Some tools/scripts may connect to different databases if DATABASE_URL is not explicitly set.

**Solution**: Always prefix commands with:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- <command>
```

---

## Performance Optimization

### Current Throughput
- **Workers**: 2 concurrent (configurable via `QUEUE_CONCURRENCY`)
- **Current rate**: ~42,000 properties/hour (with 1000 results per search)
- **Success rate**: 80% (4/5 search terms work)

### Optimized Projections
- **Workers**: 4 concurrent
- **Optimized rate**: ~76,800 properties/hour
- **Time to 400k**: 12-16 hours (accounting for deduplication)

### Scaling Tips
1. Increase `QUEUE_CONCURRENCY` in .env or Doppler (2 → 4)
2. Monitor memory usage: each worker needs ~500MB-1GB
3. **Use high-yield search terms** (prioritized by performance):
   - **Entity terms** (BEST): Trust, LLC., Corp, Part, Family, Real, etc. (~70+ properties/search)
   - **Single last names**: Smith, Johnson, Garcia (~40-70 properties/search)
   - **Street addresses**: 1234 Lamar, 5678 Congress (~24 properties/search)
   - **Avoid**: city names, ZIP codes, short names (< 4 chars), compound names
4. Implement token auto-refresh to prevent auth failures
5. **Focus on entity term lists first** (highest ROI):
   - Trust/estate terms: Trust, Estate, Family
   - Business entities: LLC., Corp, Inc., Limit, LMTD
   - Partnership terms: Part, Assoc, Partners
   - Property terms: Real, Park, Parc, Home, Manage
6. Supplement with single-word last names (4+ characters, avoid compounds)
7. Generate street address combinations for gap filling

---

## Quick Reference Commands

### ⚠️ Prerequisites
**ALL database commands require Tailscale to be connected!**

```bash
# Check Tailscale status before running database commands
tailscale status
```

### Database Access
```bash
# Direct psql access (Tailscale required)
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper

# Run query
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper -c "SELECT COUNT(*) FROM properties;"

# Check migration status
cd /Users/alyshialedlie/code/ISPublicSites/tcad-scraper/server && npx prisma migrate status
```

### Scraping
```bash
# Test API scraper (DATABASE_URL from Doppler, Tailscale required)
cd /Users/alyshialedlie/code/ISPublicSites/tcad-scraper/server
doppler run -- npx tsx src/scripts/test-api-scraper.ts

# Test database save
doppler run -- npx tsx src/scripts/test-db-save.ts

# Run continuous batch scraper
doppler run -- npm run scrape:batch:comprehensive
```

### Monitoring
```bash
# View queue dashboard (Bull Board)
# Start server and visit: http://localhost:3001/admin/queues

# Check Redis
docker-compose ps
docker stats bullmq-redis

# Check database stats (Tailscale required)
PGPASSWORD=[password] psql -U [user] -h [tailscale-hostname] tcad_scraper -c "
  SELECT
    COUNT(*) as total_properties,
    COUNT(DISTINCT city) as cities,
    COUNT(DISTINCT search_term) as unique_searches,
    MAX(scraped_at) as last_scrape
  FROM properties;
"
```

---

## Environment Setup

### Required Environment Variables (via Doppler)

```bash
# Database (REMOTE via Tailscale)
DATABASE_URL="postgresql://[user]:[password]@[tailscale-hostname]:5432/tcad_scraper"

# Development Database URLs (DEVELOPMENT ONLY - Production uses API)
MAC_DB_URL="postgresql://postgres:postgres@hobbes:5432/tcad_scraper"      # Mac → hobbes
HOBBES_DB_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" # Hobbes → localhost

# Redis (Local)
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3001
NODE_ENV=development

# Scraper
SCRAPER_HEADLESS=true
SCRAPER_TIMEOUT=30000
TCAD_API_KEY=<bearer-token>

# Queue
QUEUE_CONCURRENCY=2
QUEUE_DASHBOARD_ENABLED=true

# Optional
DATABASE_READ_ONLY_URL=<same-as-DATABASE_URL>
```

### Working Directory
```
/Users/alyshialedlie/code/ISPublicSites/tcad-scraper/server
```

### Tailscale Requirements
- Tailscale must be running and connected for database access
- Remote database server must be accessible via Tailscale network
- Local PostgreSQL Docker container is stopped (not needed)

---

## Troubleshooting

### Database connection failures
**Most common cause**: Tailscale not connected or not running

```bash
# Check Tailscale status
tailscale status

# Restart Tailscale if needed
sudo tailscale up

# Verify remote host is reachable
ping [tailscale-hostname]
```

### "Module not found" errors
```bash
# Regenerate Prisma client
cd /Users/alyshialedlie/code/ISPublicSites/tcad-scraper/server
npx prisma generate
```

### "Migration not applied" errors
```bash
# Check status (requires Tailscale connection)
npx prisma migrate status

# Apply migrations (requires Tailscale connection)
npx prisma migrate deploy
```

### Empty query results or connection timeouts
1. **Check Tailscale is connected**: `tailscale status`
2. **Verify DATABASE_URL is correct**: Check Doppler configuration
3. **Test network connectivity**: `ping [tailscale-hostname]`
4. **Check remote server is running**: Contact infrastructure team

### Scraper authentication failures
Check TCAD_API_KEY is set:
```bash
doppler secrets get TCAD_API_KEY --plain
```

### Local PostgreSQL accidentally started
If you accidentally start the local PostgreSQL container:
```bash
# Stop it immediately
docker-compose stop postgres

# Ensure it stays stopped
docker-compose rm -f postgres
```

<<<<<<< HEAD
---

## Production Deployment

### Server Configuration (Hobbes)

**Production Server**: hobbes (accessed via SSH: `ssh aledlie@hobbes`)
**Branch**: `linux-env`
**Process Manager**: PM2
**Reverse Proxy**: nginx

### Express Trust Proxy Configuration

**⚠️ REQUIRED for production behind nginx**

The Express server must be configured to trust the reverse proxy for proper client IP detection and rate limiting:

```typescript
// server/src/index.ts
app.set('trust proxy', 1);  // Trust only the first proxy (nginx)
```

**Why this is needed**:
- nginx forwards requests with `X-Forwarded-For` headers
- Express rate limiting uses client IP for request throttling
- Without trust proxy, rate limiting fails with ValidationError
- Setting to `1` trusts only nginx (prevents IP spoofing)

### Production Deployment Workflow

1. **Make changes locally** (on `linux-env` or feature branch)
2. **Commit and push** to GitHub
3. **Pull on hobbes**:
   ```bash
   ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper && git pull origin linux-env"
   ```
4. **Install dependencies** (if package.json changed):
   ```bash
   ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper/server && npm install"
   ```
5. **Restart backend service**:
   ```bash
   ssh aledlie@hobbes "pm2 restart tcad-api"
   ```

### Verifying Production Deployment

```bash
# Check service status
ssh aledlie@hobbes "pm2 status tcad-api"

# Check logs for errors
ssh aledlie@hobbes "pm2 logs tcad-api --lines 50 --nostream --err"

# Test API endpoint
curl -s "https://api.alephatx.info/api/properties?limit=1" | jq '.data[0].name'
```

### Common Production Issues

#### Rate Limiting ValidationError

**Symptom**: Backend logs show:
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false
```

**Solution**: Ensure `app.set('trust proxy', 1)` is configured in `server/src/index.ts`

**Location**: server/src/index.ts:47

#### Backend Service Won't Start

**Check for**:
1. Missing dependencies: `cd server && npm install`
2. TypeScript compilation errors: Check PM2 error logs
3. Port conflicts: Verify port 3001 is available
4. Database connectivity: Ensure PostgreSQL is running on localhost:5432

#### Frontend Can't Reach API

**Verify**:
1. nginx configuration is correct
2. Backend service is running: `pm2 status tcad-api`
3. API URL in frontend build: Check `VITE_API_URL` in deploy.yml
4. CORS settings allow frontend origin

### Recent Production Fixes

**November 10, 2025**:
- ✅ Fixed Express trust proxy configuration for rate limiting
- ✅ Resolved 502 errors caused by missing dependencies
- ✅ Verified production API successfully serving 373K+ properties

=======
>>>>>>> 97dde79 (make identifiers font darker)
---

## Production Deployment

### Server Configuration (Hobbes)

**Production Server**: hobbes (accessed via SSH: `ssh aledlie@hobbes`)
**Branch**: `linux-env`
**Process Manager**: PM2
**Reverse Proxy**: nginx

### Express Trust Proxy Configuration

**⚠️ REQUIRED for production behind nginx**

The Express server must be configured to trust the reverse proxy for proper client IP detection and rate limiting:

```typescript
// server/src/index.ts
app.set('trust proxy', 1);  // Trust only the first proxy (nginx)
```

**Why this is needed**:
- nginx forwards requests with `X-Forwarded-For` headers
- Express rate limiting uses client IP for request throttling
- Without trust proxy, rate limiting fails with ValidationError
- Setting to `1` trusts only nginx (prevents IP spoofing)

### Production Deployment Workflow

1. **Make changes locally** (on `linux-env` or feature branch)
2. **Commit and push** to GitHub
3. **Pull on hobbes**:
   ```bash
   ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper && git pull origin linux-env"
   ```
4. **Install dependencies** (if package.json changed):
   ```bash
   ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper/server && npm install"
   ```
5. **Restart backend service**:
   ```bash
   ssh aledlie@hobbes "pm2 restart tcad-api"
   ```

### Verifying Production Deployment

```bash
# Check service status
ssh aledlie@hobbes "pm2 status tcad-api"

# Check logs for errors
ssh aledlie@hobbes "pm2 logs tcad-api --lines 50 --nostream --err"

# Test API endpoint
curl -s "https://api.alephatx.info/api/properties?limit=1" | jq '.data[0].name'
```

### Common Production Issues

#### Rate Limiting ValidationError

**Symptom**: Backend logs show:
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false
```

**Solution**: Ensure `app.set('trust proxy', 1)` is configured in `server/src/index.ts`

**Location**: server/src/index.ts:47

#### Backend Service Won't Start

**Check for**:
1. Missing dependencies: `cd server && npm install`
2. TypeScript compilation errors: Check PM2 error logs
3. Port conflicts: Verify port 3001 is available
4. Database connectivity: Ensure PostgreSQL is running on localhost:5432

#### Frontend Can't Reach API

**Verify**:
1. nginx configuration is correct
2. Backend service is running: `pm2 status tcad-api`
3. API URL in frontend build: Check `VITE_API_URL` in deploy.yml
4. CORS settings allow frontend origin

### Recent Production Fixes

**November 10, 2025**:
- ✅ Fixed Express trust proxy configuration for rate limiting
- ✅ Resolved 502 errors caused by missing dependencies
- ✅ Verified production API successfully serving 373K+ properties

---

## Next Steps for Scaling

See `/home/aledlie/tcad-scraper/docs/ARCHITECTURE_SUMMARY.md` for the comprehensive 6-phase optimization plan to reach 400,000 properties.

**Quick wins**:
1. ✅ Database migration complete
2. ✅ Schema validated
3. ✅ Search term restrictions documented (no cities, ZIPs, <4 char, or compound names)
4. ✅ Optimal search strategy identified (entity terms: Trust, LLC., Corp, etc.)
5. ⏭️ Increase worker concurrency to 3-4
6. ⏭️ Implement entity term search lists (Trust, LLC., Part, Family, Real, etc.)
7. ⏭️ Implement token auto-refresh
8. ⏭️ Run continuous batch scraper targeting entity terms for 12-16 hours

---

## Project Directory Structure

This section provides a complete file tree of the TCAD Scraper project for reference.

**Generated**: November 9, 2025

```
.
├── .claude
│   ├── agents
│   │   └── webscraper-research-agent.md
│   └── settings.local.json
├── .github
│   └── workflows
│       ├── ci.yml
│       ├── deploy.yml
│       ├── integration-tests.yml
│       ├── pr-checks.yml
│       ├── README.md
│       └── security.yml
├── analytics
├── bullmq-exporter
│   ├── Dockerfile
│   ├── index.js
│   ├── package.json
│   └── README_ENHANCED.md
├── dev
│   ├── active
│   │   ├── analytics-implementation-context.md
│   │   ├── analytics-implementation-tasks.md
│   │   ├── ci-cd-implementation-context.md
│   │   ├── ci-cd-implementation-tasks.md
│   │   ├── test-coverage-improvement-context.md
│   │   └── test-coverage-improvement-tasks.md
│   ├── architecture
│   │   ├── ANALYTICS.md
│   │   ├── API_TOKEN_VERIFICATION.md
│   │   ├── API.md
│   │   ├── CI-CD.md
│   │   ├── doppler-setup.md
│   │   ├── FRONTEND.md
│   │   ├── MONITORING_DEPLOYMENT.md
│   │   ├── MONITORING_SETUP_SUMMARY.md
│   │   └── TOKEN_AUTO_REFRESH_SUMMARY.md
│   ├── changlelog
│   │   ├── BRANCH-PROTECTION.md
│   │   ├── CHANGELOG.md
│   │   ├── CODEBASE_ANALYSIS.md
│   │   └── [additional changelog files...]
│   └── [additional dev documentation...]
├── docs
│   ├── ANALYTICS.md
│   ├── API_TOKEN_IMPLEMENTATION.md
│   ├── API_TOKEN_VERIFICATION.md
│   ├── API.md
│   ├── BRANCH-PROTECTION.md
│   ├── CHANGELOG.md
│   ├── CI-CD.md
│   ├── CLAUDE.md (this file)
│   ├── CODEBASE_ANALYSIS.md
│   └── [additional documentation files...]
├── monitoring
│   ├── grafana
│   │   ├── dashboards
│   │   │   ├── code-complexity.json
│   │   │   └── tcad-overview.json
│   │   └── provisioning
│   │       ├── dashboards
│   │       └── datasources
│   ├── prometheus
│   │   ├── prometheus.rules.yml
│   │   └── prometheus.yml
│   └── README.md
├── server
│   ├── data
│   │   ├── high-performing-terms.json
│   │   ├── search-term-map.json
│   │   ├── search-term-results.csv
│   │   ├── zero-result-analysis.json
│   │   └── zero-result-terms.json
│   ├── prisma
│   │   ├── migrations
│   │   │   ├── 20251028203525_init
│   │   │   ├── 20251107200405_add_search_term_analytics
│   │   │   └── migration_lock.toml
│   │   └── schema.prisma
│   ├── src
│   │   ├── __tests__
│   │   │   ├── api.test.ts
│   │   │   ├── auth-database.connection.test.ts
│   │   │   ├── auth-database.integration.test.ts
│   │   │   ├── controller.test.ts
│   │   │   ├── enqueue.test.ts
│   │   │   ├── integration.test.ts
│   │   │   ├── security.test.ts
│   │   │   └── setup.ts
│   │   ├── cli
│   │   │   ├── data-cleaner.ts
│   │   │   ├── db-stats.ts
│   │   │   ├── queue-analyzer.ts
│   │   │   └── queue-manager.ts
│   │   ├── config
│   │   │   ├── index.ts
│   │   │   └── swagger.ts
│   │   ├── controllers
│   │   │   └── property.controller.ts
│   │   ├── lib
│   │   │   ├── claude.service.ts
│   │   │   ├── logger.ts
│   │   │   ├── metrics.service.ts
│   │   │   ├── prisma.ts
│   │   │   ├── redis-cache.service.ts
│   │   │   ├── search-term-deduplicator.ts
│   │   │   ├── sentry.service.ts
│   │   │   └── tcad-scraper.ts
│   │   ├── middleware
│   │   │   ├── auth.ts
│   │   │   ├── error.middleware.ts
│   │   │   ├── metrics.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   └── xcontroller.middleware.ts
│   │   ├── queues
│   │   │   └── scraper.queue.ts
│   │   ├── routes
│   │   │   ├── app.routes.ts
│   │   │   └── property.routes.ts
│   │   ├── schedulers
│   │   │   └── scrape-scheduler.ts
│   │   ├── scripts
│   │   │   ├── batch-scrape.ts
│   │   │   ├── continuous-batch-scraper.ts
│   │   │   ├── worker.ts
│   │   │   └── [additional scripts...]
│   │   ├── services
│   │   │   ├── code-complexity.service.ts
│   │   │   ├── search-term-optimizer.ts
│   │   │   └── token-refresh.service.ts
│   │   ├── types
│   │   │   ├── index.ts
│   │   │   └── property.types.ts
│   │   ├── utils
│   │   │   ├── deduplication.ts
│   │   │   └── json-ld.utils.ts
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── [additional server config files...]
├── src (Frontend - React)
│   ├── components
│   │   ├── features
│   │   │   └── PropertySearch
│   │   │       ├── PropertyCard.tsx
│   │   │       ├── PropertySearchContainer.tsx
│   │   │       ├── SearchBox.tsx
│   │   │       ├── SearchResults.tsx
│   │   │       ├── ExampleQueries.tsx
│   │   │       ├── PropertyDetails
│   │   │       │   ├── PropertyDetails.tsx
│   │   │       │   ├── components
│   │   │       │   │   ├── ExpandButton.tsx
│   │   │       │   │   ├── SectionHeader.tsx
│   │   │       │   │   ├── ValueComparison.tsx
│   │   │       │   │   ├── TruncatedText.tsx
│   │   │       │   │   ├── TimestampList.tsx
│   │   │       │   │   └── FreshnessIndicator.tsx
│   │   │       │   └── sections
│   │   │       │       ├── FinancialSection.tsx
│   │   │       │       ├── IdentifiersSection.tsx
│   │   │       │       ├── DescriptionSection.tsx
│   │   │       │       └── MetadataSection.tsx
│   │   │       └── README.md
│   │   └── ui
│   │       ├── Badge
│   │       ├── Button
│   │       ├── Card
│   │       ├── Icon
│   │       └── Input
│   ├── hooks
│   │   ├── useAnalytics.ts
│   │   ├── useDebounce.ts
│   │   ├── useFormatting.ts
│   │   ├── usePagination.ts
│   │   └── usePropertySearch.ts
│   ├── lib
│   │   ├── analytics.ts
│   │   ├── api-config.ts
│   │   ├── logger.ts
│   │   └── xcontroller.client.ts
│   ├── services
│   │   └── api.service.ts
│   ├── types
│   │   └── index.ts
│   ├── utils
│   │   ├── constants.ts
│   │   ├── formatters.ts
│   │   └── helpers.ts
│   ├── App.tsx
│   └── main.tsx
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── vite.config.ts
├── ARCHITECTURE.md
├── CHANGELOG.md
├── README.md
├── COMPONENT_IMPLEMENTATION_GUIDE.md
├── VISUAL_DESIGN_PLAN.md
└── VISUAL_WIREFRAMES.md

84 directories, 393 files
```

### Key Directories

**Backend (server/)**:
- `src/` - TypeScript source code
  - `lib/` - Core services (scraper, Prisma, Claude AI, Redis cache)
  - `controllers/` - API request handlers
  - `routes/` - Express route definitions
  - `queues/` - BullMQ job queue configuration
  - `scripts/` - Utility and scraping scripts
  - `services/` - Business logic services
  - `middleware/` - Express middleware
  - `types/` - TypeScript type definitions
- `prisma/` - Database schema and migrations

**Frontend (src/)**:
- `components/features/PropertySearch/` - Main property search feature
  - `PropertyDetails/` - Expandable card details (NEW in v2.1.0)
    - `components/` - Reusable utility components
    - `sections/` - Detail section components
- `components/ui/` - Shared UI components (Badge, Button, Card, Icon, Input)
- `hooks/` - Custom React hooks
- `lib/` - Frontend utilities and services
- `services/` - API service layer

**Documentation (docs/)**:
- Technical documentation
- Architecture diagrams
- API documentation
- Testing guides
- Deployment guides

**Infrastructure**:
- `monitoring/` - Grafana dashboards and Prometheus config
- `bullmq-exporter/` - Custom metrics exporter
- `.github/workflows/` - CI/CD pipelines

---

<<<<<<< HEAD
<<<<<<< HEAD
**Document Version**: 1.4
**Last Migration**: November 6, 2025
**Database Version**: PostgreSQL (via Prisma schema 20251028203525_init)
**Database Location**: Remote server via Tailscale (LOCAL POSTGRES DISABLED)
**Configuration Updated**: November 10, 2025 - Added production deployment section and Express trust proxy configuration
=======
**Document Version**: 1.3
**Last Migration**: November 6, 2025
**Database Version**: PostgreSQL (via Prisma schema 20251028203525_init)
**Database Location**: Remote server via Tailscale (LOCAL POSTGRES DISABLED)
**Configuration Updated**: November 9, 2025 - Added development database URLs (MAC_DB_URL, HOBBES_DB_URL)
>>>>>>> 97dde79 (make identifiers font darker)
=======
**Document Version**: 1.4
**Last Migration**: November 6, 2025
**Database Version**: PostgreSQL (via Prisma schema 20251028203525_init)
**Database Location**: Remote server via Tailscale (LOCAL POSTGRES DISABLED)
**Configuration Updated**: November 10, 2025 - Added production deployment section and Express trust proxy configuration
>>>>>>> 8173965 (docs: add production deployment section to CLAUDE.md)
**File Tree Last Updated**: November 9, 2025

---

## ⚠️ CRITICAL REMINDERS

1. **Tailscale MUST be connected** for all database operations
2. **Local PostgreSQL is DISABLED** - Docker container stopped
3. **DATABASE_URL points to remote server** via Tailscale network
4. If you see connection errors, **check Tailscale first**: `tailscale status`
