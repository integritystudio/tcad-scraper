# CLAUDE.md

**Last Updated**: August 6, 2026 | **Version**: 6.2

## Project Overview

TCAD Scraper extracts property tax data from Travis Central Appraisal District (TCAD).

- **API**: Cloudflare Workers (Hono) + Workflows — migrated from Express/BullMQ March 2026
- **Frontend**: React 19 + Vite (GitHub Pages)
- **Database**: Cloudflare D1 (SQLite at the edge) — migrated from PostgreSQL/Render March 30, 2026 ([migration details](docs/changelog/2026-03-30.md))
- **Queue/Jobs**: Cloudflare Queues + Workflows (replaced BullMQ + Redis); Cron Triggers (replaced `node-cron`)
- **Cache**: Cloudflare KV (replaced Redis cache)
- **Logging**: Workers `console.*` + Sentry (replaced Pino)
- **Testing**: Vitest (130 frontend + 29 scripts + 16 workers tests; 126/126 E2E via Playwright)
- **Scale**: 260K+ properties in D1 (2025 tax year; live count via `/health`)

```
React (5174) → CF Workers (Hono) → D1 (SQLite at edge)
                    ↓
               CF Queue → ScraperWorkflow (5 steps)
                    ↓
               TCAD API → Prisma upsert via D1
```

**Legacy stack**: the Express/BullMQ/Redis `server/` directory was removed August 2026 (shared utilities moved to `scripts/lib/` and `shared/types/`); original implementations live in git history.

All secrets via Doppler (local dev) + `wrangler secret` (Workers). **Doppler project**: `integrity-studio` | **Configs**: `dev` / `prd` (also `stg`, `dev_personal`).

---

## Key Components

### Workers API (`workers/tcad-api/`) — Production
- `src/index.ts` - Hono app + queue consumer + cron handlers + Sentry
- `src/workflows/scraper.workflow.ts` - ScraperWorkflow (5 steps: token, fetch, dedup, upsert, analytics)
- `src/controllers/property.ts` - Property routes (list, get, scrape, search, history)
- `src/controllers/api-usage.ts` - API usage routes
- `src/middleware/auth.ts` - API key (`x-api-key`) auth + Zod validation middleware
- `src/db.ts` - Prisma + D1 connection (`PrismaD1` adapter)
- `src/lib/claude.service.ts` - Natural language search (Anthropic primary, OpenAI fallback; query capped at 500 chars via Zod) + `sanitizeWhereClause`
- `src/utils/constants.ts` - TCAD_API_URL, chunk sizes, timeouts, D1 micro-chunk config
- `src/utils/epoch-dates.ts` - `nowEpoch()`, `epochToISO()`, `dateToEpoch()` — D1 date workaround
- `src/utils/json-array.ts` - `serializeIds()`/`deserializeIds()` for JSON-serialized arrays
- `src/utils/` also has `error-helpers.ts` (`getErrorMessage()`) and `property-transformers.ts`
- `wrangler.toml` - D1, KV, Queues, Workflows, Crons, route config

### Scripts (`scripts/` — root level, run from repo root)
- `enqueue-tail-terms.ts` - Multi-phase tail term optimizer (analytics + owner-name mining)
- `generate-next-200-terms.ts` - Generate next candidate terms for backfill, ranked by predicted yield (in-DB match frequency; drops near-zero matchers). `--enqueue` sends to Workers API
- `queue-results.ts` - Recent scrape jobs + property count from the Workers API (`npx tsx scripts/queue-results.ts [--limit N]`)
- `config/batch-configs.ts` - 19 batch type definitions
- `lib/` - queue-utils (`enqueueBatch()` via Workers API), d1-prisma (Prisma over D1 HTTP — production data access for scripts), backfill-runner, fallback-terms, searched-terms, backfill-utils, search-term-deduplicator, error-helpers, logger
- See [scripts/README.md](scripts/README.md) for full reference
- **Search Term Strategy**: See [docs/SEARCH_TERMS.md](docs/SEARCH_TERMS.md) (canonical) for Tier 1-4 strategy, coverage metrics + operations, and [docs/2025_BACKFILL_OPTIMIZATION.json](docs/2025_BACKFILL_OPTIMIZATION.json) for per-term yield data

### Infrastructure
- **API**: Cloudflare Workers at `api.alephatx.info` (route: `api.alephatx.info/*`)
- **Frontend**: GitHub Pages at `alephatx.info`
- **Database**: Cloudflare D1 `tcad-db` (`451d4356-10d1-4c1d-adf9-4d4297636343`); direct queries via `CLOUDFLARE_D1_TOKEN` (Doppler) — see Database commands
- **Cache**: Cloudflare KV (TOKEN_CACHE, RESPONSE_CACHE)
- **Queue**: Cloudflare Queues (`tcad-scraper-jobs`, DLQ: `tcad-scraper-dlq`)
- **Crons**: Token refresh (4min), stale job cleanup (hourly), search term optimization (3am), monitored searches (6hr)
- **Monitoring**: Sentry + `wrangler tail` + Cloudflare dashboard

### Project Layout
```
├── workers/tcad-api/     # Production API (CF Workers + Hono)
│   ├── prisma/           # D1/SQLite schema + migrations (canonical)
│   └── src/              # index, controllers, workflows, middleware, lib, utils
├── src/                  # Frontend (React + Vite)
├── scripts/              # CLI tools, batch scripts, backfill, enqueue
├── e2e/                  # Playwright E2E tests
├── utils/                # Shared constants
├── config/               # GTM configs
├── shared/               # Shared types
└── docs/                 # All documentation
```

### Efficient Code Reads (repomix packs)
Regenerate with `npm run repomix` (outputs in `docs/repomix/`; also retrains the zstd dict in `.condense/`):
- `token-tree.txt` — per-file token counts; check first to decide what's worth reading
- `compressed.xml` — structure-only (tree-sitter: signatures/types, no bodies) for architecture questions
- `full.xml` — grep for `## File: <path>` markers to jump to specific files without opening each one
- `.condense/dict_typescript.zdict` is a zstd *compression* dictionary (storage only) — it cannot make reads cheaper; don't use it for that

---

## Git Commands

**Always use absolute paths or run from repo root.** Commands run from subdirectories (e.g. `workers/tcad-api/`) make relative `git add` paths resolve wrong. Use:
```bash
git -C /Users/alyshialedlie/code/is-public-sites/tcad-scraper add workers/tcad-api/src/file.ts
```

---

## Common Commands

```bash
# Dev
npm install && doppler run -- npm run dev          # Frontend
cd workers/tcad-api && npm run dev                  # Workers API (local)

# Workers Management (from workers/tcad-api/)
npx wrangler deploy                                # Deploy to production
curl -s "https://api.alephatx.info/health" | jq    # Verify deploy — expect {"status":"ok","propertyCount":N,"runtime":"cloudflare-workers"}
npx wrangler tail                                  # Live logs
npx wrangler workflows instances list scraper-workflow --per-page 10  # Workflow status
npx wrangler queues list                           # Queue status (or Cloudflare dashboard)
npx wrangler secret put <NAME>                     # Set secret

# Database (D1 — from workers/tcad-api/)
npx prisma generate
npx wrangler d1 execute tcad-db --local --file prisma/migrations/0001_init.sql  # seed local
npx wrangler d1 execute tcad-db --remote --command "SELECT COUNT(*) FROM properties WHERE year = 2025"
npx wrangler d1 execute tcad-db --remote --command "SELECT search_term, total_results, total_searches, success_rate FROM search_term_analytics WHERE total_results > 0 ORDER BY total_results DESC LIMIT 50"

# D1 access when wrangler OAuth is expired — use CLOUDFLARE_D1_TOKEN (Doppler, dev + prd):
# token "tcad-d1-query" has D1 Read/Write/Metadata Read; the deploy CLOUDFLARE_API_TOKEN can NOT query D1 (7403)
doppler run -p integrity-studio -c prd -- sh -c \
  'CLOUDFLARE_API_TOKEN=$CLOUDFLARE_D1_TOKEN npx wrangler d1 execute tcad-db --remote --command "SELECT 1"'
# or via REST:
doppler run -p integrity-studio -c prd -- sh -c 'curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/b3868dd0fd5c0faa7d98aa325a9c2377/d1/database/451d4356-10d1-4c1d-adf9-4d4297636343/query" \
  -H "Authorization: Bearer $CLOUDFLARE_D1_TOKEN" -H "Content-Type: application/json" \
  -d "{\"sql\": \"SELECT COUNT(*) FROM properties\"}"'

# Testing (from repo root)
npx vitest run               # Frontend unit tests (130 tests, <5 sec; `npm test` = watch mode)
npm run test:coverage        # Frontend coverage report
npm run test:e2e             # E2E tests (126 tests, all passing)
cd workers/tcad-api && npm test        # Workers tests (16 tests)
npx vitest run --dir scripts --config /dev/null  # Scripts tests (29 tests)

# Scraping (via Workers API)
curl -X POST "https://api.alephatx.info/api/properties/scrape" \
  -H "Content-Type: application/json" -H "x-api-key: $TCAD_API_KEY" \
  -d '{"searchTerm": "Smith"}'

# Backfill Discovery (strategy + tier coverage: docs/SEARCH_TERMS.md)
doppler run -- npx tsx scripts/generate-next-200-terms.ts           # Dry run; add --enqueue to send to Workers API
doppler run -- npx tsx scripts/check-unsearched-terms.ts            # Find unsearched terms
bash scripts/search-terms-summary.sh                                # Recent search terms table (D1)

# Tail Term Optimizer (maximize new properties when yield drops)
# --phase 1 = proven analytics terms, --phase 3 = mine owner names/streets; omit for all phases
TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts [--phase N]
```

---

## Architecture Decisions

- **Prisma `$transaction` with individual upserts** for bulk writes — avoids D1's 100-param limit and handles date serialization correctly
- **Bearer tokens** expire ~5 min; cron trigger auto-refreshes to KV
- **Scraping constraints**: Works with entity terms (Trust, LLC., Corp), single last names (4+ chars), street addresses, suburb/city names. Does NOT work with ZIP codes, short terms (<4 chars), compound names, or numeric-only terms
- **Env vars**: `TCAD_YEAR` (wrangler.toml vars), `UPSERT_CHUNK_SIZE` (500)

---

## Code Standards

- **Prisma selects**: Only use fields from `workers/tcad-api/prisma/schema.prisma`. `SearchTermAnalytics` has `totalSearches`, NOT `searchCount`
- **No `any`**: Use `unknown` + type guards. Use `getErrorMessage()` from `utils/error-helpers.ts`
- **Workers logging**: Use `console.*` (Workers structured logging). CLI scripts use the console shim in `scripts/lib/logger.ts`
- **Workers env**: Access via `c.env.X` (Hono context), not `process.env.X`
- **Auth**: Workers uses `x-api-key` header checked against `env.API_KEY` (value = Doppler `TCAD_API_KEY`)
- **TCAD API request format**: Body must use `{ pYear: { operator: "=", value }, fullTextSearch: { operator: "match", value } }` with pagination as query params `?page=N&pageSize=N`. Token passed as `Authorization: token` (token already includes "Bearer " prefix from token worker — do NOT add a second "Bearer " prefix). The canonical implementation is `workers/tcad-api/src/workflows/scraper.workflow.ts` (the original `server/src/lib/tcad-api-client.ts` reference lives in git history)
- **D1 dates**: All date fields are epoch-ms strings (`"1711773684000"`) — D1's JS binding auto-converts ISO 8601 TEXT, breaking Prisma. Use `nowEpoch()` for writes, `epochToISO()` for API responses (`utils/epoch-dates.ts`); never store ISO 8601 strings
- **D1 arrays**: `newPropertyIds` is `String` (JSON-serialized). Use `JSON.stringify()` on write, `JSON.parse()` on read
- **No `mode: "insensitive"`**: SQLite LIKE is case-insensitive for ASCII by default; Prisma + SQLite throws on it. `sanitizeWhereClause` (`claude.service.ts`) strips it from AI-generated queries

---

## Debugging

| Problem | Steps |
|---------|-------|
| DB connection failed | Check D1 dashboard; `wrangler d1 execute tcad-db --remote --command "SELECT 1"` |
| TCAD API auth failed | Token expired (5 min); check `wrangler tail` for refresh errors |
| TCAD API 500 / 0 results | Verify request body matches the format in Code Standards (operator format, query string pagination, no double Bearer prefix). TCAD also returns 500 for genuinely empty terms |
| Workflows stuck | `wrangler workflows instances list scraper-workflow --status running` |
| Queue not processing | `wrangler queues list`; check consumer in `wrangler tail` |
| Workers deploy failed | `wrangler deploy --dry-run`; check `npx tsc --noEmit` in `workers/tcad-api/` |
| API 522/unreachable | Check Cloudflare dashboard; `wrangler tail` for errors |
| D1 date corruption | Dates stored as ISO 8601 instead of epoch ms; re-scrape affected records |
| D1 `SQLITE_CONSTRAINT` | Data type mismatch or missing required field in create call |

---

## Access Points

| Environment | URL |
|------------|-----|
| Frontend (local) | http://localhost:5174 |
| Workers API (local) | http://localhost:8787 (`npm run dev` in workers/tcad-api/) |
| Frontend (prod) | https://alephatx.info |
| API (prod) | https://api.alephatx.info/api |
| Health (prod) | https://api.alephatx.info/health |
| Workers logs | `wrangler tail` (workers/tcad-api/) |
| Cloudflare dashboard | https://dash.cloudflare.com |
