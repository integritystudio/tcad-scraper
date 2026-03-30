# D1 Migration Implementation Guide

**Created**: March 30, 2026
**Status**: Planning
**Prerequisite**: Read [CLOUDFLARE_D1_FEASIBILITY.md](./CLOUDFLARE_D1_FEASIBILITY.md) for full risk analysis

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Target Architecture](#target-architecture)
4. [Compatibility Matrix](#compatibility-matrix)
5. [Phase 0: Pre-Migration Validation](#phase-0-pre-migration-validation)
6. [Phase 1: Schema Translation](#phase-1-schema-translation)
7. [Phase 2: Application Code Changes](#phase-2-application-code-changes)
8. [Phase 3: Data Migration](#phase-3-data-migration)
9. [Phase 4: Testing](#phase-4-testing)
10. [Phase 5: Cutover](#phase-5-cutover)
11. [Phase 6: Cleanup](#phase-6-cleanup)
12. [Appendix A: File-by-File Change Reference](#appendix-a-file-by-file-change-reference)
13. [Appendix B: D1 Constraints Quick Reference](#appendix-b-d1-constraints-quick-reference)
14. [Appendix C: SQL Translation Reference](#appendix-c-sql-translation-reference)

---

## Executive Summary

This document covers migrating the TCAD Scraper database from Render PostgreSQL (accessed via Cloudflare Hyperdrive) to Cloudflare D1 (managed SQLite at the edge). The migration eliminates the Render dependency and consolidates all infrastructure on Cloudflare.

**What changes**: Database engine (PostgreSQL to SQLite), ORM adapter (`@prisma/adapter-pg` to `@prisma/adapter-d1`), Prisma schema provider, bulk upsert implementation, case-insensitive search, date/array handling.

**What does NOT change**: Hono API framework, Cloudflare Workers runtime, Queues + Workflows, KV cache, Sentry, authentication, frontend.

### Key Risks

| Risk | Severity | Section |
|------|----------|---------|
| 100 bound params/query limit constrains bulk upserts to ~7 rows/statement | High | [Phase 2.2](#22-bulk-upsert-rewrite) |
| 10 GB hard database cap with no upgrade path | High | [Appendix B](#appendix-b-d1-constraints-quick-reference) |
| Single-writer architecture bottlenecks under concurrent scrape load | High | [Phase 4.3](#43-load-testing) |
| `mode: "insensitive"` (ILIKE) not supported in Prisma + SQLite | Medium | [Phase 2.4](#24-case-insensitive-search) |
| `String[]` array type not supported in SQLite | Medium | [Phase 2.5](#25-array-field-serialization) |

---

## Current Architecture

```
React (5174) --> CF Workers (Hono) --> Hyperdrive --> PostgreSQL (Render)
                      |
                 CF Queue --> ScraperWorkflow (5 steps)
                      |
                 TCAD API --> bulk upsert via Hyperdrive
```

### Production Files (workers/tcad-api/src/)

| File | Purpose | D1 Impact |
|------|---------|-----------|
| `index.ts` | Hono app, queue consumer, cron handlers | Change `createPrisma` calls |
| `db.ts` | Prisma + Hyperdrive connection factory | **Rewrite entirely** |
| `bindings.d.ts` | Env type definitions | Replace `HYPERDRIVE` with `DB` |
| `workflows/scraper.workflow.ts` | ScraperWorkflow (5 steps) | **Heavy rewrite** (bulk upsert) |
| `controllers/property.ts` | Property CRUD + search | Remove `mode: "insensitive"` |
| `controllers/api-usage.ts` | API usage stats | Rewrite raw SQL queries |
| `middleware/auth.ts` | API key + JWT auth | No changes |
| `lib/claude.service.ts` | AI search query generation | Update system prompt |
| `utils/constants.ts` | Constants | Add D1 chunk size constant |
| `utils/error-helpers.ts` | Error message extraction | No changes |
| `utils/property-transformers.ts` | camelCase to snake_case | Update DateTime handling |
| `types/property.types.ts` | Zod schemas + types | No changes |

### Database Schema (5 tables)

| Table | Estimated Rows | D1-Incompatible Features |
|-------|---------------|--------------------------|
| `properties` | ~500K | UUID default, DateTime, 14-column bulk upsert, `xmax` detection |
| `scrape_jobs` | ~50K | UUID default, DateTime, `String[]` array |
| `monitored_searches` | ~50 | UUID default, DateTime |
| `search_term_analytics` | ~2K | UUID default, DateTime |
| `api_usage_logs` | ~5K | UUID default, DateTime, `@db.Text` |

### Dependencies (workers/tcad-api/package.json)

```json
{
  "dependencies": {
    "@prisma/adapter-pg": "^6.6.0",   // REMOVE
    "@prisma/client": "^6.6.0",       // KEEP
    "pg": "^8.14.0",                  // REMOVE
    // hono, jose, sentry, zod — unchanged
  },
  "devDependencies": {
    "prisma": "^6.6.0",               // KEEP
    // @cloudflare/workers-types, typescript, wrangler — unchanged
  }
}
```

**Add**: `@prisma/adapter-d1`
**Remove**: `@prisma/adapter-pg`, `pg`

---

## Target Architecture

```
React (5174) --> CF Workers (Hono) --> D1 (SQLite) [edge reads, single-region writes]
                      |
                 CF Queue --> ScraperWorkflow (5 steps)
                      |
                 TCAD API --> chunked upsert via D1
```

### wrangler.toml Changes

```toml
# REMOVE:
# [[hyperdrive]]
# binding = "HYPERDRIVE"
# id = "e0406d51a79a4440863e0c608390a613"

# ADD:
[[d1_databases]]
binding = "DB"
database_name = "tcad-db"
database_id = "<id-from-wrangler-d1-create>"
```

---

## Compatibility Matrix

### PostgreSQL to SQLite Type Mapping

| PostgreSQL (current) | SQLite / D1 | Prisma Schema Change | App Code Change |
|---------------------|-------------|---------------------|-----------------|
| `uuid` / `@default(uuid())` | TEXT (app-generated UUID) | Keep `@default(uuid())` — verify D1 adapter support | May need `crypto.randomUUID()` in raw SQL paths |
| `DateTime` / `timestamp` | TEXT (ISO 8601) or INTEGER (epoch) | Change `DateTime` to `String` | `.toISOString()` on all date writes; parse on reads |
| `Float` | REAL | No change | No change |
| `Int` | INTEGER | No change | No change |
| `String` | TEXT | No change | No change |
| `String?` | TEXT (nullable) | No change | No change |
| `String[]` (PostgreSQL array) | TEXT (JSON-serialized array) | Change `String[]` to `String @default("[]")` | `JSON.stringify()` / `JSON.parse()` |
| `@db.Text` | TEXT (unbounded in SQLite) | Remove `@db.Text` annotations | No change |
| `Boolean` | INTEGER (0/1) | No change (Prisma handles) | No change |

### PostgreSQL to SQLite Query Mapping

| PostgreSQL Feature | Current Usage | SQLite Equivalent |
|-------------------|---------------|-------------------|
| `ILIKE` / `mode: "insensitive"` | `property.ts:302-304` | `LIKE` (case-insensitive for ASCII by default) or `LOWER(col) LIKE LOWER(?)` |
| `ON CONFLICT DO UPDATE` | `scraper.workflow.ts:268` | Supported (SQLite 3.24+) |
| `RETURNING` | `scraper.workflow.ts:280` | Supported (SQLite 3.35+) |
| `(xmax = 0) AS inserted` | `scraper.workflow.ts:280` | **Not available** — PostgreSQL internal column |
| `$1, $2, $3` (numbered params) | `scraper.workflow.ts:248` | `?, ?, ?` (positional params) |
| `CAST(x AS bigint)` | `api-usage.ts:41,43` | `CAST(x AS INTEGER)` or just omit |
| `DATE(timestamp)` | `api-usage.ts:40` | `date(timestamp)` (SQLite function) |
| `Prisma.sql` template | `api-usage.ts:46` | **Not supported with D1 adapter** — rewrite to Prisma queries or D1 prepared statements |
| `Prisma.empty` | `api-usage.ts:46` | **Not supported with D1 adapter** |
| `$queryRaw` | `api-usage.ts:38` | Limited support — test with D1 adapter |
| `$queryRawUnsafe` | `scraper.workflow.ts:283` | **Not recommended** — use D1 `prepare().bind().all()` |
| `COALESCE` | `scraper.workflow.ts:249` | Supported |
| `{ increment: 1 }` (atomic increment) | `scraper.workflow.ts:113` | Supported via Prisma |

---

## Phase 0: Pre-Migration Validation

### 0.1 Measure Current Dataset Size

Run from `server/` directory:

```bash
doppler run -- npx tsx --eval "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const [props, jobs, monitors, analytics, usage] = await Promise.all([
  p.property.count(),
  p.scrapeJob.count(),
  p.monitoredSearch.count(),
  p.searchTermAnalytics.count(),
  p.apiUsageLog.count(),
]);
console.table({ properties: props, scrapeJobs: jobs, monitoredSearches: monitors, searchTermAnalytics: analytics, apiUsageLogs: usage });
await p.\$disconnect();
process.exit(0);
"
```

Record these counts. They are your validation target after data import (Phase 3.4).

Estimate storage: `properties` at ~500K rows x ~2KB/row = ~1 GB. D1 cap is 10 GB.

### 0.2 Create D1 Database

```bash
cd workers/tcad-api
npx wrangler d1 create tcad-db
```

Save the `database_id` from the output. You will need it for `wrangler.toml`.

### 0.3 Verify Prisma D1 Adapter Version

The `@prisma/adapter-d1` package reached stable support in Prisma 6.6+. Verify:

```bash
cd workers/tcad-api
npm ls prisma @prisma/client
```

If below 6.6.0, upgrade first:

```bash
npm install @prisma/client@latest @prisma/adapter-d1@latest
npm install -D prisma@latest
```

### 0.4 Create Feature Flag

Add to `wrangler.toml` for parallel operation during cutover:

```toml
[vars]
USE_D1 = "false"  # flip to "true" when ready to switch
```

---

## Phase 1: Schema Translation

### 1.1 New Prisma Schema

Create `workers/tcad-api/prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Property {
  id              String  @id @default(uuid())
  propertyId      String  @map("property_id")
  name            String
  propType        String  @map("prop_type")
  city            String?
  propertyAddress String  @map("property_address")
  assessedValue   Float?  @map("assessed_value")
  appraisedValue  Float   @map("appraised_value")
  geoId           String? @map("geo_id")
  description     String?
  searchTerm      String? @map("search_term")
  scrapedAt       String  @default("") @map("scraped_at")
  createdAt       String  @default("") @map("created_at")
  updatedAt       String  @default("") @map("updated_at")
  year            Int

  @@unique([propertyId, year])
  @@index([searchTerm, scrapedAt])
  @@index([propertyId])
  @@index([city])
  @@index([propType])
  @@index([appraisedValue])
  @@index([year])
  @@index([city, propType])
  @@index([city, appraisedValue])
  @@index([propType, appraisedValue])
  @@index([city, propType, appraisedValue])
  @@index([year, city])
  @@map("properties")
}

model ScrapeJob {
  id              String  @id @default(uuid())
  searchTerm      String  @map("search_term")
  status          String
  resultCount     Int?    @map("result_count")
  totalApiResults Int?    @map("total_api_results")
  updatedCount    Int?    @map("updated_count")
  newPropertyIds  String  @default("[]") @map("new_property_ids")
  error           String?
  startedAt       String  @default("") @map("started_at")
  completedAt     String? @map("completed_at")

  @@index([status, startedAt])
  @@index([searchTerm])
  @@map("scrape_jobs")
}

model MonitoredSearch {
  id         String  @id @default(uuid())
  searchTerm String  @map("search_term") @unique
  active     Boolean @default(true)
  frequency  String  @default("daily")
  lastRun    String? @map("last_run")
  createdAt  String  @default("") @map("created_at")
  updatedAt  String  @default("") @map("updated_at")

  @@map("monitored_searches")
}

model SearchTermAnalytics {
  id                 String @id @default(uuid())
  searchTerm         String @map("search_term")
  termLength         Int    @map("term_length")
  totalSearches      Int    @default(0) @map("total_searches")
  successfulSearches Int    @default(0) @map("successful_searches")
  failedSearches     Int    @default(0) @map("failed_searches")
  totalResults       Int    @default(0) @map("total_results")
  avgResultsPerSearch Float @default(0) @map("avg_results_per_search")
  maxResults         Int    @default(0) @map("max_results")
  minResults         Int?   @map("min_results")
  lastSearched       String @map("last_searched")
  successRate        Float  @default(0) @map("success_rate")
  efficiency         Float  @default(0)
  createdAt          String @default("") @map("created_at")
  updatedAt          String @default("") @map("updated_at")

  @@unique([searchTerm])
  @@index([efficiency])
  @@index([avgResultsPerSearch])
  @@index([termLength])
  @@index([lastSearched])
  @@map("search_term_analytics")
}

model ApiUsageLog {
  id           String  @id @default(uuid())
  queryText    String  @map("query_text")
  queryCost    Float   @map("query_cost")
  inputTokens  Int    @map("input_tokens")
  outputTokens Int    @map("output_tokens")
  model        String
  environment  String
  success      Boolean @default(true)
  errorMessage String? @map("error_message")
  responseTime Int?    @map("response_time")
  timestamp    String  @default("")

  @@index([timestamp])
  @@index([environment])
  @@index([success])
  @@index([model])
  @@map("api_usage_logs")
}
```

**Key differences from PostgreSQL schema**:

| Change | Reason |
|--------|--------|
| `provider = "sqlite"` | D1 is SQLite-based |
| `previewFeatures = ["driverAdapters"]` | Required for `@prisma/adapter-d1` |
| `DateTime` fields become `String` | SQLite stores dates as TEXT |
| `@db.Text` annotations removed | SQLite TEXT is unbounded — annotation not needed |
| `String[]` becomes `String @default("[]")` | SQLite has no array type |
| `@@index([scrapedAt(sort: Desc)])` removed | SQLite index sort direction syntax differs; Prisma may not support it |

### 1.2 Generate Migration SQL

```bash
cd workers/tcad-api

# Generate the CREATE TABLE statements
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0001_init.sql
```

Review the output. It should contain standard SQLite `CREATE TABLE` and `CREATE INDEX` statements.

### 1.3 Apply Schema to D1

```bash
# Apply to remote D1
npx wrangler d1 execute tcad-db --remote --file prisma/migrations/0001_init.sql

# Verify tables were created
npx wrangler d1 execute tcad-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected tables: `api_usage_logs`, `monitored_searches`, `properties`, `scrape_jobs`, `search_term_analytics`.

### 1.4 Generate Prisma Client

```bash
cd workers/tcad-api
npx prisma generate
```

---

## Phase 2: Application Code Changes

### 2.1 Database Connection (db.ts)

**Current** (`workers/tcad-api/src/db.ts`):

```typescript
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export function createPrisma(hyperdrive: Hyperdrive): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: hyperdrive.connectionString,
  });
  return new PrismaClient({ adapter });
}
```

**New**:

```typescript
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";

export function createPrisma(db: D1Database): PrismaClient {
  const adapter = new PrismaD1(db);
  return new PrismaClient({ adapter });
}
```

### 2.2 Bulk Upsert Rewrite

This is the highest-effort change. The current implementation in `scraper.workflow.ts:233-293` builds a single SQL statement with `$queryRawUnsafe` containing up to 500 rows x 14 params = 7,000 bound parameters. D1 enforces a hard limit of **100 bound parameters per query**.

**Current** (`scraper.workflow.ts:233-293`):

```typescript
// Builds one INSERT with all rows: $1, $2, ... $7000
// Uses PostgreSQL $N numbered params
// Uses xmax = 0 to detect inserts vs updates
const sql = `INSERT INTO properties (...) VALUES ${valuesClauses.join(", ")}
  ON CONFLICT (property_id, year) DO UPDATE SET ...
  RETURNING property_id, (xmax = 0) AS inserted`;
const result = await prisma.$queryRawUnsafe<...>(sql, ...params);
```

**New approach — D1 prepared statements with micro-batching**:

```typescript
import { UPSERT_MICRO_CHUNK_SIZE, UPSERT_COLUMNS } from "../utils/constants";

/**
 * D1 bulk upsert — replaces PostgreSQL $queryRawUnsafe approach.
 *
 * Constraints:
 *  - D1 max 100 bound params per query
 *  - 14 columns per row = max 7 rows per statement (7 x 14 = 98)
 *  - No xmax for insert/update detection — use pre-query EXISTS check
 *
 * Strategy:
 *  1. Query existing property_ids for this batch to detect new vs updated
 *  2. Execute INSERT...ON CONFLICT in 7-row micro-chunks
 *  3. Return new/updated counts based on pre-query diff
 */
async function bulkUpsert(
  db: D1Database,
  chunk: PropertyData[],
  searchTerm: string,
  year: number,
): Promise<{ savedCount: number; updatedCount: number; newPropertyIds: string[] }> {
  const now = new Date().toISOString();

  // Step 1: Find which property_ids already exist (for new vs update tracking)
  // Query in batches of 50 to stay within param limits
  const existingIds = new Set<string>();
  const idChunks = chunkArray(chunk.map(p => p.propertyId), 50);
  for (const idChunk of idChunks) {
    const placeholders = idChunk.map(() => "?").join(",");
    const result = await db
      .prepare(`SELECT property_id FROM properties WHERE year = ? AND property_id IN (${placeholders})`)
      .bind(year, ...idChunk)
      .all<{ property_id: string }>();
    for (const row of result.results) {
      existingIds.add(row.property_id);
    }
  }

  // Step 2: Upsert in micro-chunks of 7 rows
  const microChunks = chunkArray(chunk, UPSERT_MICRO_CHUNK_SIZE);
  const statements: D1PreparedStatement[] = [];

  for (const micro of microChunks) {
    const placeholders = micro
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");

    const params: (string | number | null)[] = [];
    for (const prop of micro) {
      params.push(
        prop.propertyId,
        prop.name,
        prop.propType,
        prop.city,
        prop.propertyAddress,
        prop.assessedValue,
        prop.appraisedValue ?? 0,
        prop.geoId,
        prop.description,
        searchTerm,
        year,
        now, // scraped_at
        now, // created_at
        now, // updated_at
      );
    }

    statements.push(
      db.prepare(`
        INSERT INTO properties (
          property_id, name, prop_type, city, property_address,
          assessed_value, appraised_value, geo_id, description,
          search_term, year, scraped_at, created_at, updated_at
        )
        VALUES ${placeholders}
        ON CONFLICT (property_id, year) DO UPDATE SET
          name = excluded.name,
          prop_type = excluded.prop_type,
          city = excluded.city,
          property_address = excluded.property_address,
          assessed_value = excluded.assessed_value,
          appraised_value = excluded.appraised_value,
          geo_id = excluded.geo_id,
          description = excluded.description,
          search_term = excluded.search_term,
          scraped_at = excluded.scraped_at,
          updated_at = excluded.updated_at
      `).bind(...params)
    );
  }

  // D1 batch() executes all statements in a single transaction
  await db.batch(statements);

  // Step 3: Calculate new vs updated from pre-query diff
  const newPropertyIds = chunk
    .map(p => p.propertyId)
    .filter(id => !existingIds.has(id));

  return {
    savedCount: newPropertyIds.length,
    updatedCount: chunk.length - newPropertyIds.length,
    newPropertyIds,
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
```

**Add constants** to `utils/constants.ts`:

```typescript
// D1 has a hard limit of 100 bound parameters per query.
// With 14 columns per property row, max 7 rows per statement (7 x 14 = 98).
const D1_MAX_BOUND_PARAMS = 100;
export const UPSERT_COLUMNS = 14;
export const UPSERT_MICRO_CHUNK_SIZE = Math.floor(D1_MAX_BOUND_PARAMS / UPSERT_COLUMNS); // 7
```

**Performance impact**: A 5,000-property scrape job currently uses ~10 SQL statements (500 rows/chunk). On D1 it requires ~714 statements (7 rows/chunk). However, `db.batch()` executes these in a single round-trip transaction, so the network overhead is one request to D1, not 714.

The outer `UPSERT_CHUNK_SIZE` (500) in the workflow loop can remain — within each 500-row chunk, the D1 bulkUpsert function handles the micro-chunking internally.

### 2.3 ScraperWorkflow Updates

The workflow in `scraper.workflow.ts` needs changes in every step that calls `createPrisma`.

**Change all `createPrisma(this.env.HYPERDRIVE)` to `createPrisma(this.env.DB)`.**

There are 3 call sites:
- Line 26: `const prisma = createPrisma(this.env.HYPERDRIVE);` (Step 1: get-token)
- Line 73: `const prisma = createPrisma(this.env.HYPERDRIVE);` (Step 4: upsert-properties)
- Line 96: `const prisma = createPrisma(this.env.HYPERDRIVE);` (Step 5: update-analytics)

**Step 4 also needs the bulk upsert rewrite.** The current call:

```typescript
const result = await bulkUpsert(prisma, chunk, searchTerm, year);
```

Changes to pass `D1Database` instead of `PrismaClient` for the raw upsert:

```typescript
const result = await bulkUpsert(this.env.DB, chunk, searchTerm, year);
```

**Step 5: DateTime values** must change from `new Date()` to `new Date().toISOString()`:

```typescript
// Before
await prisma.scrapeJob.update({
  data: { completedAt: new Date(), ... },
});
await prisma.searchTermAnalytics.upsert({
  update: { lastSearched: new Date(), ... },
  create: { lastSearched: new Date(), ... },
});

// After
const now = new Date().toISOString();
await prisma.scrapeJob.update({
  data: { completedAt: now, ... },
});
await prisma.searchTermAnalytics.upsert({
  update: { lastSearched: now, ... },
  create: { lastSearched: now, ... },
});
```

**Step 4: Array field** — `newPropertyIds` must be JSON-serialized:

```typescript
// Before
await prisma.scrapeJob.update({
  data: { newPropertyIds: upsertResult.newPropertyIds, ... },
});

// After
await prisma.scrapeJob.update({
  data: { newPropertyIds: JSON.stringify(upsertResult.newPropertyIds), ... },
});
```

### 2.4 Case-Insensitive Search

**File**: `workers/tcad-api/src/controllers/property.ts:297-318`

**Current** (`buildWhereClause`):

```typescript
if (filters.searchTerm) {
  where.OR = [
    { searchTerm: { contains: filters.searchTerm, mode: "insensitive" } },
    { name: { contains: filters.searchTerm, mode: "insensitive" } },
    { propertyAddress: { contains: filters.searchTerm, mode: "insensitive" } },
  ];
}
```

Prisma's `mode: "insensitive"` maps to PostgreSQL `ILIKE`. The D1/SQLite adapter does not support `mode: "insensitive"` and will throw at runtime.

**Option A — Drop `mode` (SQLite LIKE is case-insensitive for ASCII)**:

SQLite's `LIKE` operator is case-insensitive for ASCII characters (A-Z) by default. Since TCAD property data is primarily ASCII English, this is likely sufficient:

```typescript
if (filters.searchTerm) {
  where.OR = [
    { searchTerm: { contains: filters.searchTerm } },
    { name: { contains: filters.searchTerm } },
    { propertyAddress: { contains: filters.searchTerm } },
  ];
}
```

Prisma translates `contains` to `LIKE '%value%'` on SQLite, which is case-insensitive for ASCII.

**Option B — FTS5 virtual table (better long-term)**:

For more robust text search, create an FTS5 virtual table:

```sql
CREATE VIRTUAL TABLE properties_fts USING fts5(
  property_id,
  name,
  property_address,
  search_term,
  content='properties',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER properties_ai AFTER INSERT ON properties BEGIN
  INSERT INTO properties_fts(property_id, name, property_address, search_term)
  VALUES (new.property_id, new.name, new.property_address, new.search_term);
END;

CREATE TRIGGER properties_au AFTER UPDATE ON properties BEGIN
  INSERT INTO properties_fts(properties_fts, property_id, name, property_address, search_term)
  VALUES ('delete', old.property_id, old.name, old.property_address, old.search_term);
  INSERT INTO properties_fts(property_id, name, property_address, search_term)
  VALUES (new.property_id, new.name, new.property_address, new.search_term);
END;

CREATE TRIGGER properties_ad AFTER DELETE ON properties BEGIN
  INSERT INTO properties_fts(properties_fts, property_id, name, property_address, search_term)
  VALUES ('delete', old.property_id, old.name, old.property_address, old.search_term);
END;
```

FTS5 is more capable than LIKE for prefix matching and ranking, but adds complexity. **Recommendation: start with Option A, migrate to FTS5 if search quality is insufficient.**

### 2.5 Array Field Serialization

**Field**: `ScrapeJob.newPropertyIds` (was `String[]`, now `String`)

Every read/write of this field needs serialization:

```typescript
// WRITING
await prisma.scrapeJob.update({
  data: {
    newPropertyIds: JSON.stringify(["id1", "id2", "id3"]),
  },
});

// READING
const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
const ids: string[] = JSON.parse(job.newPropertyIds);
```

**Affected code locations**:
- `scraper.workflow.ts:105` — writing `newPropertyIds` on job completion
- Any code that reads `job.newPropertyIds` and expects an array

Consider a helper:

```typescript
// utils/json-array.ts
export function serializeIds(ids: string[]): string {
  return JSON.stringify(ids);
}

export function deserializeIds(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
```

### 2.6 DateTime Handling

All `DateTime` fields become `String` (ISO 8601). This affects:

**Every `new Date()` assignment** — must become `new Date().toISOString()`:

| File | Line | Current | New |
|------|------|---------|-----|
| `scraper.workflow.ts` | 98-108 | `completedAt: new Date()` | `completedAt: new Date().toISOString()` |
| `scraper.workflow.ts` | 111-127 | `lastSearched: new Date()` | `lastSearched: new Date().toISOString()` |
| `index.ts` | 139-142 | `completedAt: new Date()` | `completedAt: new Date().toISOString()` |
| `index.ts` | 157-160 | `lastRun: new Date()` | `lastRun: new Date().toISOString()` |

**Every date comparison** — `{ gte: someDate }` must use ISO strings:

| File | Line | Current | New |
|------|------|---------|-----|
| `index.ts` | 138 | `startedAt: { lt: cutoff }` where `cutoff = new Date(...)` | `startedAt: { lt: cutoff.toISOString() }` |
| `property.ts` | 243 | `startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }` | `startedAt: { gte: new Date(Date.now() - ...).toISOString() }` |
| `api-usage.ts` | 25 | `timestamp: { gte: startDate }` | `timestamp: { gte: startDate.toISOString() }` |
| `api-usage.ts` | 143 | `timestamp: { gte: today }` | `timestamp: { gte: today.toISOString() }` |
| `api-usage.ts` | 144 | `timestamp: { gte: thisMonth }` | `timestamp: { gte: thisMonth.toISOString() }` |
| `api-usage.ts` | 146 | `timestamp: { gte: new Date(...) }` | `timestamp: { gte: new Date(...).toISOString() }` |

**ISO 8601 strings sort lexicographically the same as chronologically**, so `orderBy: { scrapedAt: "desc" }` and index-based range queries continue to work correctly.

**Property transformer** (`property-transformers.ts:41-43`):

```typescript
// Before (DateTime objects)
scraped_at: prop.scrapedAt.toISOString(),
created_at: prop.createdAt.toISOString(),
updated_at: prop.updatedAt.toISOString(),

// After (already strings)
scraped_at: prop.scrapedAt,
created_at: prop.createdAt,
updated_at: prop.updatedAt,
```

### 2.7 Raw SQL Queries (api-usage.ts)

**Current** (`api-usage.ts:38-48`):

```typescript
prisma.$queryRaw<Array<{ date: Date; count: bigint; total_cost: number; success_count: bigint }>>`
  SELECT
    DATE(timestamp) as date,
    CAST(COUNT(*) AS bigint) as count,
    SUM(query_cost) as total_cost,
    CAST(COUNT(CASE WHEN success THEN 1 END) AS bigint) as success_count
  FROM api_usage_logs
  WHERE timestamp >= ${startDate}
    ${environment ? Prisma.sql`AND environment = ${environment}` : Prisma.empty}
  GROUP BY DATE(timestamp)
  ORDER BY date DESC
`
```

This uses `Prisma.sql` template literals and `Prisma.empty`, which may not work reliably with the D1 adapter. Rewrite using D1 prepared statements or split into two Prisma queries:

**Option A — D1 prepared statement (recommended)**:

```typescript
// Access D1 directly from env binding
const db = c.env.DB;

let sql = `
  SELECT
    date(timestamp) as date,
    COUNT(*) as count,
    SUM(query_cost) as total_cost,
    COUNT(CASE WHEN success = 1 THEN 1 END) as success_count
  FROM api_usage_logs
  WHERE timestamp >= ?
`;
const params: (string | number)[] = [startDate.toISOString()];

if (environment) {
  sql += ` AND environment = ?`;
  params.push(environment);
}

sql += ` GROUP BY date(timestamp) ORDER BY date DESC`;

const usageByDay = await db.prepare(sql).bind(...params)
  .all<{ date: string; count: number; total_cost: number; success_count: number }>();
```

Note the SQLite differences:
- `DATE()` becomes `date()` (lowercase, SQLite function)
- Remove `CAST(... AS bigint)` — SQLite integers are fine
- `WHEN success` becomes `WHEN success = 1` (SQLite stores booleans as 0/1)
- `${startDate}` becomes `?` with `.bind(startDate.toISOString())`

**This means `api-usage.ts` needs access to `c.env.DB`** in addition to `c.get("prisma")`. Add it to the middleware or pass via Hono context.

### 2.8 Env Bindings Update

**File**: `workers/tcad-api/src/bindings.d.ts`

```typescript
import type { PrismaClient } from "@prisma/client";

export interface Env {
  // Database (D1 — replaces Hyperdrive → Render PostgreSQL)
  DB: D1Database;

  // Workflows + Queues
  SCRAPER_WORKFLOW: Workflow;
  SCRAPER_QUEUE: Queue;

  // KV namespaces
  TOKEN_CACHE: KVNamespace;
  RESPONSE_CACHE: KVNamespace;

  // Secrets
  API_KEY: string;
  JWT_SECRET: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY?: string;
  SENTRY_DSN: string;
  TOKEN_WORKER_URL: string;
  TOKEN_WORKER_SECRET: string;

  // Variables
  TCAD_YEAR: string;
  FRONTEND_URL: string;

  // Sentry
  CF_VERSION_METADATA: WorkerVersionMetadata;
}

export interface AppVariables {
  prisma: PrismaClient;
  user: { id: string; email?: string };
  validatedBody: unknown;
  validatedQuery: unknown;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };
```

### 2.9 Middleware Update (index.ts)

**Current** (`index.ts:38-44`):

```typescript
app.use("*", async (c, next) => {
  const prisma = createPrisma(c.env.HYPERDRIVE);
  c.set("prisma", prisma);
  await next();
});
```

**New**:

```typescript
app.use("*", async (c, next) => {
  const prisma = createPrisma(c.env.DB);
  c.set("prisma", prisma);
  await next();
});
```

### 2.10 Cron Handlers (index.ts)

**`cleanupStaleJobs`** (`index.ts:135-147`):

```typescript
// Before
const prisma = createPrisma(env.HYPERDRIVE);
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
const result = await prisma.scrapeJob.updateMany({
  where: { status: "processing", startedAt: { lt: cutoff } },
  data: { status: "failed", error: "Stale job cleaned up", completedAt: new Date() },
});

// After
const prisma = createPrisma(env.DB);
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
const result = await prisma.scrapeJob.updateMany({
  where: { status: "processing", startedAt: { lt: cutoff.toISOString() } },
  data: { status: "failed", error: "Stale job cleaned up", completedAt: new Date().toISOString() },
});
```

**`runMonitoredSearches`** (`index.ts:149-166`):

```typescript
// Before
const prisma = createPrisma(env.HYPERDRIVE);
// ...
await prisma.monitoredSearch.update({
  where: { id: search.id },
  data: { lastRun: new Date() },
});

// After
const prisma = createPrisma(env.DB);
// ...
await prisma.monitoredSearch.update({
  where: { id: search.id },
  data: { lastRun: new Date().toISOString() },
});
```

### 2.11 Claude Service System Prompt

**File**: `workers/tcad-api/src/lib/claude.service.ts:32-52`

The system prompt instructs Claude to generate `"mode": "insensitive"` in query output. Update:

```typescript
// Before
// 1. "whereClause": Prisma where clause as JSON (use "contains" for text searches with "mode": "insensitive", ...)

// After
// 1. "whereClause": Prisma where clause as JSON (use "contains" for text searches — do NOT include "mode": "insensitive", ...)
```

**Important**: The Claude service generates `whereClause` objects that Prisma executes. If the LLM still emits `"mode": "insensitive"`, Prisma will throw on SQLite. Add a sanitization step:

```typescript
function sanitizeWhereClause(clause: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...clause };
  for (const [key, value] of Object.entries(sanitized)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if ("mode" in obj && obj.mode === "insensitive") {
        delete obj.mode;
      }
      sanitized[key] = sanitizeWhereClause(obj);
    }
    if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === "object" && item !== null
          ? sanitizeWhereClause(item as Record<string, unknown>)
          : item
      );
    }
  }
  return sanitized;
}
```

Apply before passing to Prisma in `property.ts:120`:

```typescript
whereClause = sanitizeWhereClause(parsed.whereClause) as Prisma.PropertyWhereInput;
```

### 2.12 Package.json Updates

```bash
cd workers/tcad-api

# Remove PostgreSQL dependencies
npm uninstall @prisma/adapter-pg pg

# Add D1 adapter
npm install @prisma/adapter-d1
```

Final `dependencies` section:

```json
{
  "dependencies": {
    "@prisma/adapter-d1": "^6.6.0",
    "@prisma/client": "^6.6.0",
    "@sentry/cloudflare": "^10.35.0",
    "hono": "^4.7.0",
    "jose": "^6.0.0",
    "zod": "^3.24.0"
  }
}
```

### 2.13 wrangler.toml Update

```toml
name = "tcad-api"
main = "src/index.ts"
compatibility_date = "2026-03-01"
compatibility_flags = ["nodejs_compat"]

[observability]
enabled = true

[vars]
TCAD_YEAR = "2025"
FRONTEND_URL = "https://alephatx.info"

# D1 database (replaces Hyperdrive → Render PostgreSQL)
[[d1_databases]]
binding = "DB"
database_name = "tcad-db"
database_id = "<your-database-id>"

# Workflows + Queues (unchanged)
[[workflows]]
binding = "SCRAPER_WORKFLOW"
name = "scraper-workflow"
class_name = "ScraperWorkflow"

[[queues.producers]]
queue = "tcad-scraper-jobs"
binding = "SCRAPER_QUEUE"

[[queues.consumers]]
queue = "tcad-scraper-jobs"
max_batch_size = 1
max_retries = 3
dead_letter_queue = "tcad-scraper-dlq"

# KV namespaces (unchanged)
[[kv_namespaces]]
binding = "TOKEN_CACHE"
id = "df1bbaf6c7d94db58f9669410b7e6e1d"

[[kv_namespaces]]
binding = "RESPONSE_CACHE"
id = "5eec76ee553e43af892876e9069a74d5"

# Cron triggers (unchanged)
[triggers]
crons = [
  "*/4 * * * *",
  "0 * * * *",
  "0 3 * * *",
  "0 */6 * * *",
]

# Route (unchanged)
[[routes]]
pattern = "api.alephatx.info/*"
zone_name = "alephatx.info"
```

---

## Phase 3: Data Migration

### 3.1 Export from PostgreSQL

Run from `server/` directory. This exports INSERT statements compatible with SQL-based import:

```bash
doppler run -- pg_dump "$DATABASE_URL" \
  --data-only \
  --inserts \
  --no-owner \
  --no-privileges \
  --rows-per-insert=1 \
  --table=properties \
  --table=scrape_jobs \
  --table=monitored_searches \
  --table=search_term_analytics \
  --table=api_usage_logs \
  > /tmp/tcad-pg-dump.sql
```

The `--rows-per-insert=1` flag ensures each INSERT has one row, simplifying the transform step.

### 3.2 Transform SQL for SQLite

Create `scripts/pg-to-d1-transform.ts`:

```typescript
/**
 * Transforms pg_dump output to D1-compatible SQL.
 *
 * Changes:
 *  - Remove SET statements, pg_catalog references, schema prefixes
 *  - Convert boolean TRUE/FALSE to 1/0
 *  - Convert PostgreSQL array literals '{...}' to JSON '["..."]'
 *  - Convert timestamp values to ISO 8601 strings (already in ISO format from pg_dump)
 *  - Remove type casts (::text, ::integer, etc.)
 *  - Split into batch files of N rows each (D1 import timeout is 30s)
 */

import { readFileSync, writeFileSync } from "node:fs";

const BATCH_SIZE = 5000;
const inputFile = process.argv[2];
const outputPrefix = process.argv[3] || "/tmp/tcad-d1-batch";

if (!inputFile) {
  console.error("Usage: npx tsx scripts/pg-to-d1-transform.ts <input.sql> [output-prefix]");
  process.exit(1);
}

const input = readFileSync(inputFile, "utf-8");
const lines = input.split("\n");

const transformed: string[] = [];

for (const line of lines) {
  // Skip PostgreSQL-specific directives
  if (line.startsWith("SET ") ||
      line.startsWith("SELECT pg_catalog.") ||
      line.startsWith("--") ||
      line.trim() === "") {
    continue;
  }

  let sql = line;

  // Remove type casts
  sql = sql.replace(/::(text|integer|bigint|boolean|timestamp|float|double precision|numeric)/gi, "");

  // Convert boolean literals
  sql = sql.replace(/\bTRUE\b/g, "1");
  sql = sql.replace(/\bFALSE\b/g, "0");

  // Convert PostgreSQL array literals: '{id1,id2}' -> '["id1","id2"]'
  sql = sql.replace(/'\{([^}]*)\}'/g, (_, contents: string) => {
    if (!contents) return "'[]'";
    const items = contents.split(",").map((s: string) => `"${s.trim()}"`);
    return `'[${items.join(",")}]'`;
  });

  // Convert public.table_name to just table_name
  sql = sql.replace(/\bpublic\./g, "");

  transformed.push(sql);
}

// Split into batch files
for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
  const batch = transformed.slice(i, i + BATCH_SIZE);
  const batchNum = String(Math.floor(i / BATCH_SIZE)).padStart(4, "0");
  const filename = `${outputPrefix}-${batchNum}.sql`;
  writeFileSync(filename, batch.join("\n"));
  console.log(`Wrote ${batch.length} statements to ${filename}`);
}

console.log(`Total: ${transformed.length} statements in ${Math.ceil(transformed.length / BATCH_SIZE)} files`);
```

Run:

```bash
npx tsx scripts/pg-to-d1-transform.ts /tmp/tcad-pg-dump.sql /tmp/tcad-d1-batch
```

### 3.3 Import to D1

```bash
cd workers/tcad-api

# Import each batch file
for f in /tmp/tcad-d1-batch-*.sql; do
  echo "Importing $f..."
  npx wrangler d1 execute tcad-db --remote --file "$f"
done
```

Each batch import runs within D1's 30-second timeout. If a batch fails:
- Check the error message — usually a type mismatch or constraint violation
- Fix the offending row in the SQL file
- Re-run only the failed batch

### 3.4 Validate Import

```bash
cd workers/tcad-api

npx wrangler d1 execute tcad-db --remote --command "
  SELECT 'properties' as tbl, count(*) as cnt FROM properties
  UNION ALL SELECT 'scrape_jobs', count(*) FROM scrape_jobs
  UNION ALL SELECT 'monitored_searches', count(*) FROM monitored_searches
  UNION ALL SELECT 'search_term_analytics', count(*) FROM search_term_analytics
  UNION ALL SELECT 'api_usage_logs', count(*) FROM api_usage_logs
"
```

Compare against Phase 0.1 counts. All should match exactly.

### 3.5 Validate Data Integrity

```bash
# Spot-check a known property
npx wrangler d1 execute tcad-db --remote \
  --command "SELECT * FROM properties WHERE property_id = '<known-id>' AND year = 2025 LIMIT 1"

# Verify unique constraint
npx wrangler d1 execute tcad-db --remote \
  --command "SELECT property_id, year, count(*) as c FROM properties GROUP BY property_id, year HAVING c > 1"
# Should return 0 rows

# Verify array field format
npx wrangler d1 execute tcad-db --remote \
  --command "SELECT id, new_property_ids FROM scrape_jobs WHERE new_property_ids != '[]' LIMIT 3"
# Should show JSON arrays like '["id1","id2"]'
```

---

## Phase 4: Testing

### 4.1 Local Development

```bash
cd workers/tcad-api

# Generate Prisma client for SQLite
npx prisma generate

# Start local dev (uses local D1 SQLite file)
npx wrangler dev
```

Local D1 uses a SQLite file at `.wrangler/state/v3/d1/`. You can seed it:

```bash
npx wrangler d1 execute tcad-db --local --file prisma/migrations/0001_init.sql

# Seed with test data
npx wrangler d1 execute tcad-db --local --command "
  INSERT INTO properties (id, property_id, name, prop_type, city, property_address,
    assessed_value, appraised_value, geo_id, description, search_term,
    scraped_at, created_at, updated_at, year)
  VALUES (
    '$(uuidgen)', 'TEST-001', 'Test Owner', 'A', 'AUSTIN',
    '123 Test St', 250000, 300000, 'GEO-001', 'Test property',
    'test-term', '$(date -u +%Y-%m-%dT%H:%M:%SZ)', '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    '$(date -u +%Y-%m-%dT%H:%M:%SZ)', 2025
  )
"
```

### 4.2 Functional Test Checklist

| Test | Endpoint/Code | What to Verify |
|------|--------------|----------------|
| Health check | `GET /health` | Returns `propertyCount` from D1 |
| List properties | `GET /api/properties` | Pagination, filtering, sorting work |
| Get job status | `GET /api/properties/jobs/:id` | Single record lookup works |
| Search (text) | `GET /api/properties?searchTerm=Smith` | Case-insensitive contains works |
| Search (AI) | `POST /api/properties/search` | Claude-generated whereClause works on SQLite |
| Value filter | `GET /api/properties?minValue=100000&maxValue=500000` | Numeric range filter works |
| City filter | `GET /api/properties?city=AUSTIN` | Exact match filter works |
| Stats | `GET /api/properties/stats` | `aggregate`, `groupBy`, `count` work |
| History | `GET /api/properties/history` | Scrape job listing works |
| Monitor CRUD | `POST/GET /api/properties/monitor` | Upsert + list work |
| Scrape job | `POST /api/properties/scrape` | Queue -> Workflow -> D1 upsert pipeline works |
| API usage stats | `GET /api/usage/stats` | Raw SQL date aggregation works |
| API usage logs | `GET /api/usage/logs` | Paginated logs work |
| API usage alerts | `GET /api/usage/alerts` | Date comparisons with ISO strings work |
| Stale cleanup cron | `0 * * * *` | `updateMany` with date comparison works |
| Monitored searches cron | `0 */6 * * *` | `findMany` + queue send + date update works |

### 4.3 Load Testing

The single-writer bottleneck is the highest-risk D1 constraint for this workload. Test:

```bash
# Enqueue 5 concurrent scrape jobs
for term in "Smith" "Johnson" "Williams" "Jones" "Brown"; do
  curl -X POST "http://localhost:8787/api/properties/scrape" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $TCAD_API_KEY" \
    -d "{\"searchTerm\": \"$term\"}" &
done
wait
```

Monitor for:
- D1 `overloaded` errors in `wrangler tail` output
- Workflow step failures in `wrangler workflows instances list scraper-workflow`
- Latency spikes on concurrent reads during writes

### 4.4 E2E Tests

The 126 Playwright E2E tests hit the API surface and should not require changes if they don't directly test database internals. Run:

```bash
npm run test:e2e
```

If any tests construct dates or expect PostgreSQL-specific response shapes, update the assertions.

---

## Phase 5: Cutover

### 5.1 Pre-Cutover Checklist

- [ ] All Phase 4 tests pass
- [ ] D1 data matches PostgreSQL row counts (Phase 3.4)
- [ ] Spot-checked data integrity (Phase 3.5)
- [ ] `wrangler deploy --dry-run` succeeds
- [ ] No active scrape jobs in queue (`npx wrangler queues list`)
- [ ] Team notified of maintenance window

### 5.2 Deploy Sequence

```bash
cd workers/tcad-api

# Step 1: Deploy with D1 binding
npx wrangler deploy

# Step 2: Verify health
curl -s "https://api.alephatx.info/health" | jq
# Expected: {"status":"ok","propertyCount":N,"runtime":"cloudflare-workers"}

# Step 3: Verify a property search
curl -s "https://api.alephatx.info/api/properties?city=AUSTIN&limit=5" | jq '.pagination.total'

# Step 4: Verify stats endpoint
curl -s "https://api.alephatx.info/api/properties/stats" | jq '.totalProperties'

# Step 5: Test a scrape (small term)
curl -X POST "https://api.alephatx.info/api/properties/scrape" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TCAD_API_KEY" \
  -d '{"searchTerm": "Zilker"}'
```

### 5.3 Monitor (48 hours)

```bash
# Live logs
cd workers/tcad-api && npx wrangler tail

# Check for errors
npx wrangler tail --format json | jq 'select(.logs[].level == "error")'
```

Watch for:
- D1 `overloaded` errors (write contention)
- `SQLITE_CONSTRAINT` errors (data type mismatches)
- Slow queries (>5s) indicating missing indexes
- Cron handler failures (stale cleanup, token refresh, monitored searches)

### 5.4 Rollback Plan

If critical issues are found:

1. **Revert code**: `git revert` the D1 migration commit
2. **Redeploy**: `npx wrangler deploy` (restores Hyperdrive binding)
3. **Verify**: `curl -s "https://api.alephatx.info/health" | jq`

The PostgreSQL database on Render is untouched during migration — no data was deleted from it. Rollback restores the previous code that connects to it via Hyperdrive.

**Keep the Render database running for at least 2 weeks post-cutover** as a safety net.

---

## Phase 6: Cleanup

After 2 weeks of stable D1 operation:

### 6.1 Remove PostgreSQL Dependencies

```bash
cd workers/tcad-api
npm uninstall @prisma/adapter-pg pg
# Verify: npm ls @prisma/adapter-pg → should not be found
```

### 6.2 Remove Hyperdrive Config

Remove from `wrangler.toml`:

```toml
# DELETE THIS BLOCK:
# [[hyperdrive]]
# binding = "HYPERDRIVE"
# id = "e0406d51a79a4440863e0c608390a613"
```

### 6.3 Delete Hyperdrive Configuration

```bash
npx wrangler hyperdrive delete tcad-db
```

### 6.4 Update Documentation

Files to update:
- `CLAUDE.md` — remove all Render/Hyperdrive references, update architecture diagram
- `docs/CLOUDFLARE_MIGRATION_PLAN.md` — mark as completed, add D1 notes
- `docs/SETUP.md` — update local dev instructions
- `docs/MONITORING.md` — update debugging steps
- `README.md` — update architecture section

### 6.5 Update Scripts

Scripts in `scripts/` that use `DATABASE_URL` to connect to PostgreSQL will no longer work. Options:
- Rewrite to use `wrangler d1 execute` commands
- Create a D1 HTTP API wrapper for script access
- Keep `server/` directory with PostgreSQL connection for analytical queries (read-only)

### 6.6 Cancel Render Database

After confirming all data is safely in D1 and the application is stable:

1. Take a final `pg_dump` backup
2. Store backup in R2 or local
3. Cancel the Render PostgreSQL instance

---

## Appendix A: File-by-File Change Reference

### Files Requiring Changes

| File | Changes | Effort |
|------|---------|--------|
| `workers/tcad-api/src/db.ts` | Replace `PrismaPg` with `PrismaD1`, change arg type | Low |
| `workers/tcad-api/src/bindings.d.ts` | Replace `HYPERDRIVE: Hyperdrive` with `DB: D1Database` | Low |
| `workers/tcad-api/src/index.ts` | Update `createPrisma` calls (3 sites), DateTime handling (2 sites) | Medium |
| `workers/tcad-api/src/workflows/scraper.workflow.ts` | **Complete rewrite of bulkUpsert**, DateTime handling, array serialization, createPrisma calls | **High** |
| `workers/tcad-api/src/controllers/property.ts` | Remove `mode: "insensitive"`, DateTime comparisons | Medium |
| `workers/tcad-api/src/controllers/api-usage.ts` | Rewrite raw SQL query, DateTime handling | Medium |
| `workers/tcad-api/src/lib/claude.service.ts` | Update system prompt, add whereClause sanitizer | Medium |
| `workers/tcad-api/src/utils/property-transformers.ts` | Remove `.toISOString()` calls (dates are already strings) | Low |
| `workers/tcad-api/src/utils/constants.ts` | Add `UPSERT_MICRO_CHUNK_SIZE`, `UPSERT_COLUMNS` | Low |
| `workers/tcad-api/wrangler.toml` | Replace Hyperdrive with D1 binding | Low |
| `workers/tcad-api/package.json` | Swap `@prisma/adapter-pg` for `@prisma/adapter-d1`, remove `pg` | Low |
| `workers/tcad-api/prisma/schema.prisma` | Full rewrite for SQLite provider | Medium |

### Files Requiring NO Changes

| File | Why |
|------|-----|
| `workers/tcad-api/src/middleware/auth.ts` | No database interaction |
| `workers/tcad-api/src/utils/error-helpers.ts` | No database interaction |
| `workers/tcad-api/src/types/property.types.ts` | Zod schemas are database-agnostic |
| `workers/tcad-api/tsconfig.json` | No database-specific config |
| `src/` (frontend) | Frontend is database-agnostic |
| `e2e/` (E2E tests) | Test the HTTP API surface, not the database |
| `server/` (legacy) | Reference only — not deployed |

---

## Appendix B: D1 Constraints Quick Reference

| Constraint | Value | Impact on TCAD |
|-----------|-------|---------------|
| Max database size | 10 GB (hard, not increasable) | ~500K properties at ~2KB/row = ~1 GB. Safe now, limited growth headroom |
| Max bound params per query | 100 | Bulk upsert must chunk to 7 rows/statement (14 cols x 7 = 98) |
| Max query execution time | 30 seconds | Individual queries fine; large batch imports may need splitting |
| Max queries per Worker invocation | 1,000 (paid) | A 5,000-row scrape = ~714 micro-inserts + ~100 existence checks. Close to limit |
| Max row size | 2 MB | Property rows are ~2 KB — no issue |
| Max columns per table | 100 | `properties` has 14 columns — no issue |
| Max SQL statement length | 100 KB | Individual 7-row INSERTs are well under |
| Max LIKE pattern length | 50 bytes | Search terms capped at 100 chars in Zod — verify subset under 50 |
| Write model | Single-writer, serialized | Concurrent scrape jobs queue writes. Under heavy load: 200-500ms latency, can spike to 3s |
| Read model | Regional replicas (GA) | Fast reads. Cache misses route to primary |
| Boolean storage | INTEGER (0/1) | Prisma handles automatically |
| Date storage | TEXT or INTEGER | Using ISO 8601 TEXT strings |
| Rows read pricing | Rows scanned, not returned | Unindexed queries on 500K rows = 500K reads per query |

### D1 Pricing (Workers Paid, $5/mo base)

| Resource | Included | Overage |
|----------|----------|---------|
| Rows read | 25B / month | $0.001 / million |
| Rows written | 50M / month | $1.00 / million |
| Storage | 5 GB | $0.75 / GB-month |

---

## Appendix C: SQL Translation Reference

### Common Patterns

```sql
-- UUID generation (app-side)
-- PostgreSQL: gen_random_uuid() or Prisma @default(uuid())
-- D1: crypto.randomUUID() in Workers JS, pass as TEXT

-- Date insertion
-- PostgreSQL: NOW() or new Date()
-- D1: new Date().toISOString() → stored as TEXT '2026-03-30T12:00:00.000Z'

-- Date comparison
-- PostgreSQL: WHERE created_at >= '2026-03-01'
-- D1: WHERE created_at >= '2026-03-01T00:00:00.000Z'  (ISO 8601 sorts lexicographically)

-- Date extraction
-- PostgreSQL: DATE(timestamp)
-- D1: date(timestamp)  (lowercase SQLite function)

-- Case-insensitive search
-- PostgreSQL: WHERE name ILIKE '%smith%'
-- D1: WHERE name LIKE '%smith%'  (case-insensitive for ASCII by default)

-- Boolean
-- PostgreSQL: WHERE success = TRUE
-- D1: WHERE success = 1

-- Type casting
-- PostgreSQL: CAST(COUNT(*) AS bigint)
-- D1: COUNT(*)  (just remove the cast)

-- Array column
-- PostgreSQL: '{id1,id2,id3}'::text[]
-- D1: '["id1","id2","id3"]'  (JSON text)

-- Parameterized queries
-- PostgreSQL: $1, $2, $3
-- D1: ?, ?, ?

-- Upsert (same syntax)
-- Both: INSERT INTO t (...) VALUES (...) ON CONFLICT (col) DO UPDATE SET ...

-- Returning (same syntax)
-- Both: ... RETURNING col1, col2

-- xmax insert detection (PostgreSQL-only)
-- PostgreSQL: RETURNING (xmax = 0) AS inserted
-- D1: Pre-query SELECT to check existence, then diff after upsert

-- Conditional SQL fragments
-- PostgreSQL (Prisma): ${condition ? Prisma.sql`AND col = ${val}` : Prisma.empty}
-- D1: Build SQL string conditionally, use db.prepare().bind()

-- Batch execution
-- PostgreSQL: Single statement with many rows
-- D1: db.batch([stmt1, stmt2, ...])  (executes in single transaction)
```

### Full Upsert Translation

```sql
-- BEFORE (PostgreSQL, scraper.workflow.ts)
INSERT INTO properties (
  property_id, name, prop_type, city, property_address,
  assessed_value, appraised_value, geo_id, description,
  search_term, year, scraped_at, created_at, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 0), $8, $9, $10, $11, $12, $13, $14),
       ($15, $16, ... $28),
       ... (up to 500 rows)
ON CONFLICT (property_id, year) DO UPDATE SET
  name = EXCLUDED.name,
  -- ...
RETURNING property_id, (xmax = 0) AS inserted

-- AFTER (D1 — per micro-chunk of 7 rows)
INSERT INTO properties (
  property_id, name, prop_type, city, property_address,
  assessed_value, appraised_value, geo_id, description,
  search_term, year, scraped_at, created_at, updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
       ... (up to 7 rows)
ON CONFLICT (property_id, year) DO UPDATE SET
  name = excluded.name,
  -- ...
-- Note: no RETURNING with xmax — use pre-query existence check instead
```

Key differences:
- `$N` params become `?` positional params
- `EXCLUDED` becomes `excluded` (SQLite is case-insensitive here but convention differs)
- Max 7 rows per statement (98 params), executed via `db.batch()` for transactional guarantees
- No `COALESCE` needed if the application layer handles null-to-0 conversion before building params
