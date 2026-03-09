# CLAUDE.md

**Last Updated**: March 9, 2026 | **Version**: 4.5

## Project Overview

TCAD Scraper extracts property tax data from Travis Central Appraisal District (TCAD).

- **Backend**: Express API (TypeScript) + BullMQ queues + TCAD API-direct scraping
- **Frontend**: React 19 + Vite
- **Database**: PostgreSQL (Render) + Prisma ORM
- **Queue**: BullMQ + Redis (Render, TLS)
- **Logging**: Pino (structured JSON)
- **Testing**: Vitest (631+ tests)
- **Scale**: 418K+ properties

```
React (5174) → Express (3001) → PostgreSQL (Render)
                    ↓
                BullMQ Queue (Render Redis / TLS)
                    ↓
                Scraper Workers → TCAD API
```

---

## Secrets Management - Doppler

All secrets via Doppler. **Project**: `integrity-studio` | **Config**: `dev` / `prod`

```bash
doppler run -- npm run dev
doppler run -- docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml up -d
```

---

## Key Components

### Backend (`server/`)
- `src/index.ts` - Express + Sentry + Bull Board
- `src/lib/tcad-scraper.ts` - Scraper entry point (API-direct mode; Playwright removed Feb 2026)
- `src/queues/scraper.queue.ts` - BullMQ job processing
- `src/services/token-refresh.service.ts` - Auto-refresh tokens via Cloudflare Worker
- `src/lib/claude.service.ts` - Natural language search
- `src/lib/tcad-api-client.ts` - TCAD API client with structured diagnostics for JSON parse failures
- `src/scripts/enqueue-batch.ts` - Config-driven batch enqueue runner
- `src/scripts/config/batch-configs.ts` - 18 batch type definitions
- `src/scripts/continuous-batch-scraper.ts` - Long-running scraper; `STOP_AT_PROPERTIES` (500K) controls halt threshold
- `src/scripts/queue-results.ts` - Queue status + recent completed/failed jobs (`doppler run -- npx tsx src/scripts/queue-results.ts [--limit N]`)
- See [src/scripts/README.md](server/src/scripts/README.md) for full scripts reference
- `src/utils/` - Shared utilities (error-helpers, property-transformers, timing)
- `prisma/schema.prisma` - Schema (properties, scrape_jobs, monitored_searches)

### API
- See [docs/API.md](docs/API.md) for full endpoint reference

### Infrastructure
- **Hosting**: GitHub Pages (frontend via `alephatx.info`), Render (API)
- Docker Compose: `config/docker-compose.base.yml` + `dev.yml`
- Monitoring: `config/monitoring/` (Grafana dashboards, Prometheus configs)
- Ports: Frontend 5174, Backend 3001, Redis 6379 (Render TLS), PostgreSQL (Render)

### Project Layout
```
├── src/                  # Frontend (React + Vite)
├── server/               # Backend (Express + BullMQ + Prisma)
│   ├── src/scripts/      # CLI tools, batch scripts, test utilities
│   └── prisma/           # Schema + migrations (canonical location)
├── config/               # Docker Compose, monitoring, GTM configs
│   └── monitoring/       # Grafana dashboards, Prometheus rules + Alloy
├── scripts/              # Shell + Python utility scripts
├── shared/               # Shared types between frontend/backend
└── docs/                 # All documentation
```

---

## Git Commands

**Always use absolute paths or run from repo root.** Tests run from `server/`, so `git add server/src/...` resolves to `server/server/src/...`. Use:
```bash
git -C /Users/alyshialedlie/code/ISPublicSites/tcad-scraper add server/src/file.ts
```

---

## Common Commands

```bash
# Frontend
npm install && doppler run -- npm run dev

# Backend
cd server && npm install && doppler run -- npm run dev

# Docker
doppler run -- docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml up -d

# Database
npx prisma generate
doppler run -- npx prisma migrate dev

# Testing
npm test                     # Unit tests (631+ tests, <5 sec)
npm run test:integration     # Integration tests
npm run test:all:coverage    # Full coverage report

# Scraping
doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts
npm run queue:status

# Backfill Discovery
doppler run -- npx tsx src/scripts/generate-next-200-terms.ts          # Generate next 500 candidate terms (dry run)
doppler run -- npx tsx src/scripts/generate-next-200-terms.ts --enqueue # Generate and enqueue
doppler run -- npx tsx src/scripts/check-unsearched-terms.ts            # Find inventory terms not yet searched for current year
# Pipe unsearched terms to enqueue:
#   doppler run -- npx tsx src/scripts/check-unsearched-terms.ts | grep '^ ' | sed 's/^  //' | doppler run -- npx tsx src/scripts/enqueue-terms.ts
bash scripts/search-terms-summary.sh                                    # Recent search terms table (from repo root)

# Queue Management
## Dequeue all waiting/failed jobs
# ⚠️ Bull (not BullMQ) API: clean() and drain() have different signatures or don't exist
# ⚠️ Must pause queue first — active workers grab waiting jobs during removal
# ⚠️ Use try/catch on job.remove() — already-active jobs throw "Could not remove"
npx tsx --eval "import { scraperQueue } from './src/queues/scraper.queue'; (async () => { await scraperQueue.pause(); const waiting = await scraperQueue.getWaiting(0, 500); for (const j of waiting) { try { await j.remove(); } catch(e) {} } const failed = await scraperQueue.getFailed(0, 500); for (const j of failed) { try { await j.remove(); } catch(e) {} } await scraperQueue.resume(); console.log('Cleared', waiting.length, 'waiting +', failed.length, 'failed'); await scraperQueue.close(); process.exit(0); })();"
```

---

## Architecture Decisions

- **Remote PostgreSQL on Render**; local container disabled
- **Production Redis**: Render Redis via `REDIS_URL` in Doppler (`rediss://` TLS). Config auto-detects TLS from URL prefix. Local dev also uses Render Redis (IP allowlisted)
- **Bearer tokens** expire ~5 min; `token-refresh.service.ts` auto-refreshes (see [docs/TOKEN_MANAGEMENT.md](docs/TOKEN_MANAGEMENT.md))
- **Scraping constraints**: Works with entity terms (Trust, LLC., Corp), single last names (4+ chars), street addresses. Does NOT work with cities, ZIP codes, short terms (<4 chars), compound names, or numeric-only terms (address numbers, property IDs, GEO IDs)
- **Env vars**: `TCAD_YEAR` (default: current year), `QUEUE_BATCH_CHUNK_SIZE` (default: 500)

---

## Production Deployment (Render)

**Branch**: `main` | **Platform**: Render

Deploys automatically on push to `main`. See `render.yaml` for service config.

```bash
# Verify
curl -s "https://api.alephatx.info/health" | jq
```

---

## Code Standards

- **Prisma selects**: Only use fields from `prisma/schema.prisma`. `SearchTermAnalytics` has `totalSearches`, NOT `searchCount`
- **No `any`**: Use `unknown` + type guards. Use `getErrorMessage()` from `utils/error-helpers.ts`
- **No `console.*`**: Use Pino logger (`import logger from '../lib/logger'`). CLI scripts exempt via ESLint override
- **BullMQ typing**: Use `ScraperJob`, `CompletedScraperJob`, `FailedScraperJob` from `types/queue.types.ts`
- **Documented exceptions**: None remaining (0 `any` in production code)

---

## Debugging

| Problem | Steps |
|---------|-------|
| DB connection failed | Check Render dashboard → verify DATABASE_URL in Doppler |
| TCAD API auth failed | Token expired (5 min lifetime); check server logs for "Token refreshed". See [Requeue Scripts](server/README.md#requeue-scripts) |
| Queue not processing | `npm run queue:status` → check Render Redis dashboard or server logs |
| Mass job failures | Use requeue scripts in `server/src/scripts/requeue/`. See [Requeue Scripts](server/README.md#requeue-scripts) |
| Rate limiting error | Ensure `app.set('trust proxy', 1)` in `server/src/index.ts` |
| API 522/unreachable | Check Render dashboard → service logs |
| DNS not resolving | Flush: `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` |

---

## Access Points

| Environment | URL |
|------------|-----|
| Frontend (local) | http://localhost:5174 |
| Backend (local) | http://localhost:3001 |
| Bull Dashboard | http://localhost:3001/admin/queues |
| Frontend (prod) | https://alephatx.info |
| API (prod) | https://api.alephatx.info/api |
| Health (prod) | https://api.alephatx.info/health |
