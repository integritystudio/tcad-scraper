# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-06
**Status**: 624/624 tests passing | TypeScript clean | Lint clean | Biome clean

---
## Open Items

### CRITICAL: TCAD API "Unexpected end of JSON input" failures (2026-03-06)

**Impact**: 20/120 jobs (17%) failed in latest batch with `All page sizes failed. Last: Unexpected end of JSON input`

**Symptoms**:
- TCAD API returns truncated/empty response bodies that fail `JSON.parse()`
- All 4 page sizes (1000 → 500 → 100 → 50) fail for the same term
- Affects prefix expansion terms (`Courtb`–`Courtz`, `TEXASa`–`TEXASd`) and short/nonsense terms (`A-A-A`, `EFPE`)
- Terms returning valid results (e.g. `Courtn` = 644, `Courty` = 195) succeed fine

**Error path**: `fetchPage()` → `res.text()` → `JSON.parse(trimmed)` throws → caught as `msg.includes("JSON")` → tries next smaller page size → all sizes exhausted → `All page sizes failed`

**Key code**: `server/src/lib/tcad-api-client.ts`
- `fetchPage()` (line 59): fetches and parses response
- `isTruncated()` (line 45): checks if response ends with `}` or `]` — but `Unexpected end of JSON` means `JSON.parse` itself failed, so truncation detection at line 87 may not catch all cases
- Page size fallback loop (line 116): tries PAGE_SIZES `[1000, 500, 100, 50]`
- Error aggregation (line 211): throws final error with last message only

**Investigation tasks**:
1. Log raw response body length and first/last 100 chars when JSON parse fails — currently only the error message is preserved, not the response content
2. Check if TCAD API returns empty body (length 0) vs truncated body vs HTML error page for these terms
3. Determine if this is a TCAD server-side issue (terms with no results return malformed JSON) or a network issue (response cut off)
4. Check HTTP status code — `fetchPage()` only throws on `!res.ok`, so these are HTTP 200 responses with bad bodies
5. Consider: should terms with 0 TCAD results be pre-filtered before enqueue? The API may not handle certain search patterns gracefully
6. Add structured error logging with response metadata (status, content-length header, body length, body preview) to `fetchPage()` catch path

**Related files**:
- `server/src/lib/tcad-api-client.ts` — core fetch + parse logic
- `server/src/lib/tcad-scraper.ts` — retry wrapper
- `server/src/queues/scraper.queue.ts` — job processing
- `server/src/scripts/requeue-all-failed-with-error-tracking.ts` — already categorizes this as "JSON Parsing Error"

### Code Review 02-27-2026 of commit 66dc363

  Low
  4. getJwtLifetime should guard exp > iat — STALE: function not found in current codebase; may have been removed in refactor
  6. Test vi.resetModules() could leak — DEFERRED: vi.resetModules() in afterEach is load-bearing for await import() pattern; removal breaks 4 tests. Needs per-test vi.isolateModules() refactor. -- `src/__tests__/App.test.tsx:59`

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 7 items migrated to [changelog/2026-03-06.md](../changelog/2026-03-06.md)
