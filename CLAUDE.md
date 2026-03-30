# CLAUDE.md

**Last Updated**: March 30, 2026 | **Version**: 5.2

## Project Overview

TCAD Scraper extracts property tax data from Travis Central Appraisal District (TCAD).

- **API**: Cloudflare Workers (Hono) + Workflows — migrated from Express/BullMQ March 2026
- **Frontend**: React 19 + Vite (GitHub Pages)
- **Database**: PostgreSQL (Render) via Cloudflare Hyperdrive
- **Queue**: Cloudflare Queues + Workflows (replaced BullMQ + Redis)
- **Cache**: Cloudflare KV (replaced Redis cache)
- **Logging**: Workers `console.*` + Sentry (replaced Pino)
- **Testing**: Vitest (680+ tests, 126/126 E2E tests passing via Playwright)
- **Scale**: 500K+ properties

```
React (5174) → CF Workers (Hono) → Hyperdrive → PostgreSQL (Render)
                    ↓
               CF Queue → ScraperWorkflow (5 steps)
                    ↓
               TCAD API → bulk upsert via Hyperdrive
```

**Legacy stack** (still in `server/` for reference): Express + BullMQ + Redis. Production traffic now served by Workers.

All secrets via Doppler (local dev) + `wrangler secret` (Workers). **Doppler project**: `integrity-studio` | **Config**: `dev` / `prod`.

---

## Key Components

### Workers API (`workers/tcad-api/`) — Production
- `src/index.ts` - Hono app + queue consumer + cron handlers + Sentry
- `src/workflows/scraper.workflow.ts` - ScraperWorkflow (5 steps: token, fetch, dedup, upsert, analytics)
- `src/controllers/property.ts` - Property routes (list, get, scrape, search, history)
- `src/controllers/api-usage.ts` - API usage routes
- `src/middleware/auth.ts` - API key (`x-api-key`) + JWT (`jose`) auth
- `src/db.ts` - Prisma + Hyperdrive connection
- `src/lib/claude.service.ts` - Natural language search (Anthropic primary, OpenAI fallback; query capped at 500 chars via Zod)
- `src/utils/constants.ts` - TCAD_API_URL, chunk sizes, timeouts
- `wrangler.toml` - Hyperdrive, KV, Queues, Workflows, Crons, route config

### Legacy Backend (`server/`) — Reference only
- `src/index.ts` - Express + Sentry (read-only DB queries, no scraping endpoints)
- `src/services/search-term-optimizer.ts` - Search term optimization logic
- `prisma/schema.prisma` - Schema (properties, scrape_jobs, monitored_searches) — still canonical
- BullMQ queues, token refresh service, schedulers, CLI tools removed (287ca63)

### Scripts (`scripts/` — root level, run from repo root)
- `continuous-batch-scraper.ts` - Long-running scraper; `STOP_AT_PROPERTIES` (500K) halt threshold
- `enqueue-batch.ts` - Config-driven batch enqueue runner
- `enqueue-tail-terms.ts` - Multi-phase tail term optimizer (analytics + owner-name mining)
- `generate-next-200-terms.ts` - Generate next candidate terms for backfill
- `queue-results.ts` - Queue status + recent jobs (`doppler run -- npx tsx scripts/queue-results.ts [--limit N]`)
- `config/batch-configs.ts` - 18 batch type definitions
- `lib/` - queue-utils, backfill-runner, searched-terms, backfill-utils
- `requeue/` - Failed job requeue scripts
- See [scripts/README.md](scripts/README.md) for full reference
- **Search Term Strategy**: See [SEARCH_TERM_STRATEGY.md](SEARCH_TERM_STRATEGY.md) for Tier 1-4 efficiency breakdown and [SEARCH_TERM_ANALYSIS.md](SEARCH_TERM_ANALYSIS.md) for full ranked term list

### Infrastructure
- **API**: Cloudflare Workers at `api.alephatx.info` (route: `api.alephatx.info/*`)
- **Frontend**: GitHub Pages at `alephatx.info`
- **Database**: Render PostgreSQL via Hyperdrive (`e0406d51a79a4440863e0c608390a613`)
- **Cache**: Cloudflare KV (TOKEN_CACHE, RESPONSE_CACHE)
- **Queue**: Cloudflare Queues (`tcad-scraper-jobs`, DLQ: `tcad-scraper-dlq`)
- **Crons**: Token refresh (4min), stale job cleanup (hourly), monitored searches (6hr)
- **Monitoring**: Sentry + `wrangler tail` + Cloudflare dashboard

### Project Layout
```
├── workers/tcad-api/     # Production API (CF Workers + Hono)
│   └── src/              # index, controllers, workflows, middleware, lib
├── src/                  # Frontend (React + Vite)
├── server/               # Legacy backend (Express + BullMQ + Prisma)
│   └── prisma/           # Schema + migrations (canonical)
├── scripts/              # CLI tools, batch scripts, backfill, enqueue
├── e2e/                  # Playwright E2E tests
├── utils/                # Shared constants
├── config/               # GTM configs
├── shared/               # Shared types
└── docs/                 # All documentation
```

---

## Git Commands

**Always use absolute paths or run from repo root.** Tests run from `server/`, so `git add server/src/...` resolves to `server/server/src/...`. Use:
```bash
git -C /Users/alyshialedlie/code/is-public-sites/tcad-scraper add server/src/file.ts
```

---

## Common Commands

```bash
# Dev
npm install && doppler run -- npm run dev          # Frontend
cd workers/tcad-api && npm run dev                  # Workers API (local)
cd server && npm install && doppler run -- npm run dev  # Legacy backend

# Workers Management
cd workers/tcad-api
npx wrangler deploy                                # Deploy to production
npx wrangler tail                                  # Live logs
npx wrangler workflows instances list scraper-workflow --per-page 10  # Workflow status
npx wrangler secret put <NAME>                     # Set secret

# Database
cd server && npx prisma generate
doppler run -- npx prisma migrate dev

# Testing
npm test                     # Unit tests (680+ tests, <5 sec)
npm run test:integration     # Integration tests
npm run test:all:coverage    # Full coverage report
npm run test:e2e             # E2E tests (126 tests, all passing)

# Scraping (via Workers API)
curl -X POST "https://api.alephatx.info/api/properties/scrape" \
  -H "Content-Type: application/json" -H "x-api-key: $TCAD_API_KEY" \
  -d '{"searchTerm": "Smith"}'

# Scraping (legacy BullMQ — still works for local dev)
doppler run -- npx tsx scripts/continuous-batch-scraper.ts
npm run queue:status

# Search Term Optimization Strategy (March 2026)
# Tier 1 (15 terms) = 19.6% coverage, Tier 1+2 (50 terms) = 45.1%, Tier 1+2+3 (200 terms) = 92.1%
# See SEARCH_TERM_STRATEGY.md for full strategy and efficiency metrics

# Backfill Discovery
doppler run -- npx tsx scripts/generate-next-200-terms.ts          # Dry run
doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue # Generate and enqueue
doppler run -- npx tsx scripts/check-unsearched-terms.ts            # Find unsearched terms
bash scripts/search-terms-summary.sh                                # Recent search terms table

# Tail Term Optimizer (maximize new properties when yield drops)
TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts           # All phases
TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts --phase 1 # Proven analytics terms
TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts --phase 3 # Mine owner names/streets

# Database Queries (run from server/)
doppler run -- npx tsx --eval "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.property.count({where:{year:2025}}).then(c=>{console.log('Count:',c);return p.\$disconnect()}).then(()=>process.exit(0));"
doppler run -- npx tsx --eval "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.\$queryRaw\`SELECT search_term, total_results, total_searches, success_rate FROM search_term_analytics WHERE total_results > 0 ORDER BY total_results DESC LIMIT 50\`.then(r=>{console.table(r);return p.\$disconnect()}).then(()=>process.exit(0));"

# Queue Management (Legacy BullMQ — dequeue all waiting/failed jobs)
# ⚠️ Must pause queue first; use try/catch on job.remove()
npx tsx --eval "import { scraperQueue } from './src/queues/scraper.queue'; (async () => { await scraperQueue.pause(); const waiting = await scraperQueue.getWaiting(0, 500); for (const j of waiting) { try { await j.remove(); } catch(e) {} } const failed = await scraperQueue.getFailed(0, 500); for (const j of failed) { try { await j.remove(); } catch(e) {} } await scraperQueue.resume(); console.log('Cleared', waiting.length, 'waiting +', failed.length, 'failed'); await scraperQueue.close(); process.exit(0); })();"

# Workers Queue — view via Cloudflare dashboard or:
cd workers/tcad-api && npx wrangler queues list
```

---

## Architecture Decisions

- **Cloudflare Workers** serves production API (March 2026 migration from Render/Express)
- **Hyperdrive** connection pools to Render PostgreSQL — no DB migration needed
- **Cloudflare Queues + Workflows** replaced BullMQ + Redis for scrape job processing
- **Cloudflare KV** replaced Redis for token cache + response cache
- **Cron Triggers** replaced `node-cron` for scheduled tasks
- **Bearer tokens** expire ~5 min; cron trigger auto-refreshes to KV (see [docs/TOKEN_MANAGEMENT.md](docs/TOKEN_MANAGEMENT.md))
- **Scraping constraints**: Works with entity terms (Trust, LLC., Corp), single last names (4+ chars), street addresses, suburb/city names. Does NOT work with ZIP codes, short terms (<4 chars), compound names, or numeric-only terms
- **Env vars**: `TCAD_YEAR` (wrangler.toml vars), `UPSERT_CHUNK_SIZE` (500)
- See [docs/CLOUDFLARE_MIGRATION_PLAN.md](docs/CLOUDFLARE_MIGRATION_PLAN.md) for full migration details

---

## Production Deployment (Cloudflare Workers)

Deploy from `workers/tcad-api/`: `npx wrangler deploy`

Verify: `curl -s "https://api.alephatx.info/health" | jq`

Expected response: `{"status":"ok","propertyCount":N,"runtime":"cloudflare-workers"}`

---

## Code Standards

- **Prisma selects**: Only use fields from `prisma/schema.prisma`. `SearchTermAnalytics` has `totalSearches`, NOT `searchCount`
- **No `any`**: Use `unknown` + type guards. Use `getErrorMessage()` from `utils/error-helpers.ts`
- **Workers logging**: Use `console.*` (Workers structured logging). Legacy `server/` uses Pino logger
- **Workers env**: Access via `c.env.X` (Hono context), not `process.env.X`
- **Auth**: Workers uses `x-api-key` header checked against `env.API_KEY` (value = Doppler `TCAD_API_KEY`). JWT via `jose` (not `jsonwebtoken`)
- **TCAD API request format**: Body must use `{ pYear: { operator: "=", value }, fullTextSearch: { operator: "match", value } }` with pagination as query params `?page=N&pageSize=N`. Token passed as `Authorization: token` (token already includes "Bearer " prefix from token worker — do NOT add a second "Bearer " prefix). See `server/src/lib/tcad-api-client.ts` for the canonical implementation
- **BullMQ typing** (legacy): Use `ScraperJob`, `CompletedScraperJob`, `FailedScraperJob` from `types/queue.types.ts`

---

## Debugging

| Problem | Steps |
|---------|-------|
| DB connection failed | Check Render dashboard; verify Hyperdrive config: `wrangler hyperdrive get tcad-db` |
| TCAD API auth failed | Token expired (5 min); check `wrangler tail` for refresh errors |
| TCAD API 500 / 0 results | Verify request body format matches `tcad-api-client.ts` (operator format, query string pagination, no double Bearer prefix). TCAD also returns 500 for genuinely empty terms |
| Workflows stuck | `wrangler workflows instances list scraper-workflow --status running` |
| Queue not processing | `wrangler queues list`; check consumer in `wrangler tail` |
| Workers deploy failed | `wrangler deploy --dry-run`; check `npx tsc --noEmit` in `workers/tcad-api/` |
| API 522/unreachable | Check Cloudflare dashboard; `wrangler tail` for errors |
| Legacy: Queue stuck | `npm run queue:status`, check Render Redis or server logs |

---

## Access Points

| Environment | URL |
|------------|-----|
| Frontend (local) | http://localhost:5174 |
| Workers API (local) | `wrangler dev` (workers/tcad-api/) |
| Legacy backend (local) | http://localhost:3001 |
| Frontend (prod) | https://alephatx.info |
| API (prod) | https://api.alephatx.info/api |
| Health (prod) | https://api.alephatx.info/health |
| Workers logs | `wrangler tail` (workers/tcad-api/) |
| Cloudflare dashboard | https://dash.cloudflare.com |
