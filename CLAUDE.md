# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Last Updated**: November 26, 2025

## Project Overview

TCAD Scraper is a production web scraper extracting property tax data from Travis Central Appraisal District (TCAD). The system consists of:
- **Backend**: Express API (TypeScript) with BullMQ job queues and Playwright scraping
- **Frontend**: React 19 + Vite application for searching and viewing property data
- **Database**: PostgreSQL (remote via Tailscale) with Prisma ORM
- **Queue**: BullMQ with Redis for distributed job processing
- **Scraping**: Dual-method approach (API-based primary, browser-based fallback)

**Current Scale**: 373K+ properties scraped, targeting 400K+

---

## Architecture

### High-Level Flow

```
React Frontend (5174) → Express API (3000) → PostgreSQL (Tailscale)
                            ↓
                        BullMQ Queue (Redis 6379)
                            ↓
                        Scraper Workers (Playwright/API)
                            ↓
                        TCAD Website/API
```

### Key Components

**Backend (`server/`)**:
- `src/index.ts` - Express server with Sentry, security middleware, Bull Board dashboard
- `src/lib/tcad-scraper.ts` - Dual scraping engine (API method + Playwright fallback)
- `src/queues/scraper.queue.ts` - BullMQ job queue configuration
- `src/scripts/continuous-batch-scraper.ts` - 24/7 automated scraping with intelligent search term generation
- `src/services/token-refresh.service.ts` - Auto-refresh TCAD API tokens every ~5 minutes
- `src/middleware/auth.ts` - Optional JWT/API key authentication
- `prisma/schema.prisma` - Database schema (properties, scrape_jobs, monitored_searches)

**Frontend (`src/`)**:
- `App.tsx` - React root component
- `components/features/PropertySearch/` - Property search UI with expandable cards
- `hooks/usePropertySearch.ts` - Search logic and API integration
- `services/api.service.ts` - API client layer

**Infrastructure**:
- `docker-compose.base.yml` + `docker-compose.dev.yml` - Multi-stage Docker setup
- `.env` - **Single source of truth** for all port configurations
- `monitoring/` - Prometheus/Grafana dashboards for queue metrics

### Critical Dependencies

**Database Access Requires**:
- Tailscale VPN running and connected (`tailscale status`)
- DATABASE_URL pointing to remote server via Tailscale hostname
- Local PostgreSQL container is DISABLED

**Scraping Engine Uses**:
- **Primary**: Direct API calls to `https://prod-container.trueprodigyapi.com/public/property/searchfulltext`
- **Fallback**: Playwright headless browser scraping AG Grid UI (limited to 20 results)
- **Token**: Bearer token in `TCAD_API_KEY` (expires ~5 minutes, auto-refreshed by token-refresh.service)

---

## Secrets Management - Doppler

**⚠️ CRITICAL**: This project uses Doppler for all environment variables and secrets.

**Configuration**:
- **Project**: `integrity-studio`
- **Environment**: `dev` (local development) or `prod` (production)
- **Config**: `dev`

**Setup**:
```bash
# Install (macOS)
brew install dopplerhq/cli/doppler

# Login
doppler login

# Configure root directory
cd /path/to/tcad-scraper
doppler setup --project integrity-studio --config dev

# Configure server directory
cd server
doppler setup --project integrity-studio --config dev
```

**Usage**:
```bash
# Run commands with Doppler
doppler run -- npm run dev
doppler run -- npm run scrape:batch:comprehensive

# Docker Compose with Doppler
doppler run -- docker-compose -f docker-compose.base.yml -f docker-compose.dev.yml up -d

# Verify configuration
doppler configure get project
doppler secrets  # List available secrets (no values shown)
```

**Port Configuration**:
All ports are defined in `.env` as the single source of truth. Docker Compose files reference these variables.

---

## Common Commands

### Development Setup

```bash
# Frontend (root directory)
npm install
doppler run -- npm run dev  # Starts Vite dev server on port 5174

# Backend (server directory)
cd server
npm install
doppler run -- npm run dev  # Starts Express API on port 3000
```

### Docker Services

```bash
# Start all services with Doppler
doppler run -- docker-compose -f docker-compose.base.yml -f docker-compose.dev.yml up -d

# Check service status
docker ps --filter "name=tcad"

# View logs
docker logs tcad-backend-dev -f
docker logs tcad-redis

# Stop services
docker-compose -f docker-compose.base.yml -f docker-compose.dev.yml down
```

### Database Operations

**Prerequisites**: Tailscale must be running (`tailscale status`)

```bash
# Generate Prisma client (after schema changes)
cd server
npx prisma generate

# Run migrations
doppler run -- npx prisma migrate dev

# Open Prisma Studio
doppler run -- npx prisma studio

# Database stats
npm run stats:all
```

### Scraping

```bash
# Test API scraper
cd server
doppler run -- npx tsx src/scripts/test-api-scraper.ts

# Run continuous batch scraper (production)
doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts

# Queue management
npm run queue:status
npm run queue:pause
npm run queue:resume
npm run queue:cleanup

# Analyze scraping performance
npm run analyze:overview
npm run analyze:performance
```

### Testing

```bash
# Frontend tests
npm run test
npm run test:coverage

# Backend tests
cd server
npm run test:unit
npm run test:integration
npm run test:all:coverage

# Linting
npm run lint

# Security tests
npm run test:security

# Test database connection (requires Tailscale)
doppler run -- npx tsx src/scripts/test-db-save.ts
```

### Build & Deploy

```bash
# Build frontend for production
npm run build

# Build backend
cd server
npm run build

# Preview production build
npm run preview
```

---

## Key Architectural Decisions

### Port Configuration

**.env is the single source of truth** for all port assignments:
- `FRONTEND_PORT=5174` - React dev server
- `BACKEND_PORT=3000` - Express API
- `POSTGRES_PORT=5432` - PostgreSQL
- `REDIS_PORT=6379` - Redis
- `BULLMQ_METRICS_PORT=4000` - BullMQ metrics exporter
- `PROMETHEUS_PORT=9090`, `GRAFANA_PORT=3001` - Monitoring

All docker-compose files reference these via `${VARIABLE:-default}` syntax.

### Database Strategy

**Remote PostgreSQL Only**:
- Database runs on remote server accessed via Tailscale VPN
- Local PostgreSQL Docker container is stopped/disabled
- All connections require Tailscale to be active
- Development URLs: `MAC_DB_URL` (Mac → hobbes), `HOBBES_DB_URL` (hobbes → localhost)
- Production uses API layer only (no direct DB access)

**Schema** (3 tables):
1. `properties` - Scraped property data (370K+ records, deduplicated by `property_id`)
2. `scrape_jobs` - Job execution tracking (status, timing, results)
3. `monitored_searches` - Automated search term monitoring

### Redis/Queue Infrastructure

**CRITICAL: Always Use Hobbes for Data Scraping**

**Production Scraping Configuration**:
- Redis must run on hobbes (remote server via Tailscale)
- Doppler configuration: `REDIS_HOST=hobbes`
- Requires active Tailscale VPN connection
- All scraping jobs use BullMQ queue on hobbes Redis
- Ensures centralized job management and prevents duplicate work

**Local Development**:
- Can use `REDIS_HOST=localhost` for testing
- Production scraping scripts MUST use hobbes

**Why hobbes for scraping**:
- Centralized queue management across multiple workers
- Prevents duplicate scraping from different machines
- Persistent job state even if local machine disconnects
- Production-level Redis configuration and monitoring

**Setup Requirements**:
1. Tailscale VPN must be running: `tailscale status`
2. Redis on hobbes must accept connections from Tailscale network
3. Configure hobbes Redis to bind to Tailscale interface (100.114.160.53)

### Scraping Constraints

**Search Terms That Work**:
- ✅ Entity terms (BEST): Trust, LLC., Corp, Part, Family, Real, Estate (~70+ properties/search)
- ✅ Single last names (4+ chars): Smith, Johnson, Garcia (~40-70 properties/search)
- ✅ Street addresses: "1234 Lamar", "5678 Congress" (~24 properties/search)

**Search Terms That Don't Work**:
- ❌ City names: Austin, Lakeway, Cedar Park
- ❌ ZIP codes: 78701, 78704
- ❌ Short terms (<4 chars): Lee, Kim, Ng
- ❌ Compound names: "Smith Jones", "John Smith"

**Why**: TCAD API has hardcoded search restrictions. Must use 4+ character single-word terms or street addresses.

### Token Management

TCAD API requires Bearer token that expires every ~5 minutes:
- `token-refresh.service.ts` auto-refreshes tokens in background
- Fallback to browser scraping if API auth fails
- Token stored in `TCAD_API_KEY` environment variable (via Doppler)

### Queue Architecture

**BullMQ Job Queue**:
- Redis-backed distributed queue
- Configurable concurrency via `QUEUE_CONCURRENCY` (default: 2 workers)
- Exponential backoff retry strategy
- Bull Board dashboard at `/admin/queues`
- Prometheus metrics integration

**Batch Scraper** (`continuous-batch-scraper.ts`):
- Generates weighted search terms (200+ names, 500+ last names, 150+ streets)
- Maintains queue size 100-500 pending jobs
- Deduplicates against database to avoid re-scraping
- Runs continuously 24/7

---

## Production Deployment

### Server: Hobbes (Linux)

**Configuration**:
- Branch: `linux-env`
- Process Manager: PM2 (`pm2 restart tcad-api`)
- Reverse Proxy: nginx
- Database: PostgreSQL localhost:5432
- Frontend: GitHub Pages (static build)

**Deployment Steps**:
1. Commit changes locally
2. Push to GitHub
3. Pull on hobbes: `ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper && git pull origin linux-env"`
4. Install deps (if needed): `ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper/server && npm install"`
5. Restart: `ssh aledlie@hobbes "pm2 restart tcad-api"`

**Express Trust Proxy** (CRITICAL):
```typescript
// server/src/index.ts:46
app.set('trust proxy', 1);  // Required for nginx reverse proxy
```
Without this, rate limiting fails with ValidationError.

**Verify Deployment**:
```bash
ssh aledlie@hobbes "pm2 status tcad-api"
ssh aledlie@hobbes "pm2 logs tcad-api --lines 50 --nostream --err"
curl -s "https://api.alephatx.info/api/properties?limit=1" | jq '.data[0].name'
```

### GitHub Pages (Frontend)

**Workflow**: `.github/workflows/deploy.yml`
- Fetches env vars from Doppler (`VITE_API_URL`, `FRONTEND_PORT`)
- Builds static files with Vite
- Deploys to GitHub Pages
- **NOTE**: Only frontend is deployed via GitHub Pages. Backend runs separately on hobbes.

---

## Critical Debugging Paths

### "Database connection failed"
1. Check Tailscale: `tailscale status`
2. Verify DATABASE_URL: `doppler secrets get DATABASE_URL --plain`
3. Test network: `ping [tailscale-hostname]`
4. Check remote server is running

### "TCAD API authentication failed"
1. Check token: `doppler secrets get TCAD_API_KEY --plain`
2. Token likely expired (5 min lifetime)
3. Token refresh service should auto-renew
4. Fallback to browser scraping

### "Rate limiting ValidationError"
- Ensure `app.set('trust proxy', 1)` in server/src/index.ts
- Required for nginx X-Forwarded-For header handling

### "Empty search results"
- Check search term length (must be 4+ chars)
- Avoid compound names, cities, ZIP codes
- Use entity terms (Trust, LLC., etc.) for best results

### "Queue not processing jobs"
```bash
npm run queue:status
docker logs tcad-redis
npm run analyze:overview
```

### "Module not found" (Prisma)
```bash
cd server
npx prisma generate
```

---

## Testing Strategy

### Test Framework: Vitest

**Migration Status**: Jest → Vitest (95% complete)
- 489 unit tests passing (88% pass rate)
- 0 tests failing (0%)
- 67 tests skipped (12%)
- Vitest provides faster execution and better ESM support
- See `server/src/__tests__/README.md` for complete documentation

### Test Structure

```
server/
├── vitest.config.ts              # Unit test configuration
├── vitest.integration.config.ts  # Integration test configuration
└── src/
    ├── __tests__/                # Integration tests
    │   ├── integration.test.ts
    │   ├── api.test.ts
    │   ├── auth-database.*.test.ts
    │   ├── security.test.ts
    │   └── README.md             # Test documentation
    ├── controllers/__tests__/    # Unit tests
    ├── middleware/__tests__/
    ├── services/__tests__/
    └── utils/__tests__/
```

### Unit Tests (282 tests, 22 files)

**Characteristics**:
- Fast execution (< 10 seconds)
- All dependencies mocked (no database/Redis)
- Run in parallel
- Suitable for CI/CD

**Coverage Areas**:
- ✅ Middleware (99%): Auth, validation, error handling, metrics
- ✅ Utils (100%): JSON-LD, deduplication
- ✅ Controllers: Property CRUD operations
- ✅ Routes (93%): API endpoints
- ⚠️ Services (partial): Token refresh, search optimization
- ⚠️ Library (partial): Prisma, Redis, scraper engine

**Commands**:
```bash
cd server
npm test                  # Run all unit tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report

# Run a single test file
npm test src/middleware/__tests__/auth.test.ts

# Run tests matching a pattern
npm test -- auth

# Run with watch mode for specific file
npm run test:watch src/middleware/__tests__/auth.test.ts
```

### Integration Tests (141 tests, 6 files)

**Characteristics**:
- Longer execution (up to 60 seconds per test)
- Requires external services (PostgreSQL, Redis)
- Sequential execution (no conflicts)
- Retry on failure

**Prerequisites**:
- ✅ Tailscale VPN running (`tailscale status`)
- ✅ PostgreSQL accessible via Tailscale
- ✅ Redis running (local or hobbes)
- ✅ DATABASE_URL configured

**Test Files**:
- `integration.test.ts` - Server health, API routes
- `api.test.ts` - Complete API endpoint testing
- `auth-database.integration.test.ts` - Auth → Database flow
- `auth-database.connection.test.ts` - Database connectivity
- `enqueue.test.ts` - Queue job enqueueing
- `security.test.ts` - Security middleware, rate limiting

**Commands**:
```bash
cd server
npm run test:integration              # Run all integration tests
npm run test:integration:watch        # Watch mode
npm run test:auth-db                  # Auth-database tests only
npm run test:enqueue                  # Queue tests only
npm run test:all                      # Both unit and integration
```

### Security Tests

Included in integration test suite:
- API key validation
- JWT token verification
- Rate limiting
- CORS policies
- XSS protection (CSP headers)

**Command**:
```bash
npm run test:security
```

### Coverage Goals

**Current**: 34.55%
**Target**: 60%

**Focus Areas**:
- Service layer (token refresh, search optimizer)
- Repository pattern
- Error handling edge cases
- Business logic validation

### Known Test Issues

**Skipped Tests** (67 tests, 12%):
- Integration tests skipped when infrastructure unavailable (Tailscale, Redis, PostgreSQL)
- Redis cache tests skipped by design (marked with `.skip()`)
- `tcad-scraper.test.ts` - Playwright browser mock initialization (21 tests)
- `token-refresh.service.test.ts` - Playwright + node-cron mock issues (3 tests)

**Recently Fixed** (November 26, 2025):
- ✅ `scraper.queue.test.ts` - Fixed 8 BullMQ queue configuration and event listener tests
- ✅ `scrape-scheduler.test.ts` - Fixed all 27 cron scheduler tests
- All tests now use proper `vi.resetModules()` pattern for module isolation

---

## Access Points

**Local Development**:
- Frontend: http://localhost:5174
- Backend API: http://localhost:3000
- Bull Dashboard: http://localhost:3000/admin/queues
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

**Production**:
- Frontend: https://alephatx.github.io/tcad-scraper/ (GitHub Pages)
- API: https://api.alephatx.info/api
- Health Check: https://api.alephatx.info/health

---

## Known Issues & Workarounds

### Issue: Docker Port 3002 Already Allocated
**Workaround**: Changed FRONTEND_PORT to 5174 to avoid conflict. Update .env if changing ports.

### Issue: Merge Conflicts in CLAUDE.md
**Status**: Resolved (lines 746-842, 1205-1225 had merge markers)
**Fix**: Duplicated production deployment sections removed.

### Issue: TCAD Search Restrictions
**Impact**: Cannot scrape by city, ZIP code, or compound names
**Strategy**: Focus on entity terms (Trust, LLC., Corp) which yield 70+ properties per search vs 20-40 for personal names.

---

## Performance Optimization

**Current Throughput**:
- 2 concurrent workers (configurable via `QUEUE_CONCURRENCY`)
- ~42,000 properties/hour with API method (1000 results/search)
- 80% success rate

**Scale to 400K Properties**:
- Increase to 4 workers: ~76,800 properties/hour
- Target: 12-16 hours with entity term strategy
- Monitor memory: Each worker needs ~500MB-1GB

**Best Practices**:
1. Prioritize entity terms (Trust, LLC., Corp, Part, Family)
2. Supplement with single last names (4+ chars)
3. Use street addresses for gap filling
4. Avoid short terms, cities, ZIPs, compound names

---

## Document Version

**Version**: 2.0
**Last Updated**: November 17, 2025
**Database**: PostgreSQL via Tailscale (local container disabled)
**Doppler Project**: integrity-studio (dev config)
**Port Configuration**: Centralized in .env (single source of truth)
