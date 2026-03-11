# Test Mock Path Convention

**Created**: 2026-03-11
**Applies to**: All test files under `scripts/` and `scripts/lib/__tests__/`

---

## Problem

After the `scripts/` promotion refactor (`75918ca`), source files under `scripts/lib/` import server-side modules using paths like:

```typescript
// scripts/lib/queue-utils.ts
import { scraperQueue } from "../../server/src/queues/scraper.queue";
import { config } from "../../server/src/config";
```

Test files that mock these imports must use paths that **Vitest resolves to the same module**. Vitest resolves `vi.mock(path)` relative to the test file's directory — not the source file's directory.

Using the wrong path silently creates a separate module that is never injected, so the real module loads instead. This caused 23 test failures:

| File | Failures | Symptom |
|------|----------|---------|
| `scripts/lib/__tests__/backfill-utils.test.ts` | 2 | DB connects to `localhost:5432` (prisma mock bypassed) |
| `scripts/lib/__tests__/backfill-runner.test.ts` | 8 | `process.exit(1)` — config mock bypassed, real `TCAD_YEAR=2026` loaded |
| `scripts/lib/__tests__/queue-utils.test.ts` | 7 | Queue mock bypassed, real Redis connection attempted |
| `scripts/__tests__/generate-next-200-terms.test.ts` | 6 | `recentJobs is not iterable` — missing default on `scrapeJob.findMany` mock |

---

## Correct Mock Paths

### Tests in `scripts/lib/__tests__/`

Source files at `scripts/lib/*.ts` resolve imports relative to `scripts/lib/`. Tests at `scripts/lib/__tests__/*.test.ts` must go **one extra level up** with `../` to compensate:

| Import in source | Mock path in test |
|-----------------|-------------------|
| `"../../server/src/lib/prisma"` | `"../../../server/src/lib/prisma"` |
| `"../../server/src/config"` | `"../../../server/src/config"` |
| `"../../server/src/queues/scraper.queue"` | `"../../../server/src/queues/scraper.queue"` |
| `"../../server/src/utils/error-helpers"` | `"../../../server/src/utils/error-helpers"` |
| `"../../utils/constants"` | `"../../../utils/constants"` |
| `"./queue-utils"` | `"../queue-utils"` |
| `"./backfill-utils"` | `"../backfill-utils"` |

### Tests in `scripts/__tests__/`

Source files at `scripts/*.ts` resolve imports relative to `scripts/`. Tests at `scripts/__tests__/*.test.ts` must go **one extra level up**:

| Import in source | Mock path in test |
|-----------------|-------------------|
| `"../server/src/lib/prisma"` | `"../../server/src/lib/prisma"` |
| `"../server/src/queues/scraper.queue"` | `"../../server/src/queues/scraper.queue"` |
| `"./lib/queue-utils"` | `"../lib/queue-utils"` |
| `"./lib/searched-terms"` | `"../lib/searched-terms"` |

---

## Mock Default Values

**Always set a default return value for every mock function in `beforeEach`**, especially after `vi.clearAllMocks()` which resets all mocks to return `undefined`.

Missing defaults cause subtle "not iterable" errors when source code iterates over `undefined`:

```typescript
// BAD — mockScrapeJobFindMany returns undefined after clearAllMocks()
beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockGroupBy.mockResolvedValue([]);
  // mockScrapeJobFindMany never set → undefined → "not iterable"
});

// GOOD
beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockGroupBy.mockResolvedValue([]);
  mockScrapeJobFindMany.mockResolvedValue([]);  // always set all mocks
});
```

---

## Quick Check

If a test fails with any of these symptoms, check mock paths first:

- `Can't reach database server at localhost:5432` — Prisma mock bypassed
- `process.exit unexpectedly called with "1"` — config mock bypassed (real year loaded)
- `X is not iterable` — mock returns `undefined` instead of `[]`
- `connect ECONNREFUSED` — queue/Redis mock bypassed

Verify module resolution manually by tracing the relative path:

```bash
# From project root — resolve a relative path from a test file's directory
realpath scripts/lib/__tests__/../../../server/src/config
```

---

## Refactor History

| Commit | Change | Impact |
|--------|--------|--------|
| `75918ca` | Promoted `scripts/` to repo root | All `server/src/*` import paths in `scripts/lib/` gained an extra `../` segment — test mock paths lagged behind |
| `2026-03-11` | Fixed mock paths in 3 test files + `scrapeJob.findMany` default | 23 failures → 0 failures (680/680 passing) |
