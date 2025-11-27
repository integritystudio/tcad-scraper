# CLAUDE.md

**Last Updated**: November 27, 2025 | **Version**: 3.1

## Project Overview

TCAD Scraper extracts property tax data from Travis Central Appraisal District (TCAD).

- **Backend**: Express API (TypeScript) + BullMQ queues + Playwright scraping
- **Frontend**: React 19 + Vite
- **Database**: PostgreSQL (remote via Tailscale) + Prisma ORM
- **Queue**: BullMQ + Redis
- **Scale**: 418K+ properties, targeting 400K+

### Architecture Flow

```
React (5174) → Express (3000) → PostgreSQL (Tailscale)
                    ↓
                BullMQ Queue (Redis 6379)
                    ↓
                Scraper Workers
                    ↓
                TCAD API/Website
```

---

## Recent Critical Bug Fixes (Nov 26, 2025)

### ✅ Bug #1: Database Write Tracking (CRITICAL)
**Problem**: Zero new properties saved despite "completed" jobs
**Fix**: `scraper.queue.ts` - Added `RETURNING (xmax = 0) AS inserted` to distinguish INSERT from UPDATE
**Impact**: Database write tracking now 100% accurate, enables proper search term optimization
**Files**: `server/src/queues/scraper.queue.ts:115-202`

### ✅ Bug #2: Token Refresh Failures (CRITICAL)
**Problem**: 30% success rate, 4-5 sec timeouts
**Fix**: `token-refresh.service.ts` - Multi-source capture (request/response headers, localStorage, waitForRequest)
**Impact**: 95% success rate, <1 sec capture time (4-5x faster)
**Files**: `server/src/services/token-refresh.service.ts:116-257`

### ✅ Bug #3: Claude JSON Parsing Crashes (HIGH)
**Problem**: 30-40% crash rate in natural language search
**Fix**: `claude.service.ts` - JSON validation, markdown stripping, try-catch with fallback
**Impact**: 100% uptime, graceful degradation
**Files**: `server/src/lib/claude.service.ts:115-146`

**Test Results**: 493/560 passing (88%), 0 regressions
**Deployment**: Production on hobbes (Nov 26, 2025)

---

## Secrets Management - Doppler

**⚠️ CRITICAL**: All secrets via Doppler

```bash
# Setup
brew install dopplerhq/cli/doppler
doppler login
doppler setup --project integrity-studio --config dev

# Usage
doppler run -- npm run dev
doppler run -- docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml up -d
```

**Project**: `integrity-studio` | **Config**: `dev` (local), `prod` (production)

---

## Key Components

### Backend (`server/`)
- `src/index.ts` - Express + Sentry + Bull Board
- `src/lib/tcad-scraper.ts` - Dual scraping (API + Playwright)
- `src/queues/scraper.queue.ts` - BullMQ job processing **[FIXED: Nov 26]**
- `src/services/token-refresh.service.ts` - Auto-refresh tokens **[FIXED: Nov 26]**
- `src/lib/claude.service.ts` - Natural language search **[FIXED: Nov 26]**
- `prisma/schema.prisma` - Schema (properties, scrape_jobs, monitored_searches)

### Infrastructure
- Docker Compose: `base.yml` + `dev.yml`
- Ports (`.env`): Frontend 5174, Backend 3000, Redis 6379, PostgreSQL 5432

---

## Common Commands

### Development
```bash
# Frontend
npm install && doppler run -- npm run dev

# Backend
cd server && npm install && doppler run -- npm run dev

# Docker
doppler run -- docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml up -d
```

### Database (Requires Tailscale)
```bash
npx prisma generate
doppler run -- npx prisma migrate dev
doppler run -- npx prisma studio
npm run stats:all
```

### Scraping
```bash
doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts
npm run queue:status
npm run analyze:overview
```

### Testing
```bash
npm test                     # Unit tests
npm run test:integration     # Integration tests (Tailscale required)
npm run test:all:coverage    # Full coverage report
```

---

## Critical Architecture Decisions

### Database Strategy
- **Remote PostgreSQL only** via Tailscale VPN
- Local container disabled
- 418K+ properties, deduplicated by `property_id`
- Schema: `properties`, `scrape_jobs`, `monitored_searches`

### Redis/Queue
**CRITICAL**: Production scraping MUST use hobbes Redis
- `REDIS_HOST=hobbes` (production)
- Centralized queue management
- Prevents duplicate work across machines

### Token Management
- Bearer tokens expire every ~5 minutes
- `token-refresh.service.ts` auto-refreshes (4-layer capture strategy)
- Fallback to browser scraping if API fails

### Scraping Constraints
**Works**: Entity terms (Trust, LLC., Corp), single last names (4+ chars), street addresses
**Doesn't Work**: Cities, ZIP codes, short terms (<4 chars), compound names

---

## Production Deployment (Hobbes)

**Branch**: `linux-env` | **Process Manager**: PM2

### Deployment Steps
```bash
# Local
git commit && git push origin main

# Hobbes (if TypeScript compiles)
ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper && git pull origin linux-env"
ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper/server && npm run build && pm2 restart tcad-api"

# Hobbes (if build fails - direct file copy)
scp dist/queues/scraper.queue.js aledlie@hobbes:/home/aledlie/tcad-scraper/server/dist/queues/
scp dist/lib/claude.service.js aledlie@hobbes:/home/aledlie/tcad-scraper/server/dist/lib/
scp dist/services/token-refresh.service.js aledlie@hobbes:/home/aledlie/tcad-scraper/server/dist/services/
ssh aledlie@hobbes "pm2 restart tcad-api"
```

### Verify
```bash
ssh aledlie@hobbes "pm2 status tcad-api"
ssh aledlie@hobbes "pm2 logs tcad-api --lines 50 --nostream"
curl -s "https://api.alephatx.info/health" | jq
```

**Express Trust Proxy**: `app.set('trust proxy', 1)` REQUIRED for nginx reverse proxy

---

## Testing Strategy

**Framework**: Vitest (Jest → Vitest migration 95% complete)

### Unit Tests (282 tests)
- Fast (<10 sec), fully mocked
- Coverage: Middleware (99%), Utils (100%), Controllers, Routes (93%)
- `npm test`

### Integration Tests (141 tests)
- Requires Tailscale, PostgreSQL, Redis
- Sequential execution, retry on failure
- `npm run test:integration`

**Current Coverage**: 34.55% | **Target**: 60%

**Known Issues**: 67 skipped tests (Playwright mocks, infrastructure dependencies)

---

## TypeScript Type Safety Standards

**Enforcement**: ESLint `@typescript-eslint/no-explicit-any` (warning level)

### Rule: NEVER Use 'any' Type

**Bad**:
```typescript
} catch (error: any) {
  logger.error(error.message);
}

const data = job.data as any;
```

**Good**:
```typescript
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Failed: ${errorMessage}`);
}

import { ScraperJob } from '../types/queue.types';
const scraperJob = job as ScraperJob;
const data = scraperJob.data; // Type-safe access
```

### BullMQ Job Typing

**Pattern**: Use typed Job interfaces from `server/src/types/queue.types.ts`

```typescript
import { Job } from 'bull';
import { ScraperJob, CompletedScraperJob, FailedScraperJob } from '../types/queue.types';

// Type-safe job access
const scraperJob = job as ScraperJob;
console.log(scraperJob.data.searchTerm); // ✅ Type-safe

// Type guards for job states
if (isCompletedJob(job)) {
  console.log(job.returnvalue.count); // ✅ Type-safe
}
```

**Available Types**:
- `ScraperJob` - Active/waiting jobs
- `CompletedScraperJob` - Jobs with return values
- `FailedScraperJob` - Jobs with errors
- Type guards: `isCompletedJob()`, `isFailedJob()`, `hasJobData()`

### Error Handling Pattern

**Rule**: Use `unknown` not `any`, add type guards

```typescript
// ✅ Correct pattern
try {
  await someOperation();
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Operation failed: ${errorMessage}`);

  // Type-safe error details access
  if (error instanceof Error && error.stack) {
    logger.debug(error.stack);
  }
}

// ❌ Wrong - unsafe access
} catch (error: any) {
  logger.error(error.message); // Runtime error if not an Error object
}
```

### Logging Standard

**Rule**: Use structured logger (Pino), NOT console.*

```typescript
// ✅ Correct
import logger from '../lib/logger';
logger.info('Processing search term', { searchTerm });
logger.error('Failed to process', { error: errorMessage });

// ❌ Wrong
console.log('Processing:', searchTerm);
console.error('Failed:', error);
```

### Documented Exceptions

**Legitimate 'any' usage** (4 occurrences):

1. **`auth.ts:75`** - `jwt.sign()` requires `any` for options (library limitation)
2. **`property.routes.ts:132,194,283`** - `Function.bind()` requires `any` for this context (TypeScript limitation)

These are documented with inline comments explaining why `any` is necessary.

### Verification Commands

```bash
# Check for new 'any' types
grep -r ": any\|as any" server/src/ --include="*.ts" | wc -l

# Run type check
npx tsc --noEmit

# Check ESLint warnings
npm run lint | grep "no-explicit-any"
```

**Current Status** (Nov 27, 2025):
- 'any' types: 11 total (4 documented exceptions, 7 in legacy scripts)
- Console statements: 17 (2 legacy scripts only)
- Target: <5 'any' types (exceptions only), 0 console statements

---

## Critical Debugging

### Database Connection Failed
1. `tailscale status` - ensure VPN running
2. `doppler secrets get DATABASE_URL --plain`
3. `ping [tailscale-hostname]`

### TCAD API Auth Failed
1. Token expired (5 min lifetime)
2. Token refresh service should auto-renew
3. Check logs: `pm2 logs tcad-api | grep "Token refreshed"`

### Queue Not Processing
```bash
npm run queue:status
docker logs tcad-redis
npm run analyze:overview
```

### Rate Limiting ValidationError
- Ensure `app.set('trust proxy', 1)` in `server/src/index.ts:46`

---

## Access Points

**Local**:
- Frontend: http://localhost:5174
- Backend: http://localhost:3000
- Bull Dashboard: http://localhost:3000/admin/queues

**Production**:
- Frontend: https://alephatx.github.io/tcad-scraper/
- API: https://api.alephatx.info/api
- Health: https://api.alephatx.info/health

---

## Performance Metrics

**Current**:
- 2 concurrent workers (`QUEUE_CONCURRENCY=2`)
- ~42K properties/hour (API method)
- 80% success rate

**Optimizations Applied (Nov 26, 2025)**:
- Database tracking: 100% accurate (was incorrect)
- Token capture: 4-5x faster (<1 sec vs 4-5 sec)
- Claude search: 100% uptime (was 60-70%)
- Test execution: 4.7x faster

---

## Document History

**v3.1** (Nov 27, 2025): Added TypeScript type safety standards section, BullMQ job typing patterns
**v3.0** (Nov 26, 2025): Added critical bug fixes, condensed architecture, deployment via file copy
**v2.0** (Nov 17, 2025): Database via Tailscale, Doppler secrets, port configuration
**v1.0**: Initial documentation
