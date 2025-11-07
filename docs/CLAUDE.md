# CLAUDE.md

This file provides guidance to Claude Code when working with the TCAD Scraper database and codebase.

**Last Updated**: November 5, 2025

---

## Project Overview

TCAD Scraper is a production web scraper for extracting property tax data from Travis Central Appraisal District (TCAD). The system uses:
- **Backend**: Node.js/TypeScript with Express API
- **Database**: PostgreSQL (local instance)
- **Queue**: BullMQ with Redis
- **Scraping**: Playwright with dual methods (API-based primary, browser-based fallback)
- **ORM**: Prisma

---

## Database Configuration

### Connection Details

**Primary Database URL**:
```
postgresql://postgres:postgres@localhost:5432/tcad_scraper
```

**Credentials**:
- Username: `postgres`
- Password: `postgres`
- Host: `localhost`
- Port: `5432`
- Database: `tcad_scraper`

**Environment Variable** (managed by Doppler):
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper"
```

### Accessing the Database

**Via psql (command line)**:
```bash
PGPASSWORD=postgres psql -U postgres -h localhost tcad_scraper -c "SELECT COUNT(*) FROM properties;"
```

**Via Prisma (in code)**:
```typescript
import { prisma } from './src/lib/prisma';
// DATABASE_URL is automatically loaded from Doppler
```

**Via Doppler-wrapped commands**:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npm run <script>
```

**Important**: The MCP postgres tool connection may use different credentials. Always use `PGPASSWORD=postgres` for direct psql access.

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

**As of November 6, 2025**:

- **Total Properties**: 40
- **Data Quality**: 100% complete (all fields populated)
- **Property Types**:
  - 39 Residential (R) - avg value: $3.35M
  - 1 Personal (P) - avg value: $56k
- **Sample Cities**: Austin, Lakeway
- **Last Scraped**: November 6, 2025

**Quick Stats Query**:
```bash
PGPASSWORD=postgres psql -U postgres -h localhost tcad_scraper -c "
  SELECT
    COUNT(*) as total,
    COUNT(DISTINCT city) as cities,
    COUNT(DISTINCT prop_type) as property_types,
    MIN(scraped_at) as first_scrape,
    MAX(scraped_at) as last_scrape
  FROM properties;
"
```

---

## Common Database Operations

### Query Properties
```bash
# Get total count
PGPASSWORD=postgres psql -U postgres -h localhost tcad_scraper -c "SELECT COUNT(*) FROM properties;"

# Search by city
PGPASSWORD=postgres psql -U postgres -h localhost tcad_scraper -c "SELECT * FROM properties WHERE city = 'AUSTIN' LIMIT 10;"

# Get properties by search term
PGPASSWORD=postgres psql -U postgres -h localhost tcad_scraper -c "SELECT * FROM properties WHERE search_term = 'Smith' LIMIT 5;"
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
cd /home/aledlie/tcad-scraper/server
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx src/scripts/test-db-save.ts
```

This script:
1. Scrapes 20 properties for "Smith"
2. Saves them to the database
3. Verifies data quality
4. Shows sample property

**Expected output**: "✅ Database schema verification PASSED!"

### Verify Schema
```bash
PGPASSWORD=postgres psql -U postgres -h localhost tcad_scraper -c "\d properties"
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

### Database Access
```bash
# Direct psql access
PGPASSWORD=postgres psql -U postgres -h localhost tcad_scraper

# Run query
PGPASSWORD=postgres psql -U postgres -h localhost tcad_scraper -c "SELECT COUNT(*) FROM properties;"

# Check migration status
cd /home/aledlie/tcad-scraper/server && npx prisma migrate status
```

### Scraping
```bash
# Test API scraper
cd /home/aledlie/tcad-scraper/server
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx src/scripts/test-api-scraper.ts

# Test database save
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx src/scripts/test-db-save.ts

# Run continuous batch scraper
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npm run scrape:batch:comprehensive
```

### Monitoring
```bash
# View queue dashboard (Bull Board)
# Start server and visit: http://localhost:5050/admin/queues

# Check Redis
docker-compose ps
docker stats bullmq-redis

# Check database stats
PGPASSWORD=postgres psql -U postgres -h localhost tcad_scraper -c "
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
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper"

# Redis
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
/home/aledlie/tcad-scraper/server
```

---

## Troubleshooting

### "Module not found" errors
```bash
# Regenerate Prisma client
cd /home/aledlie/tcad-scraper/server
npx prisma generate
```

### "Migration not applied" errors
```bash
# Check status
npx prisma migrate status

# Apply migrations
npx prisma migrate deploy
```

### Empty query results from MCP tool
The MCP tool may use different credentials. Use direct psql instead:
```bash
PGPASSWORD=postgres psql -U postgres -h localhost tcad_scraper -c "<query>"
```

### Scraper authentication failures
Check TCAD_API_KEY is set:
```bash
doppler secrets get TCAD_API_KEY --plain
```

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

**Document Version**: 1.0
**Last Migration**: November 6, 2025
**Database Version**: PostgreSQL (via Prisma schema 20251028203525_init)
**Current Properties**: 40 (100% complete data quality)
