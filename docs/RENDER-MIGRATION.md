# Render Migration Plan

**Created**: February 20, 2026
**Status**: Draft
**Goal**: Migrate backend from Hobbes (self-hosted) to Render (cloud-hosted)

---

## Current Architecture (Hobbes)

| Component | Current Setup |
|-----------|--------------|
| API Server | Express on PM2, port 3001 |
| Reverse Proxy | Nginx (port 80 -> 3001) |
| External Access | Cloudflare Tunnel (`api.alephatx.info` -> `localhost:3001`) |
| PostgreSQL | Postgres 15 on Hobbes via Tailscale VPN |
| Redis | Redis 7, 256 MB, `appendonly yes`, `allkeys-lru` |
| Scraper Workers | BullMQ workers in same Express process |
| Secrets | Doppler (`integrity-studio` project) |
| Frontend | GitHub Pages (`alephatx.info`) -- **stays as-is** |

## Target Architecture (Render)

| Component | Render Service | Plan | Monthly Cost |
|-----------|---------------|------|-------------|
| API Server | Web Service (Node.js native) | Starter ($7) or Standard ($25) | $7-25 |
| PostgreSQL | Managed Postgres | Basic-1gb ($19) | $19 |
| Redis | Key Value (Valkey 8) | Starter 256 MB ($10) | $10 |
| Scraper Workers | Background Worker | Starter ($7) | $7 |
| **Total** | | | **$43-61/mo** |

### Plan Justification

- **Web Service Starter ($7)**: 512 MB RAM, 0.5 CPU. Express API with low traffic is well within limits. Upgrade to Standard ($25, 2 GB RAM) if needed.
- **Postgres Basic-1gb ($19)**: 418K properties, ~5 tables, moderate query load. 1 GB RAM, 100 connections. Storage expansion at $0.30/GB if needed.
- **Key Value Starter ($10)**: 256 MB matches current Redis config. Valkey 8 (Redis 7.2.4-compatible). Paid tier includes disk persistence (`appendfsync everysec`).
- **Background Worker Starter ($7)**: Separates scraper workers from API process. Long-running jobs without HTTP timeout constraints.

### Optional: Combined API + Workers

If separating workers isn't needed initially, skip the Background Worker and run BullMQ workers in the Express process (current approach). Saves $7/mo, total $36-54/mo.

---

## Migration Steps

### Phase 0: Pre-Migration Preparation

1. **Database backup**
   ```bash
   # On Hobbes -- dump current database
   doppler run -- pg_dump -Fc --no-acl --no-owner \
     -d "$DATABASE_URL" -f tcad_backup_$(date +%Y%m%d).dump
   ```

2. **Inventory Doppler secrets** -- document all env vars needed on Render
   ```
   DATABASE_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD,
   JWT_SECRET, ANTHROPIC_API_KEY, TCAD_API_KEY,
   SENTRY_DSN, NODE_ENV, PORT, LOG_LEVEL
   ```

3. **Verify `server/` builds cleanly**
   ```bash
   cd server && npm run build && npm test
   ```

### Phase 1: Provision Render Services

1. **Create Render workspace** (Individual plan is fine; Professional needed for autoscaling)

2. **Create PostgreSQL instance**
   - Plan: Basic-1gb
   - Region: Oregon (closest to Texas, lowest latency)
   - PostgreSQL version: 15
   - Database name: `tcad_scraper`
   - Note both the **Internal URL** and **External URL** from the dashboard

3. **Create Key Value (Redis) instance**
   - Plan: Starter (256 MB)
   - Region: Oregon (same as Postgres)
   - Eviction policy: `noeviction` (BullMQ job queue -- prevents data loss)
   - Note the **Internal URL**

4. **Restore database**
   ```bash
   # Use Render's External URL for the restore
   pg_restore --verbose --no-acl --no-owner --jobs=4 \
     -d "RENDER_EXTERNAL_DB_URL" tcad_backup_YYYYMMDD.dump
   ```

5. **Run Prisma migrations** (ensure schema is current)
   ```bash
   DATABASE_URL="RENDER_EXTERNAL_DB_URL" npx prisma migrate deploy
   ```

### Phase 2: Deploy Web Service

1. **Create Web Service** on Render dashboard or via `render.yaml`
   - Runtime: Node
   - Build command: `cd server && npm install && npx prisma generate && npm run build`
   - Start command: `cd server && node dist/index.js`
   - Health check path: `/health`
   - Region: Oregon
   - Plan: Starter
   - Auto-deploy: Yes (linked to `main` branch)
   - Root directory: (repo root, since build command handles `cd server`)

2. **Set environment variables** on the Web Service (or use Environment Group):

   | Variable | Source |
   |----------|--------|
   | `DATABASE_URL` | From Render Postgres Internal URL |
   | `REDIS_HOST` | From Render Key Value internal hostname |
   | `REDIS_PORT` | `6379` |
   | `REDIS_PASSWORD` | From Render Key Value credentials (if auth enabled) |
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` (or `10000` -- Render default) |
   | `JWT_SECRET` | From Doppler |
   | `ANTHROPIC_API_KEY` | From Doppler |
   | `TCAD_API_KEY` | From Doppler |
   | `SENTRY_DSN` | From Doppler |
   | `SENTRY_ENABLED` | `true` |
   | `LOG_FILES_ENABLED` | `false` (no persistent disk) |
   | `TCAD_YEAR` | `2026` |

3. **Pre-deploy command** (runs before each deploy):
   ```
   cd server && npx prisma migrate deploy
   ```

### Phase 3: DNS Cutover

1. **Update Cloudflare DNS** for `api.alephatx.info`:
   - Delete the existing Cloudflare Tunnel CNAME
   - **Remove any AAAA records** (Render does not support IPv6)
   - Add CNAME: `api.alephatx.info` -> `your-service.onrender.com`
   - Cloudflare proxy: **DNS only** (grey cloud) initially for cert verification
   - After Render confirms TLS cert, switch to **Proxied** (orange cloud)
   - Cloudflare SSL/TLS mode: **Full** (not Full Strict, not Flexible)

2. **Update frontend CORS config** if API URL changes (it shouldn't -- same domain)

3. **Update `VITE_API_URL`** in frontend build if needed:
   ```
   VITE_API_URL=https://api.alephatx.info/api
   ```

### Phase 4: Verify Production

```bash
# Health check
curl -s "https://api.alephatx.info/health" | jq

# API smoke test
curl -s "https://api.alephatx.info/api/properties?limit=5" | jq '.data | length'

# Queue dashboard (if exposed)
open "https://api.alephatx.info/admin/queues"
```

### Phase 5: Decommission Hobbes Services

After 1-2 weeks of stable Render operation:

1. Stop PM2 process on Hobbes: `pm2 stop tcad-api && pm2 delete tcad-api`
2. Stop nginx: `sudo systemctl stop nginx`
3. Remove Cloudflare Tunnel for `tcad-api`
4. Keep Hobbes database backup for 30 days minimum

---

## render.yaml Blueprint

```yaml
services:
  # Express API Server
  - type: web
    name: tcad-api
    runtime: node
    region: oregon
    plan: starter
    branch: main
    buildCommand: cd server && npm install && npx prisma generate && npm run build
    startCommand: cd server && node dist/index.js
    preDeployCommand: cd server && npx prisma migrate deploy
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "3001"
      - key: LOG_FILES_ENABLED
        value: "false"
      - key: TCAD_YEAR
        value: "2026"
      - key: DATABASE_URL
        fromDatabase:
          name: tcad-db
          property: connectionString
      - key: REDIS_HOST
        fromService:
          name: tcad-redis
          type: keyvalue
          property: host
      - key: REDIS_PORT
        fromService:
          name: tcad-redis
          type: keyvalue
          property: port
      - fromGroup: tcad-secrets

  # Redis (BullMQ Queue Backend)
  - type: keyvalue
    name: tcad-redis
    plan: starter
    region: oregon
    maxmemoryPolicy: noeviction
    ipAllowList: []

databases:
  - name: tcad-db
    plan: basic-1gb
    region: oregon
    postgresMajorVersion: "15"
    databaseName: tcad_scraper

envVarGroups:
  - name: tcad-secrets
    envVars:
      - key: JWT_SECRET
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: TCAD_API_KEY
        sync: false
      - key: SENTRY_DSN
        sync: false
      - key: SENTRY_ENABLED
        value: "true"
```

---

## Code Changes Required

### 1. Remove `trust proxy` conditional (optional)

Render handles TLS termination natively. The `app.set('trust proxy', 1)` in `server/src/index.ts:50` can stay -- it's harmless and correct if Cloudflare proxies traffic.

### 2. Redis connection string support

Current config in `server/src/config/index.ts` uses `REDIS_HOST` + `REDIS_PORT`. Render's internal Key Value URL is `redis://red-XXXXX:6379`. Two options:

**Option A** (minimal change): Keep `REDIS_HOST` and `REDIS_PORT` env vars. Set them from Render's `fromService` references (already in render.yaml above).

**Option B** (better long-term): Add `REDIS_URL` support to config:
```typescript
// server/src/config/index.ts
redis: {
  url: process.env.REDIS_URL,  // full connection string (takes precedence)
  host: process.env.REDIS_HOST || 'localhost',
  port: parseIntEnv('REDIS_PORT', 6379),
  password: process.env.REDIS_PASSWORD,
},
```

**Recommendation**: Option A for initial migration. No code changes needed.

### 3. Playwright on Render

The scraper uses Playwright for browser-based fallback. On Render's native Node runtime, Playwright's Chromium may not work out of the box (missing system dependencies).

**Options**:
- **Docker deploy**: Use a Dockerfile with Playwright deps pre-installed. Changes `runtime: node` to `runtime: docker` in render.yaml.
- **API-only mode**: If TCAD API token is always available, browser fallback is rarely needed. Set `TCAD_AUTO_REFRESH_TOKEN=true` and rely on API scraping.
- **Separate worker**: Deploy scraper as a Docker-based Background Worker with Playwright deps.

**Recommendation**: Start with API-only mode. Add Docker-based worker later if browser fallback is needed.

### 4. Log file writes

Set `LOG_FILES_ENABLED=false`. Render has no persistent disk by default. All logs go to stdout/stderr and are captured by Render's log viewer.

### 5. Doppler integration

Render doesn't natively integrate with Doppler. Two approaches:

- **Manual sync**: Copy secrets from Doppler to Render's Environment Groups (one-time, update manually)
- **Doppler Render integration**: Doppler has a [Render integration](https://docs.doppler.com/docs/render) that auto-syncs secrets

**Recommendation**: Use Doppler's Render integration for automatic sync.

---

## Prisma + PgBouncer Gotcha

If you add PgBouncer connection pooling later (Render provides a PgBouncer Docker image):

- Prisma Migrate does NOT work through PgBouncer (named prepared statements)
- Use `preDeployCommand` with a **direct** database URL for migrations
- Use the **pooled** URL for `DATABASE_URL` at runtime

For now, with Basic-1gb (100 connections), connection pooling is unnecessary. But set `?connection_limit=10` on `DATABASE_URL` to prevent Prisma from exhausting the pool when combined with BullMQ workers.

---

## BullMQ on Valkey/Render Gotchas

- **Valkey 8 compatibility**: Render Key Value now runs Valkey 8 (Redis 7.2.4 fork). BullMQ should work as a drop-in replacement, but verify in staging first.
- **Stalled jobs**: Playwright scraping blocks the Node.js event loop, causing BullMQ lock renewal to miss deadlines. Jobs get incorrectly marked as stalled. Mitigate with BullMQ sandboxed processors or separate worker processes.
- **Redeploy interrupts active jobs**: Every git push triggers a redeploy. Active scraper jobs will be killed. Configure BullMQ `gracefulShutdown` and job retries (`attempts: 3`) to handle this.
- **No SSH access**: Debugging is logs-only on Render. Ensure structured logging (Pino) captures enough context.

---

## Cost Comparison

| Item | Hobbes (current) | Render |
|------|------------------|--------|
| Server hardware | Sunk cost (owned) | $0 |
| Electricity/internet | ~$20/mo (estimated) | $0 |
| Web Service | PM2 (free) | $7-25/mo |
| PostgreSQL | Self-hosted (free) | $19/mo |
| Redis | Docker (free) | $10/mo |
| Cloudflare Tunnel | Free | N/A |
| Bandwidth | Free (home internet) | 100 GB free, then $0.15/GB |
| Maintenance | Manual (nginx, PM2, updates) | Managed |
| **Total** | ~$20/mo + time | **$36-54/mo** |

### What You Gain

- No Tailscale VPN dependency for database access
- No nginx/PM2/Cloudflare Tunnel management
- Automatic deploys from git push
- Managed backups (daily Postgres snapshots)
- Built-in TLS, health checks, zero-downtime deploys
- Log aggregation in Render dashboard
- Autoscaling available (Professional workspace)

### What You Lose

- Full server access (SSH, arbitrary processes)
- Free compute on owned hardware
- Playwright browser scraping (without Docker migration)
- `results/` volume mount (use S3 or remove if unused)

---

## Rollback Plan

If Render doesn't work out:

1. Re-enable Cloudflare Tunnel on Hobbes
2. Update DNS CNAME back to tunnel
3. Start PM2: `pm2 start tcad-api`
4. Start nginx: `sudo systemctl start nginx`
5. Verify: `curl https://api.alephatx.info/health`

Data is safe -- Hobbes database was only read from during migration (dump), not modified.

---

## Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| 0 | 1 hour | Backup database, inventory secrets |
| 1 | 30 min | Provision Render services, restore data |
| 2 | 1 hour | Deploy web service, configure env vars |
| 3 | 15 min | DNS cutover |
| 4 | 30 min | Verification and smoke testing |
| 5 | 1-2 weeks | Monitor stability, then decommission Hobbes |
| **Total** | ~3 hours + monitoring period | |
