# Cloudflare Workers Migration Plan

_Based on [CLOUDFLARE_D1_FEASIBILITY.md](./CLOUDFLARE_D1_FEASIBILITY.md) — March 2026_

**Strategy**: Hyperdrive + Keep Render PostgreSQL (zero DB changes)

**Status**: Phases 0-4 implemented (code in `workers/tcad-api/`). Phase 5 (production cutover) pending.

---

## Implementation Status (Updated 2026-03-20)

| Phase | Status | Notes |
|-------|--------|-------|
| **0** | Done | wrangler.toml, package.json, Prisma + driverAdapters, Hyperdrive helper |
| **1** | Done | All Express routes ported to Hono (property, api-usage, auth, CORS) |
| **2** | Done | ScraperWorkflow (5 steps), Queue consumer, bulk upsert with xmax |
| **3** | Done | KV bindings, cron handlers (token refresh, cleanup, monitors). KV IDs pending |
| **4** | Done | Sentry withSentry wrapper, console logging |
| **5** | Not started | DNS migration, parallel run, canary |

**Build**: `npx tsc --noEmit` clean, `wrangler deploy --dry-run` succeeds (3.3MB / 1.1MB gzip)

**Deploy prerequisites**:
1. `wrangler hyperdrive create tcad-db --connection-string="$DATABASE_URL"` → paste ID into wrangler.toml
2. `wrangler secret put API_KEY` (+ JWT_SECRET, ANTHROPIC_API_KEY, SENTRY_DSN, TOKEN_WORKER_URL, TOKEN_WORKER_SECRET)
3. `wrangler kv namespace create tcad-token-cache` → uncomment KV bindings, paste IDs
4. `wrangler deploy`
5. Smoke test: `curl https://tcad-api.<subdomain>.workers.dev/health`

---

## Phase Overview

| Phase | Scope | Risk | Prerequisite |
|-------|-------|------|-------------|
| **0** | Project setup (wrangler, Hono, Hyperdrive config) | Low | None |
| **1** | Migrate Express API to Hono on Workers | Medium | Phase 0 |
| **2** | Replace Bull queue with Cloudflare Workflows | High | Phase 1 |
| **3** | Replace Redis cache with KV + Cron Triggers | Low | Phase 1 |
| **4** | Observability (Sentry CF SDK, Analytics Engine) | Low | Phase 1 |
| **5** | Cut over production | Medium | All phases |

Each phase is independently deployable and testable. Render API stays live until Phase 5.

---

## Phase 0: Project Setup

**Goal**: Scaffold the Workers project, configure Hyperdrive, verify DB connectivity.

### 0.1 Create Workers project structure

```
workers/
  tcad-api/                  # New: main API worker
    src/
      index.ts               # Hono app entry
      bindings.d.ts          # Worker env type definitions
    wrangler.toml
    package.json
    tsconfig.json
  tcad-token/                # Existing: token refresh worker
```

### 0.2 `wrangler.toml` (initial)

```toml
name = "tcad-api"
main = "src/index.ts"
compatibility_date = "2026-03-01"
compatibility_flags = ["nodejs_compat"]

[observability]
enabled = true

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive-config-id>"

# Added in Phase 2
# [[workflows]]
# binding = "SCRAPER_WORKFLOW"
# name = "scraper-workflow"
# class_name = "ScraperWorkflow"

# Added in Phase 3
# [[kv_namespaces]]
# binding = "TOKEN_CACHE"
# id = "<kv-namespace-id>"
```

### 0.3 Configure Hyperdrive

```bash
# Create Hyperdrive config pointing to Render PostgreSQL
wrangler hyperdrive create tcad-db \
  --connection-string="$DATABASE_URL"

# Verify
wrangler hyperdrive get tcad-db
```

### 0.4 Verify Prisma + Hyperdrive connectivity

```typescript
// workers/tcad-api/src/db.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export function createPrisma(hyperdrive: Hyperdrive) {
  const adapter = new PrismaPg({
    connectionString: hyperdrive.connectionString,
  });
  return new PrismaClient({ adapter });
}
```

Smoke test: deploy minimal worker that runs `prisma.property.count()` and returns the result.

### 0.5 Dependencies

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@prisma/client": "^6.x",
    "@prisma/adapter-pg": "^6.x",
    "pg": "^8.x",
    "jose": "^5.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "wrangler": "^3.x",
    "@cloudflare/workers-types": "^4.x",
    "typescript": "^5.x"
  }
}
```

### 0.6 Acceptance criteria

- [ ] `wrangler dev` starts locally
- [ ] `GET /health` returns `{ status: "ok", propertyCount: N }` via Hyperdrive
- [ ] Prisma `$queryRaw` works (test the raw upsert SQL)
- [ ] Deployed to `tcad-api.<subdomain>.workers.dev`

---

## Phase 1: Migrate Express API to Hono

**Goal**: Port all Express routes, middleware, and controllers to Hono on Workers.

### 1.1 File mapping

| Express (current) | Hono (target) | Notes |
|-------------------|---------------|-------|
| `server/src/index.ts` (607 lines) | `workers/tcad-api/src/index.ts` | Hono app + middleware |
| `server/src/routes/property.routes.ts` | `workers/tcad-api/src/routes/property.ts` | |
| `server/src/routes/api-usage.routes.ts` | `workers/tcad-api/src/routes/api-usage.ts` | |
| `server/src/routes/app.routes.ts` | `workers/tcad-api/src/routes/app.ts` | SPA catch-all |
| `server/src/controllers/property.controller.ts` | `workers/tcad-api/src/controllers/property.ts` | Prisma via `c.env` |
| `server/src/controllers/api-usage.controller.ts` | `workers/tcad-api/src/controllers/api-usage.ts` | |
| `server/src/middleware/auth.ts` | `workers/tcad-api/src/middleware/auth.ts` | `jose` for JWT |
| `server/src/middleware/error.middleware.ts` | Hono `app.onError()` handler | |
| `server/src/middleware/validation.middleware.ts` | Hono + Zod middleware | |
| `server/src/lib/tcad-api-client.ts` | `workers/tcad-api/src/lib/tcad-api-client.ts` | Pure fetch — copy as-is |
| `server/src/lib/tcad-scraper.ts` | `workers/tcad-api/src/lib/tcad-scraper.ts` | Copy as-is |
| `server/src/lib/claude.service.ts` | `workers/tcad-api/src/lib/claude.service.ts` | Copy, fix env access |
| `server/src/utils/` | `workers/tcad-api/src/utils/` | Copy as-is |
| `server/src/middleware/metrics.middleware.ts` | **Remove** (Phase 4) | prom-client incompatible |
| `server/src/middleware/xcontroller.middleware.ts` | **Remove** | CSP nonces not needed for API |

### 1.2 Hono app skeleton

```typescript
// workers/tcad-api/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createPrisma } from "./db";
import { propertyRoutes } from "./routes/property";
import { apiUsageRoutes } from "./routes/api-usage";
import type { Env } from "./bindings";

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use("*", cors({ origin: ["https://alephatx.info"] }));
app.use("*", secureHeaders());

// Prisma per-request (Workers are stateless)
app.use("*", async (c, next) => {
  c.set("prisma", createPrisma(c.env.HYPERDRIVE));
  await next();
});

// Health
app.get("/health", async (c) => {
  const prisma = c.get("prisma");
  const count = await prisma.property.count();
  return c.json({ status: "ok", propertyCount: count });
});

// Routes
app.route("/api/properties", propertyRoutes);
app.route("/api/usage", apiUsageRoutes);

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
```

### 1.3 Bindings type definition

```typescript
// workers/tcad-api/src/bindings.d.ts
export interface Env {
  HYPERDRIVE: Hyperdrive;
  TOKEN_CACHE: KVNamespace;       // Phase 3
  SCRAPER_WORKFLOW: Workflow;      // Phase 2
  SCRAPER_QUEUE: Queue;           // Phase 2
  API_KEY: string;
  ANTHROPIC_API_KEY: string;
  SENTRY_DSN: string;
  WORKER_SECRET: string;
  FRONTEND_URL: string;
  TCAD_YEAR: string;
}
```

### 1.4 Key migration patterns

**Express `req`/`res` → Hono `c` context**:
```typescript
// Express
app.get("/api/properties", async (req, res) => {
  const { search } = req.query;
  res.json({ data });
});

// Hono
app.get("/api/properties", async (c) => {
  const search = c.req.query("search");
  return c.json({ data });
});
```

**Environment variables**: `process.env.X` → `c.env.X`

**Auth middleware**: Replace `jsonwebtoken` with `jose` (Workers-compatible):
```typescript
import { jwtVerify } from "jose";
// jose works identically but is not Node-specific
```

**Rate limiting**: Use `hono/rate-limit` or Cloudflare Rate Limiting rules (no in-process state).

### 1.5 What to skip in Phase 1

- Bull Board UI (`/admin/queues`) — no equivalent; skip entirely
- Prometheus metrics (`/metrics`) — Phase 4
- Swagger UI (`/api-docs`) — can be served from R2 or static, low priority
- `node-cron` scheduled tasks — Phase 3
- Scrape job processing — Phase 2

### 1.6 Testing strategy

- Port existing Vitest tests to run against the Hono app
- `wrangler dev --remote` for integration tests against real Hyperdrive → Render DB
- Parallel deploy: `tcad-api.workers.dev` runs alongside `api.alephatx.info` (Render)
- Compare responses for identical requests

### 1.7 Acceptance criteria

- [ ] All `GET /api/properties/*` routes return identical responses to Render API
- [ ] All `GET /api/usage/*` routes return identical responses
- [ ] `GET /health` works
- [ ] Auth middleware (API key + optional JWT) works
- [ ] CORS configured for `alephatx.info`
- [ ] Error responses match existing format
- [ ] Rate limiting functional
- [ ] Response times within 2x of Render (Hyperdrive caching should improve reads)

---

## Phase 2: Replace Bull Queue with Cloudflare Workflows

**Goal**: Move scrape job processing from Bull + Redis to Cloudflare Workflows.

This is the highest-risk phase. The current Bull queue processor (`scraper.queue.ts`, 356 lines) handles job lifecycle, retry logic, error classification, and DB upserts.

### 2.1 Why Workflows (not Queues alone)

- Scrape jobs run 10-60s (TCAD API pagination + rate limiting)
- Workers have 30s CPU limit; Workflows have unlimited wall time per step
- Workflows provide automatic retry, state persistence, and step-level observability
- Queues are still used as the trigger mechanism (enqueue → Workflow starts)

### 2.2 Architecture

```
API Worker (Hono)
  POST /api/properties/scrape
    → Queue.send({ searchTerm, year })

Queue Consumer (same Worker)
  → workflow.create({ searchTerm, year })

ScraperWorkflow (Workflow class)
  Step 1: waitForToken()     → KV read
  Step 2: fetchProperties()  → TCAD API calls (paginated)
  Step 3: deduplicateAndTransform()
  Step 4: upsertToDatabase() → Hyperdrive → PostgreSQL
  Step 5: updateAnalytics()  → search_term_analytics
  Step 6: invalidateCache()  → KV deletes
```

### 2.3 Workflow implementation

```typescript
// workers/tcad-api/src/workflows/scraper.workflow.ts
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import type { Env } from "../bindings";

interface ScrapeParams {
  searchTerm: string;
  year: number;
  jobId?: string;
}

export class ScraperWorkflow extends WorkflowEntrypoint<Env, ScrapeParams> {
  async run(event: WorkflowEvent<ScrapeParams>, step: WorkflowStep) {
    const { searchTerm, year } = event.payload;

    // Step 1: Get auth token
    const token = await step.do("get-token", async () => {
      const cached = await this.env.TOKEN_CACHE.get("tcad-token");
      if (cached) return cached;
      // Fetch fresh token from tcad-token worker
      const res = await fetch(this.env.TOKEN_WORKER_URL, {
        headers: { Authorization: `Bearer ${this.env.WORKER_SECRET}` },
      });
      const { token, expiresIn } = await res.json();
      await this.env.TOKEN_CACHE.put("tcad-token", token, { expirationTtl: expiresIn - 30 });
      return token;
    });

    // Step 2: Fetch properties from TCAD API
    const rawProperties = await step.do("fetch-properties", async () => {
      return fetchTCADProperties(token, searchTerm, year);
    });

    // Step 3: Deduplicate
    const properties = await step.do("deduplicate", async () => {
      return deduplicateByPropertyId(rawProperties);
    });

    // Step 4: Upsert to database (chunked)
    const upsertResult = await step.do("upsert-properties", async () => {
      const prisma = createPrisma(this.env.HYPERDRIVE);
      // Existing bulk upsert logic — unchanged, since PostgreSQL via Hyperdrive
      return bulkUpsertProperties(prisma, properties, year);
    });

    // Step 5: Update analytics
    await step.do("update-analytics", async () => {
      const prisma = createPrisma(this.env.HYPERDRIVE);
      return updateSearchTermAnalytics(prisma, searchTerm, {
        resultCount: rawProperties.length,
        savedCount: upsertResult.savedCount,
        updatedCount: upsertResult.updatedCount,
      });
    });

    return upsertResult;
  }
}
```

### 2.4 Queue consumer

```typescript
// In wrangler.toml
[[queues.consumers]]
queue = "tcad-scraper-jobs"
max_batch_size = 1
max_retries = 3
dead_letter_queue = "tcad-scraper-dlq"

// In worker
export default {
  async queue(batch: MessageBatch<ScrapeParams>, env: Env) {
    for (const msg of batch.messages) {
      const instance = await env.SCRAPER_WORKFLOW.create({
        params: msg.body,
      });
      msg.ack();
    }
  },
};
```

### 2.5 Migration path for `scripts/`

Scripts like `continuous-batch-scraper.ts`, `enqueue-batch.ts`, `enqueue-tail-terms.ts` currently enqueue jobs via Bull. These need to either:

- **Option A**: Call the Workers API endpoint `POST /api/properties/scrape` (HTTP)
- **Option B**: Use `wrangler queues send` CLI to enqueue directly
- **Option C**: Keep scripts running on local/Render and enqueue via REST API

**Recommendation**: Option A — scripts call the deployed API. No Bull dependency needed.

### 2.6 What we lose

| Bull Feature | Cloudflare Alternative | Status |
|-------------|----------------------|--------|
| Bull Board UI | None | **Lost** — use `wrangler workflows list` CLI |
| Priority queues | Not available | **Lost** — process in FIFO order |
| Job delay/scheduling | `delaySeconds` (max 24h) | Partial |
| Job progress events | Workflow step completion | Different API |
| Failed job inspection | DLQ + `wrangler workflows show` | Different API |
| Retry with backoff | Workflow auto-retry per step | Equivalent |
| Concurrency control | Queue `max_batch_size` + account limits | Different model |

### 2.7 Acceptance criteria

- [ ] `POST /api/properties/scrape` enqueues a Workflow
- [ ] Workflow fetches from TCAD API, upserts via Hyperdrive
- [ ] `savedCount` / `updatedCount` / `newPropertyIds` tracking works
- [ ] Failed jobs land in DLQ
- [ ] Token refresh integrates with KV (Phase 3 overlap)
- [ ] Batch scripts can enqueue via API
- [ ] Scrape throughput within 80% of current Bull implementation

---

## Phase 3: Replace Redis with KV + Cron Triggers

**Goal**: Eliminate Redis dependency. Move cache and scheduled tasks to Cloudflare-native services.

### 3.1 KV namespaces

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "TOKEN_CACHE"
id = "<id>"

[[kv_namespaces]]
binding = "RESPONSE_CACHE"
id = "<id>"
```

### 3.2 Token storage migration

| Current (Redis) | Target (KV) |
|-----------------|------------|
| `SET tcad:token <jwt> EX 270` | `TOKEN_CACHE.put("tcad-token", jwt, { expirationTtl: 270 })` |
| `GET tcad:token` | `TOKEN_CACHE.get("tcad-token")` |

KV is eventually consistent (~60s), but token reads are not latency-critical — a stale token triggers a refresh on 401.

### 3.3 Response cache migration

Current Redis cache pattern:
```typescript
// Set: redis.setex(`properties:list:${key}`, 300, JSON.stringify(data))
// Get: redis.get(`properties:list:${key}`)
// Invalidate: redis.keys("properties:list:*").then(keys => redis.del(...keys))
```

KV equivalent:
```typescript
// Set
await env.RESPONSE_CACHE.put(`properties:list:${key}`, JSON.stringify(data), { expirationTtl: 300 });

// Get
const cached = await env.RESPONSE_CACHE.get(`properties:list:${key}`, "json");

// Invalidate (no KEYS glob — must list by prefix)
const { keys } = await env.RESPONSE_CACHE.list({ prefix: "properties:list:" });
await Promise.all(keys.map(k => env.RESPONSE_CACHE.delete(k.name)));
```

### 3.4 Cron Triggers

| Current | Schedule | Cron Trigger |
|---------|----------|-------------|
| Token refresh (setInterval 4min) | Every 4 min | `*/4 * * * *` |
| Stale job cleanup (node-cron) | Hourly | `0 * * * *` |
| Search term optimization | Daily | `0 3 * * *` |
| Monitored search execution | Configurable | `0 */6 * * *` |

```toml
# wrangler.toml
[triggers]
crons = [
  "*/4 * * * *",   # token refresh
  "0 * * * *",     # stale job cleanup
  "0 3 * * *",     # search term optimization
  "0 */6 * * *",   # monitored searches
]
```

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    switch (event.cron) {
      case "*/4 * * * *":
        return refreshToken(env);
      case "0 * * * *":
        return cleanupStaleJobs(env);
      case "0 3 * * *":
        return optimizeSearchTerms(env);
      case "0 */6 * * *":
        return runMonitoredSearches(env);
    }
  },
};
```

### 3.5 Acceptance criteria

- [ ] Token stored/retrieved from KV
- [ ] Response cache uses KV with prefix-based invalidation
- [ ] All 4 cron jobs fire on schedule
- [ ] No Redis dependency remains

---

## Phase 4: Observability

**Goal**: Replace Node.js-specific observability with Workers-compatible equivalents.

### 4.1 Sentry

```bash
npm install @sentry/cloudflare
```

```typescript
import { withSentry } from "@sentry/cloudflare";

export default withSentry(
  (env) => ({ dsn: env.SENTRY_DSN, tracesSampleRate: 0.1 }),
  { fetch: app.fetch }
);
```

### 4.2 Logging

Replace Pino with `console.*` (Workers logs are structured by default) or use Workers Logpush for external aggregation.

### 4.3 Metrics

| Current (Prometheus) | Workers Alternative |
|---------------------|-------------------|
| `http_requests_total` | Workers Analytics Engine or Logpush |
| `scrape_job_duration` | Workflow step timings (built-in) |
| `db_query_duration` | Hyperdrive metrics (dashboard) |
| Custom counters | Analytics Engine `writeDataPoint()` |

**Recommendation**: Start with Workers built-in analytics (free). Add Analytics Engine if custom metrics are needed.

### 4.4 Acceptance criteria

- [ ] Sentry captures errors from Workers
- [ ] Logs visible in `wrangler tail`
- [ ] Basic request metrics in Cloudflare dashboard

---

## Phase 5: Production Cutover

**Goal**: Switch production traffic from Render to Cloudflare Workers.

### 5.1 DNS migration

```
api.alephatx.info → Render web service     (current)
api.alephatx.info → Workers custom domain  (target)
```

Using Cloudflare custom domains (not DNS CNAME):
```toml
# wrangler.toml
routes = [
  { pattern = "api.alephatx.info/*", zone_name = "alephatx.info" }
]
```

### 5.2 Cutover sequence

1. **Parallel run** (1 week): Both Render and Workers serve traffic. Workers on `api-cf.alephatx.info`.
   - Compare response bodies for identical requests
   - Monitor error rates, latencies, DB connection counts
2. **Canary** (3 days): Route 10% of traffic to Workers via Cloudflare load balancing rules
3. **Full cutover**: Switch `api.alephatx.info` to Workers custom domain
4. **Render teardown** (after 1 week stable):
   - Stop Render web service
   - Keep Render PostgreSQL (Hyperdrive still connects to it)
   - Keep Render Redis running until Phase 3 is confirmed stable, then terminate

### 5.3 Rollback plan

DNS switch back to Render takes <5 minutes (Cloudflare DNS, low TTL). Render service stays warm during canary period.

### 5.4 Acceptance criteria

- [ ] `api.alephatx.info` serves from Workers
- [ ] Response times equal or better than Render
- [ ] Zero-downtime cutover
- [ ] Render web service stopped (DB still running)
- [ ] Scripts work against new API

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Hyperdrive connection pooling insufficient for bulk upserts | Low | High | Test with real 500-row upserts; Hyperdrive supports up to ~100 connections |
| Prisma `$queryRawUnsafe` incompatible with `@prisma/adapter-pg` | Medium | High | Test in Phase 0 before committing; fallback to `pg` directly |
| Workers CPU limit hit on large scrape jobs | Low | Medium | Workflows have 5min CPU per step; split upsert into sub-steps |
| KV eventual consistency causes stale token reads | Low | Low | 401 triggers immediate refresh; KV ~60s propagation is within token TTL |
| Loss of Bull Board reduces operational visibility | High | Medium | Build minimal status page or use `wrangler` CLI; accept reduced visibility |
| Cloudflare Workflows pricing at scale | Low | Medium | ~500 workflow runs/day × 6 steps = 3K steps/day ≈ $0.09/day |

---

## Cost Comparison

### Current (Render)

| Service | Monthly Cost |
|---------|-------------|
| Web service (Starter) | $7 |
| PostgreSQL (Starter) | $7 |
| Redis (Starter) | $7 |
| **Total** | **~$21/mo** |

### Target (Cloudflare Workers + Render DB)

| Service | Monthly Cost |
|---------|-------------|
| Workers Paid plan | $5 |
| Hyperdrive | Included |
| Queues (~500K ops/mo) | ~$0.20 |
| KV (~1M reads, ~50K writes) | ~$0.75 |
| Workflows (~15K runs/mo) | ~$0.10 |
| Render PostgreSQL (keep) | $7 |
| **Total** | **~$13/mo** |

Savings: ~$8/mo (eliminate Render web service + Redis).

---

## Timeline Estimate

| Phase | Duration | Dependency |
|-------|----------|-----------|
| Phase 0 | 1-2 days | None |
| Phase 1 | 3-5 days | Phase 0 |
| Phase 2 | 3-5 days | Phase 1 |
| Phase 3 | 1-2 days | Phase 1 |
| Phase 4 | 1 day | Phase 1 |
| Phase 5 | 1 week (parallel run) | All |
| **Total** | **~2-3 weeks** | |

---

## Files Created/Modified Summary

### New files (Workers project)

```
workers/tcad-api/
  wrangler.toml
  package.json
  tsconfig.json
  src/
    index.ts              # Hono app
    bindings.d.ts         # Env types
    db.ts                 # Prisma + Hyperdrive
    routes/
      property.ts
      api-usage.ts
    controllers/
      property.ts
      api-usage.ts
    middleware/
      auth.ts
    lib/
      tcad-api-client.ts  # Copied from server/
      tcad-scraper.ts     # Copied from server/
      claude.service.ts   # Adapted
    workflows/
      scraper.workflow.ts
    utils/
      error-helpers.ts    # Copied from server/
      property-transformers.ts
```

### Modified files

| File | Change |
|------|--------|
| `scripts/enqueue-batch.ts` | HTTP POST to Workers API instead of Bull |
| `scripts/continuous-batch-scraper.ts` | HTTP POST to Workers API instead of Bull |
| `scripts/enqueue-tail-terms.ts` | HTTP POST to Workers API instead of Bull |
| `scripts/lib/queue-utils.ts` | Workers API client replacing Bull client |

### Deleted (after Phase 5)

- `server/src/index.ts` (Express app — replaced by Hono)
- `server/src/queues/` (Bull queue — replaced by Workflows)
- `server/src/services/token-refresh.service.ts` (replaced by KV + Cron)
- `server/src/middleware/metrics.middleware.ts` (Prometheus — removed)

### Kept unchanged

- `server/prisma/schema.prisma` — no changes
- `server/prisma/migrations/` — no changes
- `server/src/lib/tcad-api-client.ts` — portable as-is
- `server/src/utils/` — portable as-is
