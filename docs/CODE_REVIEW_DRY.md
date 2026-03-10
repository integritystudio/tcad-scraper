# DRY & Robustness Code Review

**Date**: 2026-02-08 | **Reviewer**: Claude Code (code-reviewer agent) | **Scope**: Full codebase

---

## Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| DRY      | 1        | 1    | 3      | 1   | 6     |
| Robustness | 2      | 2    | 3      | 2   | 9     |
| **Total** | **3**   | **3**| **6**  | **3**| **15** |

---

## 1. DRY Findings

### ~~CRITICAL: Enqueue Script Duplication (~2,400 lines)~~ — **RESOLVED** (2026-02-08)

**Files**: ~~`server/src/scripts/enqueue-*.ts` (16 files)~~

~~16 nearly identical enqueue scripts~~ Consolidated into `enqueue-batch.ts` + `batch-configs.ts` with 18 batch types. See changelog/2026-02-08.

```typescript
// enqueue-llc-batch.ts
const LLC_TERMS = ["LLC", "LLC.", "L.L.C.", ...];
async function enqueueLLCBatch() {
  return enqueueBatchGeneric({
    batchName: "LLC", emoji: "...", terms: LLC_TERMS,
    userId: "llc-batch-enqueue",
  });
}
enqueueLLCBatch()
  .then(() => process.exit(0))
  .catch((error) => { logger.error({ err: error }, "Script failed:"); process.exit(1); });

// enqueue-trust-batch.ts — nearly identical structure
```

**Recommendation**: Consolidate to a single config file + parameterized runner.

```typescript
// scripts/config/batch-terms.ts
export const BATCH_CONFIGS = {
  llc: { batchName: "LLC", terms: [...], userId: "llc-batch-enqueue" },
  trust: { batchName: "Trust & Estate", terms: [...], userId: "trust-batch-enqueue" },
  // ... all other batches
};

// scripts/enqueue-batch.ts
const batchType = process.argv[2];
enqueueBatchGeneric(BATCH_CONFIGS[batchType])
  .then(() => process.exit(0))
  .catch((error) => { logger.error({ err: error }, "Script failed:"); process.exit(1); });
```

**Impact**: 16 files -> 2 files, eliminates ~2,400 duplicate lines.

---

### ~~HIGH: Error Message Formatting Duplication (25+ files)~~ — **RESOLVED** (2026-02-08)

**Files**: Throughout `server/src/` (25+ occurrences)

Same pattern repeated everywhere:

```typescript
error instanceof Error ? error.message : String(error)
```

Found in: `tcad-scraper.ts` (5x), `scraper.queue.ts` (4x), `token-refresh.service.ts` (2x), 22+ more files.

**Recommendation**: Extract to shared utility.

```typescript
// utils/error-helpers.ts
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

**Impact**: Eliminates 50+ duplicate lines, single source of truth.

---

### ~~MEDIUM: Browser Launch Config Duplication~~ — **MOOT** (Playwright removed 2026-02-26)

~~Playwright launch options duplication in `tcad-scraper.ts` and `token-refresh.service.ts`.~~
Playwright removed in commit `934e22e`. Scraping is now API-direct. Token refresh uses Cloudflare Worker.

---

### MEDIUM: Property Transformation Duplication

**Files**: `server/src/controllers/property.controller.ts:121-136` and `:267-282`

Identical camelCase-to-snake_case property mapping appears twice (in `getProperties()` and `naturalLanguageSearch()`).

**Recommendation**: Extract `transformPropertyToSnakeCase(prop: Property)` to `utils/property-transformers.ts`.

**Impact**: Eliminates 30+ duplicate lines.

---

### ~~MEDIUM: humanDelay Function Duplication~~ — **RESOLVED** (2026-02-08)

~~`dom-scraper.ts` (fallback browser scraper) contained duplicate `humanDelay` implementation.~~
Playwright removed Feb 2026. DOM scraper no longer exists. `humanDelay` utility extracted to `utils/timing.ts` for use in API-direct scraper.

---

### LOW: Controller Method Binding Pattern

**Files**: `server/src/routes/property.routes.ts` (9 occurrences)

Repetitive `.bind(propertyController)` on every route handler. Low priority — works fine, just noisy.

---

## 2. Robustness Findings

### CRITICAL: No Database Connection Resilience

**Files**: `server/src/lib/prisma.ts`

No retry logic, health checks, or auto-reconnect for Prisma. If database connection drops, all DB operations fail permanently until process restart.

**Missing**:
- Connection retry with exponential backoff
- Periodic health check (`SELECT 1`)
- Auto-reconnect on disconnect
- Circuit breaker for cascading failure prevention

**Recommendation**: Wrap `PrismaClient` in a resilient class with:
- `handleDisconnect()` — exponential backoff retry (max 5 attempts)
- `startHealthCheck()` — `SELECT 1` every 30 seconds
- `reconnect()` — `$connect()` with error handling
- Expose `healthy` flag for health endpoint

**Impact**: Prevents total system failure on VPN drop.

---

### ~~CRITICAL: Browser Context Leaks~~ — **MOOT** (Playwright removed 2026-02-26)

~~Browser contexts created in retry loops without guaranteed cleanup.~~
Playwright removed in commit `934e22e`. No browser contexts in codebase.

---

### HIGH: No Property Data Validation Before DB Insert

**Files**: `server/src/queues/scraper.queue.ts:84-108`

Raw scraped data goes directly into parameterized SQL with no validation:

```typescript
params.push(
  property.propertyId,  // could be null/undefined
  property.name,        // could be extremely long
  property.propType,    // no type check
  // ...
);
```

**Missing**: Required field checks, length truncation, numeric validation, null safety.

**Recommendation**: Add `validatePropertyData()` utility — check required fields, truncate strings, validate numerics, default nulls.

**Impact**: Prevents DB errors from malformed scrape data.

---

### HIGH: Token Refresh Timeout Doesn't Cancel Operations — **ARCHITECTURE CHANGED**

~~`Promise.race` rejects on timeout, but Playwright operations continue.~~
Token refresh now uses a simple `fetch()` to the Cloudflare Worker. No `Promise.race` or browser context. The timeout concern is now a network timeout on the fetch call, which is bounded by the OS TCP timeout. No code change needed.

---

### MEDIUM: Redis Cache Error Indistinguishable from Miss

**Files**: `server/src/lib/redis-cache.service.ts:77-100`

Both cache miss and connection error return `null` — callers can't distinguish between "key doesn't exist" and "Redis is down."

**Recommendation**: Add `CacheResult<T>` type with `status` enum (`HIT`, `MISS`, `ERROR`, `DISCONNECTED`). Add circuit breaker (5 failures -> open for 60s -> half-open retry).

---

### MEDIUM: Token Refresh Doesn't Trigger Immediate Job Retry

**Files**: `server/src/queues/scraper.queue.ts:209-225`

On 401, token refreshes successfully but job still fails and waits for Bull's exponential backoff (2-14 seconds). Token is already refreshed — job could retry immediately.

**Recommendation**: After successful token refresh, attempt immediate retry before throwing to Bull.

**Impact**: Reduces retry latency, improves scraping throughput.

---

### MEDIUM: Prisma groupBy _count Access May Be Wrong

**Files**: `server/src/controllers/property.controller.ts:231-241`

`cityStats[0]._count` may be `{ city: number }` (object), not a plain number. Prisma `groupBy` returns `_count` as an object keyed by the counted field.

```typescript
// Potentially incorrect:
{ name: cityStats[0].city, count: cityStats[0]._count }

// Correct:
{ name: cityStats[0].city, count: cityStats[0]._count.city || 0 }
```

---

### LOW: 39 Console Statements in Production Code

**Files**: Throughout `server/src/` (excluding browser suppression utilities)

`console.log/warn/error` bypasses structured Pino logger, breaking log aggregation and monitoring.

**Recommendation**: Replace all with `logger.info/warn/error`.

---

### LOW: No Express Request Timeout

**Files**: `server/src/index.ts`

No global request timeout configured. Long-running requests (natural language search) could hang indefinitely.

**Recommendation**: Add timeout middleware (30s default, configurable per-route).

---

## 3. Priority Action Plan

### Phase 1: Critical (immediate)
1. Add Prisma connection resilience (`lib/prisma.ts`) — open
2. ~~Fix browser context lifecycle~~ — MOOT (Playwright removed 2026-02-26)
3. ~~Consolidate 16 enqueue scripts -> 2 files~~ — DONE (2026-02-08)

### Phase 2: High (next sprint)
4. ~~Extract `getErrorMessage()` utility~~ — DONE (2026-02-08)
5. Add property data validation before DB insert — open
6. ~~Fix token refresh timeout cancellation~~ — MOOT (architecture changed, now fetch-based)

### Phase 3: Medium (backlog)
7. ~~Extract browser factory~~ — MOOT | ~~property transformer, humanDelay~~ — DONE (2026-02-08)
8. Add Redis circuit breaker — open
9. Add immediate retry on token refresh after 401 — open
10. Fix Prisma groupBy `_count` access — open

### Phase 4: Low (when convenient)
11. Replace remaining console statements with logger — open
12. Add Express request timeout middleware — open

---

## 4. Positive Observations

- Consistent use of `unknown` error typing (not `any`)
- Nov 2025 bug fixes demonstrate solid error handling improvements
- 631/632 tests passing (as of 2026-03-09), 0 `any` in production code
- All `any` usages eliminated (see changelog/2026-02-08)
- Good separation of concerns (controllers, services, queues, routes)
