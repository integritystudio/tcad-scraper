# CLAUDE.md

**Last Updated**: February 10, 2026 | **Version**: 4.2

## Project Overview

TCAD Scraper extracts property tax data from Travis Central Appraisal District (TCAD).

- **Backend**: Express API (TypeScript) + BullMQ queues + Playwright scraping
- **Frontend**: React 19 + Vite
- **Database**: PostgreSQL (Render) + Prisma ORM
- **Queue**: BullMQ + Redis
- **Logging**: Pino (structured JSON)
- **Testing**: Vitest (617 tests, 0 skipped)
- **Scale**: 418K+ properties

```
React (5174) → Express (3000) → PostgreSQL (Render)
                    ↓
                BullMQ Queue (Redis 6379)
                    ↓
                Scraper Workers → TCAD API/Website
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
- `src/lib/tcad-scraper.ts` - Dual scraping (API + Playwright)
- `src/queues/scraper.queue.ts` - BullMQ job processing
- `src/services/token-refresh.service.ts` - Auto-refresh tokens
- `src/lib/claude.service.ts` - Natural language search
- `src/scripts/enqueue-batch.ts` - Config-driven batch enqueue runner
- `src/scripts/config/batch-configs.ts` - 14 batch type definitions
- `src/utils/` - Shared utilities (error-helpers, property-transformers, timing)
- `prisma/schema.prisma` - Schema (properties, scrape_jobs, monitored_searches)

### API
- See [docs/API.md](docs/API.md) for full endpoint reference

### Infrastructure
- **Hosting**: GitHub Pages (frontend via `alephatx.info`), Render (API)
- Docker Compose: `config/docker-compose.base.yml` + `dev.yml`
- Monitoring: `config/monitoring/` (Grafana dashboards, Prometheus configs)
- Ports: Frontend 5174, Backend 3000, Redis 6379, PostgreSQL 5432

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
npm test                     # Unit tests (617 tests, <5 sec)
npm run test:integration     # Integration tests
npm run test:all:coverage    # Full coverage report

# Scraping
doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts
npm run queue:status
```

---

## Architecture Decisions

- **Remote PostgreSQL on Render**; local container disabled
- **Production Redis**: `REDIS_URL via Doppler (Render Redis)` (prevents duplicate work across machines)
- **Bearer tokens** expire ~5 min; `token-refresh.service.ts` auto-refreshes (see [docs/TOKEN_MANAGEMENT.md](docs/TOKEN_MANAGEMENT.md))
- **Scraping constraints**: Works with entity terms (Trust, LLC., Corp), single last names (4+ chars), street addresses. Does NOT work with cities, ZIP codes, short terms (<4 chars), compound names
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

- **No `any`**: Use `unknown` + type guards. Use `getErrorMessage()` from `utils/error-helpers.ts`
- **No `console.*`**: Use Pino logger (`import logger from '../lib/logger'`). CLI scripts exempt via ESLint override
- **BullMQ typing**: Use `ScraperJob`, `CompletedScraperJob`, `FailedScraperJob` from `types/queue.types.ts`
- **Documented exceptions**: None remaining (0 `any` in production code)

---

## Debugging

| Problem | Steps |
|---------|-------|
| DB connection failed | Check Render dashboard → verify DATABASE_URL in Doppler |
| TCAD API auth failed | Token expired (5 min lifetime); check `pm2 logs tcad-api \| grep "Token refreshed"` |
| Queue not processing | `npm run queue:status` → `docker logs tcad-redis` |
| Rate limiting error | Ensure `app.set('trust proxy', 1)` in `server/src/index.ts` |
| API 522/unreachable | Check Render dashboard → service logs |
| DNS not resolving | Flush: `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` |

---

## Access Points

| Environment | URL |
|------------|-----|
| Frontend (local) | http://localhost:5174 |
| Backend (local) | http://localhost:3000 |
| Bull Dashboard | http://localhost:3000/admin/queues |
| Frontend (prod) | https://alephatx.info |
| API (prod) | https://api.alephatx.info/api |
| Health (prod) | https://api.alephatx.info/health |
