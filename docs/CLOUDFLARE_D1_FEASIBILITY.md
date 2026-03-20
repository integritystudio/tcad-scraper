# Feasibility Study: Cloudflare Storage Options for TCAD Scraper

_Reviewed against official Cloudflare D1, Hyperdrive, Durable Objects, Workers, Queues, KV, and Workflows docs (March 2026)._

---

## What is Cloudflare D1?

- SQLite-based (~3.41.0); runs inside Cloudflare Workers via a D1 binding (no TCP connection)
- Prisma adapter: `@prisma/adapter-d1` — **Preview/Early Access**, `prisma migrate deploy` not yet supported
- Max DB size: 10 GB (paid) / 500 MB (free); query timeout: 30s; 100-column-per-table limit
- **100 bound parameters per query** — hard limit enforced at the D1 API level
- `ON CONFLICT DO UPDATE` and `RETURNING` both supported (SQLite 3.35+)
- No stored procedures, no extensions, no `pg_*` system columns

---

## Hard Blockers

### 1. Bound Parameter Limit (100) — Performance Blocker

**File**: `server/src/queues/scraper.queue.ts:123-193`

Current batch upsert uses `CHUNK_SIZE = 500` properties × 14 parameters each = **7,000 parameters per query**.

D1 enforces a hard **100 bound parameters per query** limit. With 14 params per property row, maximum chunk size becomes **7 properties per query** (7 × 14 = 98). That is a **70× reduction in batch throughput** vs. the current implementation. A 5,000-property scrape job currently uses ~10 SQL statements; on D1 it would require ~714 statements.

This is the single most impactful technical change and would require a fundamental redesign of the bulk upsert strategy.

### 2. `xmax` System Column — Insert/Update Detection

**File**: `server/src/queues/scraper.queue.ts:187`
```sql
RETURNING property_id, (xmax = 0) AS inserted
```
`xmax` is a PostgreSQL-internal system column — no equivalent in SQLite/D1. `RETURNING` itself works on D1, but `xmax = 0` does not.

The per-job new/updated tracking (`savedCount`, `totalUpdated`, `newPropertyIds`) would need a rewrite. Options:
- `SELECT property_id FROM properties WHERE (property_id, year) IN (...)` before each upsert, then diff
- Always treat as insert and accept overcounting (lose accuracy)

### 3. `TEXT[]` Array Column

**Files**: `server/prisma/schema.prisma:52`, `migrations/20260318.../migration.sql:4`
```prisma
newPropertyIds  String[]  @map("new_property_ids")
```
SQLite has no array type. Must migrate to a JSON TEXT column. D1 has full JSON1 extension support (`json_array()`, `json_extract()`, etc.). Application code must `JSON.stringify`/`JSON.parse`. Prisma must change the field to `String @db.Text`.

### 4. `prisma migrate deploy` Not Supported on D1

Prisma's D1 adapter does not support `prisma migrate deploy` or `prisma migrate dev`. Schema changes must go through `prisma db push` (early access) or manual SQL via `wrangler d1 execute`. The current migration workflow (`server/prisma/migrations/`) would need to change entirely.

### 5. `mode: "insensitive"` in Prisma Queries

**Files**: `server/src/lib/claude.service.ts`, `server/src/controllers/property.controller.ts`

Prisma's `mode: "insensitive"` maps to `ILIKE` in PostgreSQL. Throws an error with the D1 adapter. SQLite's `LIKE` is case-insensitive for ASCII but not Unicode — property name searches with accented characters may break silently.

### 6. `uuid-ossp` Extension

**File**: `server/prisma/migrations/20251117170058.../migration.sql`
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
ALTER TABLE ... ALTER COLUMN id SET DEFAULT uuid_generate_v4();
```
PostgreSQL extensions are not available in SQLite. Migration SQL must be rewritten; UUID generation moves fully to application layer (Prisma's `@default(uuid())` handles this for ORM-generated rows, but the raw migration SQL is incompatible).

### 7. `::bigint` PostgreSQL Cast Syntax

**File**: `server/src/controllers/api-usage.controller.ts:81,83`
```sql
COUNT(*)::bigint as count
```
Must change to `CAST(COUNT(*) AS INTEGER)` or just `COUNT(*)`.

---

## Platform-Level Incompatibilities

These affect any full backend migration to Cloudflare Workers. Noted here because D1 is a Workers-native product (no TCP connection mode exists).

| Component | Current | Cloudflare Option | Gap |
|-----------|---------|------------------|-----|
| **Bull queue + Redis** | `bull` npm, TCP ioredis, Bull Board UI | Cloudflare Queues | No per-job UI, no priority queues, no job inspection. Bull Board has no equivalent. |
| **Redis cache** | `redis` npm, TCP, `KEYS pattern` scan | Cloudflare KV | KV has list-by-prefix only — no glob key scan. `deletePattern()` must be rewritten with `namespace.list({ prefix })` + individual deletes. |
| **`node-cron` + `setInterval`** | 4 cron tasks, hourly cleanup, 4-min token refresh | Cloudflare Cron Triggers | One Worker per cron trigger; stateless between invocations. |
| **Token auto-refresh** | In-process `setInterval`, in-memory state | Cloudflare KV + Cron Trigger Worker | State must move to KV; refresh becomes a separate scheduled Worker. |
| **Express framework** | Express + middleware stack | Hono or native `fetch` handler | Full framework swap required. |
| **Scrape jobs (10-60s)** | Bull workers in-process | Cloudflare Workflows (GA) | Workflows support: per-step CPU 5 min, per-step wall time unlimited, auto-retry. Viable but requires rewriting the queue processor as a multi-step Workflow. |
| **`code-complexity.service.ts`** | `node:fs`, `glob`, local filesystem | Remove | No filesystem in Workers. |
| **Prometheus `prom-client`** | In-process metrics registry | Workers Analytics Engine or remove | Different API entirely. |

**Workers CPU time limit (paid plan)**: 5 minutes per invocation. Scrape jobs are mostly I/O-bound (TCAD API wait), so actual CPU use is lower than wall time. However, for large search terms returning thousands of properties, the D1 upsert loop (now ~714 statements at 7 rows each) could hit CPU limits.

---

## Schema Changes Needed

| Change | File | Effort |
|--------|------|--------|
| `provider = "postgresql"` → `"sqlite"` | `schema.prisma:6` | Trivial |
| `String[]` → `String @db.Text` (JSON) | `schema.prisma:52` | Low + app code change |
| Remove `sort: Desc` from `@@index` | `schema.prisma:40` | Trivial |
| Remove `uuid-ossp` migration SQL | `migrations/20251117.../migration.sql` | Low (rewrite migration) |
| Rewrite `xmax` upsert logic | `scraper.queue.ts:187` | Medium |
| Rewrite bulk upsert for 100-param limit | `scraper.queue.ts:123-193` | **High** — core throughput change |
| Rewrite `::bigint` casts | `api-usage.controller.ts:81,83` | Low |
| Rewrite `mode: "insensitive"` queries | `claude.service.ts`, `property.controller.ts` | Medium (pervasive) |
| Fix `information_schema` test queries | `src/__tests__/auth-database.*` | Low |
| Change schema migration tooling | All of `prisma/migrations/` | High (operational process change) |

---

## Data Migration

- **Size**: 500K properties × ~2-5 KB/row ≈ 1-2.5 GB — within the 10 GB limit but leaves limited growth headroom.
- **Column count**: `properties` table has 14 columns — well within D1's 100-column limit.
- **Process**: Export PostgreSQL → convert SQL syntax → chunk into ≤250-row INSERT files → `wrangler d1 execute --file` with parallel imports. Verified working for 3M+ rows in community reports.
- **No transactional bulk import**: partial failures require restart logic; no rollback.
- **D1 query timeout (30s)** applies per statement batch during import.
- **Prisma migration history**: the `_prisma_migrations` table must be recreated manually or seeded to match D1 state.

---

## What Transfers Easily

| Component | Portability | Notes |
|-----------|------------|-------|
| `TCADScraper` / `tcad-api-client.ts` | High | Pure `fetch` — works in Workers |
| `claude.service.ts` | High | HTTP calls to Anthropic API |
| `search-term-optimizer.ts` | High | Pure Prisma queries (once schema fixed) |
| Controller business logic | Medium | Needs Express → Hono/Workers framework swap |
| Auth/JWT logic | Medium | Portable; framework swap needed |
| Sentry integration | Medium | Cloudflare Workers Sentry SDK exists |
| Config structure | Medium | `process.env` → Workers `env` bindings |

---

## Verdict

**D1 migration is technically feasible but carries significant cost and risk.**

The two showstoppers from a pure DB migration perspective:
1. **100-parameter limit** breaks the current bulk upsert pattern at 70× reduced throughput — requires architectural redesign of the core write path.
2. **`prisma migrate deploy` not supported** — production schema management changes completely; `prisma db push` is experimental.

The `xmax` insert/update tracking, `TEXT[]` → JSON, and `mode: "insensitive"` rewrites are Medium effort but solvable.

A full platform move to Workers + D1 + Queues + KV adds significant additional scope (framework swap, no Bull Board, cron restructure, Workflows for long jobs).

**Alternatives worth considering before committing to D1**:

| Option | Migration Effort | Key Benefit |
|--------|----------------|------------|
| **Neon** (PostgreSQL, serverless) | Near zero — same Prisma schema | Connection pooling for serverless; still PostgreSQL |
| **Turso** (libSQL/SQLite-compatible) | Low — SQLite-compatible but TCP connection | Prisma adapter available; no 100-param limit |
| **Keep Render PostgreSQL** | None | Data loss was `prisma migrate dev` in prod scripts (now fixed), not a Render platform problem |

---

## Files Requiring Changes (DB Migration Scope Only)

| File | Changes |
|------|---------|
| `server/prisma/schema.prisma` | Provider, array column, index sort direction |
| `server/src/queues/scraper.queue.ts` | 100-param upsert rewrite, xmax removal |
| `server/src/controllers/api-usage.controller.ts` | `::bigint` cast |
| `server/src/lib/claude.service.ts` | `mode: "insensitive"` |
| `server/src/controllers/property.controller.ts` | `mode: "insensitive"` |
| `server/prisma/migrations/` | All migrations need SQLite-compatible rewrites |
| `server/src/__tests__/auth-database.*` | `information_schema` → `sqlite_master` |

---
---

# Alternative Cloudflare Storage Options

The following sections evaluate every Cloudflare data product against the TCAD Scraper's requirements: 500K+ property rows, bulk upserts of 500 rows/batch, Prisma ORM, relational queries, and long-running scrape jobs.

---

## Option 1: Hyperdrive (Keep PostgreSQL, Add Cloudflare Acceleration)

**What it is**: A connection pooler and query cache that sits between Cloudflare Workers and an _external_ PostgreSQL (or MySQL) database. It does not replace your database — it accelerates access to it.

### How It Would Work

```
Cloudflare Worker (Hono) → Hyperdrive → Render PostgreSQL
```

Hyperdrive manages a regional connection pool near your Render database, eliminating per-request TCP/TLS handshake cost. Cacheable `SELECT` queries are served from Hyperdrive's edge cache (default TTL: 60s, configurable).

### Prisma Compatibility

Officially supported via `@prisma/adapter-pg`:

```typescript
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: env.HYPERDRIVE.connectionString });
const prisma = new PrismaClient({ adapter });
```

**Uses the standard PostgreSQL Prisma provider** — no schema changes, no migration tooling changes, `prisma migrate deploy` works normally.

### Limits (Paid Plan)

| Feature | Limit |
|---------|-------|
| Configurations per account | 25 |
| Max connections per config | ~100 |
| Query timeout | 60 seconds |
| Cached response size | 50 MB |
| Pricing | Unlimited queries (included in Workers Paid) |

### Impact on TCAD Scraper

| Component | Change Required |
|-----------|----------------|
| Prisma schema | **None** — stays `provider = "postgresql"` |
| Bulk upserts (500 rows) | **None** — passes through to PostgreSQL |
| `xmax` insert/update detection | **None** — still PostgreSQL |
| `TEXT[]` array columns | **None** |
| `mode: "insensitive"` | **None** — still `ILIKE` |
| `prisma migrate deploy` | **None** |
| `::bigint` casts | **None** |
| Express framework | **Must rewrite** to Workers-compatible (Hono or native fetch) |
| BullMQ + Redis | **Must replace** with Cloudflare Queues or Workflows |
| Bull Board UI | **Lost** — no Cloudflare equivalent |
| `node-cron` / `setInterval` | **Must replace** with Cron Triggers |
| Token refresh | **Must move** to KV + Cron Trigger |

### Verdict

**Best option if the goal is "move the API to Workers while keeping the database stable."** Zero database migration risk. The only work is the framework swap (Express → Hono) and queue replacement (BullMQ → Cloudflare Queues/Workflows). But the database itself — the hardest part — requires zero changes.

---

## Option 2: Durable Objects with SQLite Storage

**What it is**: Stateful, single-threaded JavaScript objects with embedded SQLite (10 GB per object, GA since April 2025). Each DO has its own SQLite database accessed via `ctx.storage.sql`.

### Why It Doesn't Fit

| Issue | Detail |
|-------|--------|
| **Same 100-param limit as D1** | Durable Objects SQL has identical limit: 100 bound parameters per query |
| **Single-threaded per object** | 1,000 req/s soft limit per object; all 500K properties in one DO would bottleneck |
| **Sharding required** | Would need to partition properties across many DOs (by year? by property_id range?) — adds routing complexity |
| **No Prisma adapter** | Must use raw `ctx.storage.sql.exec()` — lose all Prisma type safety and migration tooling |
| **No external access** | Only reachable from Workers (no `psql`, no migration CLI) |
| **Same SQLite limitations as D1** | No `ILIKE`, no `TEXT[]`, no `xmax`, no PG extensions |

### When DOs Make Sense

- Real-time collaboration (WebSocket state per user/room)
- Rate limiting / counters (one DO per API key)
- Session storage

### Verdict

**Not suitable for a relational property database.** DOs are designed for fine-grained, per-entity state — not for querying 500K rows with relational patterns. All D1 blockers apply, plus you lose Prisma and gain sharding complexity.

---

## Option 3: Workers KV

**What it is**: Global key-value store optimized for read-heavy, eventually consistent workloads.

### Why It Doesn't Fit

| Issue | Detail |
|-------|--------|
| **No relational queries** | Key-value only — no `WHERE`, no `JOIN`, no `ORDER BY` |
| **Eventually consistent** | Writes propagate globally in ~60s; reads may return stale data |
| **1 write/sec per key** | Hard limit — bulk upserts of 500 properties would need 500 sequential writes |
| **No transactions** | Can't atomically update related records |
| **512-byte key limit** | Composite keys (`property_id + year`) fit, but querying by owner name is impossible |
| **25 MB value limit** | Individual property records fit, but no way to query across them |

### When KV Makes Sense

- Configuration / feature flags
- Session tokens (read-heavy, write-rare)
- Cached API responses
- The token refresh service (store current token in KV, read from Workers)

### Verdict

**Not a database replacement.** Useful as a supporting cache (token storage, config), not for the property dataset.

---

## Option 4: R2 (Object Storage)

**What it is**: S3-compatible object storage with zero egress fees.

### Why It Doesn't Fit

- No query capability — it's blob storage
- Would require reading/deserializing entire datasets to filter
- No indexing, no transactions

### When R2 Makes Sense

- Storing scrape result snapshots / exports (CSV, JSON dumps)
- Archiving historical property data
- Hosting static frontend assets

### Verdict

**Not a database.** Useful for exports/archives alongside the real database.

---

## Option 5: D1 (SQLite Database)

Covered in detail in the first half of this document. Summary:

- **100-parameter limit** breaks bulk upserts (70x throughput reduction)
- **No `prisma migrate deploy`** — experimental `db push` only
- **No `xmax`**, no `TEXT[]`, no `ILIKE`
- 10 GB max DB size (limited headroom for 500K+ properties)

### Verdict

**High risk, high effort.** See detailed analysis above.

---

## Comparison Matrix

| Requirement | Hyperdrive | D1 | Durable Objects | KV | R2 |
|-------------|-----------|-----|-----------------|-----|-----|
| 500K+ relational rows | **Yes** (PostgreSQL) | Yes (10 GB limit) | Fragmented across DOs | No | No |
| Bulk upsert 500 rows | **Yes** (no limit) | 7 rows/query max | 7 rows/query max | 1 write/sec/key | N/A |
| Prisma ORM | **Yes** (`adapter-pg`) | Preview (`adapter-d1`) | No | No | No |
| `prisma migrate deploy` | **Yes** | No | No | N/A | N/A |
| ACID transactions | **Yes** | Limited | Per-object only | No | No |
| Case-insensitive search | **Yes** (`ILIKE`) | ASCII only | ASCII only | N/A | N/A |
| Array columns | **Yes** (`TEXT[]`) | No (JSON workaround) | No | N/A | N/A |
| Insert/update detection | **Yes** (`xmax`) | No | No | N/A | N/A |
| Query timeout | 60s | 30s | 30s CPU | N/A | N/A |
| Schema changes needed | **None** | High | High | N/A | N/A |
| Framework swap needed | Yes | Yes | Yes | Yes | N/A |

---

## Supporting Infrastructure (Applicable to Any Option)

If the backend moves to Workers, these changes apply regardless of database choice:

### Cloudflare Queues (replaces BullMQ + Redis)

| Feature | Limit (Paid) |
|---------|-------------|
| Max message size | 256 KB |
| Max batch size | 100 messages |
| Throughput | 5,000 msg/sec (pull) |
| Message retention | 4-14 days (configurable) |
| Pricing | $0.40/million operations (3 ops per message: write + read + delete) |

**Gap**: No job inspection UI (Bull Board), no priority queues, no delayed/scheduled individual jobs (only `delaySeconds` per message up to 24h).

### Cloudflare Workflows (replaces long-running scrape jobs)

| Feature | Limit (Paid) |
|---------|-------------|
| Steps per instance | 10,000 (configurable to 25,000) |
| CPU per step | 30s default, configurable to 5 min |
| Wall time per step | Unlimited |
| Concurrent instances | 10,000 per account |
| State per instance | 1 GB |
| Pricing | $0.30/million invocations + $0.02/million CPU ms |

**Fit**: Scrape jobs are mostly I/O-bound (waiting on TCAD API). Each scrape job becomes a Workflow with steps for: fetch → transform → upsert. The 25,000-step limit and unlimited wall time per step are well-suited for batch processing.

### Cloudflare KV (replaces Redis cache + token storage)

| Feature | Limit (Paid) |
|---------|-------------|
| Value size | 25 MB |
| Write rate | 1/sec per key |
| Read rate | Unlimited |
| Consistency | Eventually consistent (~60s) |
| Pricing | $0.50/million reads, $5.00/million writes |

**Fit**: Good for token storage (write every 4 min, read on every request) and cached search results. Not suitable for `KEYS pattern` scan — must use `list({ prefix })` + individual deletes.

---

## Recommendation

### Best Path: Hyperdrive + Keep Render PostgreSQL

**Migration effort**: Medium (framework swap only, zero DB changes)

```
Phase 1: Deploy API as Cloudflare Worker (Hono) + Hyperdrive → Render PostgreSQL
Phase 2: Replace BullMQ with Cloudflare Queues or Workflows
Phase 3: Move token refresh to KV + Cron Trigger
Phase 4: (Optional) Move PostgreSQL from Render to Neon for serverless pooling
```

This gives you:
- **Zero database migration risk** — same Prisma schema, same queries, same data
- **Cloudflare edge benefits** — connection pooling, query caching, global CDN
- **Incremental migration** — move components one at a time, validate each step
- **Escape hatch** — if Workers doesn't work out, Hyperdrive config is the only thing to remove

### If You Must Go Cloudflare-Native DB

Use D1 only if you're willing to:
1. Rewrite the bulk upsert to 7-row chunks (accept 70x more SQL statements)
2. Drop Prisma migrations for manual SQL via `wrangler d1 execute`
3. Rewrite all `ILIKE`, `TEXT[]`, `xmax`, and `::bigint` usage
4. Accept 10 GB growth ceiling

**Durable Objects, KV, and R2 are not database replacements** for this workload.
