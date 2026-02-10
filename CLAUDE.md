# CLAUDE.md

**Last Updated**: February 9, 2026 | **Version**: 4.1

## Project Overview

TCAD Scraper extracts property tax data from Travis Central Appraisal District (TCAD).

- **Backend**: Express API (TypeScript) + BullMQ queues + Playwright scraping
- **Frontend**: React 19 + Vite
- **Database**: PostgreSQL (remote via Tailscale) + Prisma ORM
- **Queue**: BullMQ + Redis
- **Logging**: Pino (structured JSON)
- **Testing**: Vitest (617 tests, 0 skipped)
- **Scale**: 418K+ properties

```
React (5174) → Express (3000) → PostgreSQL (Tailscale)
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

### Infrastructure
- **Hosting**: GitHub Pages (frontend via `alephatx.info`), Hobbes (API via Cloudflare Tunnel)
- **Cloudflare Tunnel**: `tcad-api` tunnel routes `api.alephatx.info` → `localhost:3001` on Hobbes
- **Nginx**: Reverse proxy on Hobbes (port 80 → Node.js 3001); must be running for tunnel to work
- Docker Compose: `base.yml` + `dev.yml`
- Ports: Frontend 5174, Backend 3000, Redis 6379, PostgreSQL 5432

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

# Database (Tailscale required)
npx prisma generate
doppler run -- npx prisma migrate dev

# Testing
npm test                     # Unit tests (617 tests, <5 sec)
npm run test:integration     # Integration tests (Tailscale required)
npm run test:all:coverage    # Full coverage report

# Scraping
doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts
npm run queue:status
```

---

## Architecture Decisions

- **Remote PostgreSQL only** via Tailscale VPN; local container disabled
- **Production Redis**: `REDIS_HOST=hobbes` (prevents duplicate work across machines)
- **Bearer tokens** expire ~5 min; `token-refresh.service.ts` auto-refreshes (see [docs/TOKEN_MANAGEMENT.md](docs/TOKEN_MANAGEMENT.md))
- **Scraping constraints**: Works with entity terms (Trust, LLC., Corp), single last names (4+ chars), street addresses. Does NOT work with cities, ZIP codes, short terms (<4 chars), compound names
- **Env vars**: `TCAD_YEAR` (default: current year), `QUEUE_BATCH_CHUNK_SIZE` (default: 500)

---

## Production Deployment (Hobbes)

**Branch**: `linux-env` | **Process Manager**: PM2

```bash
# Deploy
ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper && git pull origin linux-env"
ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper/server && npm run build && pm2 restart tcad-api"

# Verify
ssh aledlie@hobbes "pm2 status tcad-api"
curl -s "https://api.alephatx.info/health" | jq
```

`app.set('trust proxy', 1)` REQUIRED in `server/src/index.ts` for nginx reverse proxy.

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
| DB connection failed | `tailscale status` → `doppler secrets get DATABASE_URL --plain` → `ping hobbes` |
| TCAD API auth failed | Token expired (5 min lifetime); check `pm2 logs tcad-api \| grep "Token refreshed"` |
| Queue not processing | `npm run queue:status` → `docker logs tcad-redis` |
| Rate limiting error | Ensure `app.set('trust proxy', 1)` in `server/src/index.ts` |
| API 522/unreachable | `ssh aledlie@hobbes "sudo systemctl status nginx"` → restart if failed |
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
