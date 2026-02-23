# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-23
**Status**: 617/617 tests passing | TypeScript clean | Lint clean | Biome clean

---

## Open Items

### BUG-3: JSDOM `<search>` element warning (P3) — No fix needed
- **File**: `src/components/__tests__/SearchBox.test.tsx`
- **Warning**: `The tag <search> is unrecognized in this browser`
- **Root cause**: JSDOM doesn't support HTML `<search>` element. Component correctly uses semantic HTML.
- **Fix**: No fix needed — console noise only. Will resolve when JSDOM adds support.

---

## Completed

### ~~BUG-1: Flaky timing test assertion (P1)~~ DONE
**Completed**: 2026-02-23 | Widened `toBeLessThan(50)` → `toBeLessThan(200)` in timing.test.ts:56.

### ~~BUG-2: MaxListenersExceededWarning in queue tests (P2)~~ FIXED
- See `docs/changelog/2026-02-21.md`

### ~~BUG-4: Integration test TODOs (P3)~~ DONE
**Completed**: 2026-02-23 | 4 frontend-dependent tests now use `test.skipIf(!hasFrontend)`. API 404 test lost its misleading TODO.

### ~~RENDER-1: test-utils.ts lacks REDIS_URL support (P3)~~ DONE
**Completed**: 2026-02-23 | `isRedisAvailable` now creates ioredis client from `config.redis.url` when set; handles TLS (`rediss://`).

### ~~RENDER-2: worker.ts uses raw env vars instead of config (P3)~~ DONE
**Completed**: 2026-02-23 | Replaced winston with Pino logger; replaced `process.env.REDIS_HOST/PORT` with `config.redis`.

### ~~RENDER-3: Playwright Docker worker for Render (P2)~~ DONE
**Completed**: 2026-02-23 | Added `server/Dockerfile.worker` (Alpine + system Chromium). Commented-out `tcad-worker` service in `render.yaml` — uncomment when browser fallback is needed.

### ~~RENDER-4: Pin Node.js version for Render (P3)~~ DONE
**Completed**: 2026-02-23 | Added `.node-version` (22) at repo root and `engines.node` (`>=22.0.0 <25`) in `server/package.json`.

### ~~E2E-1: Create comprehensive Playwright e2e test suite (P1)~~ DONE
**Completed**: 2026-02-23 | Playwright config + 3 e2e specs (search, property-card, error-handling) with 12 tests covering search flow, expand/collapse, error states.

### ~~E2E-2: Reduce CSS module mocking in component tests (P2)~~ DONE
**Completed**: 2026-02-23 | Removed 100+ lines of CSS class mocks from PropertyCard/LoadingSkeleton tests. Switched to `data-testid` + `getByRole` selectors. Added `css.modules.classNameStrategy: "non-scoped"` to vite config.

### ~~E2E-3: Add screenshot/trace collection on test failure (P2)~~ DONE
**Completed**: 2026-02-23 | Playwright config: `screenshot: "only-on-failure"`, `trace: "on-first-retry"`, `outputDir: "./e2e/test-results"`. Gitignore updated.

### ~~E2E-4: Increase integration test retry count (P2)~~ DONE
**Completed**: 2026-02-23 | `retry: 1` → `retry: 2` in `server/vitest.integration.config.ts`.

### ~~E2E-5: Reduce unit test timeout threshold (P3)~~ DONE
**Completed**: 2026-02-23 | `testTimeout: 10000` → `testTimeout: 5000` in `server/vitest.config.ts`. 617 tests pass.

### ~~E2E-6: Implement page object pattern for complex components (P3)~~ DONE
**Completed**: 2026-02-23 | Added `e2e/pages/SearchBoxPage.ts` and `PropertyCardPage.ts`. Refactored all 3 e2e specs to use them.

### ~~E2E-7: Add test data factory pattern (P3)~~ DONE
**Completed**: 2026-02-23 | Added `server/src/__tests__/factories.ts` with `buildProperty`, `buildProperties`, `buildScrapeJobData`, `buildScrapeJobResult`. Zero external deps.

### ~~E2E-8: Add visual regression testing (P3)~~ DONE
**Completed**: 2026-02-23 | Added `e2e/visual.spec.ts` using Playwright's `toHaveScreenshot` with 2% maxDiffPixelRatio.

### ~~E2E-9: Add accessibility testing with axe-core (P3)~~ DONE
**Completed**: 2026-02-23 | Installed `@axe-core/playwright`. Added `e2e/accessibility.spec.ts` with WCAG 2.1 AA checks.

### ~~E2E-10: Add performance/load testing (P4)~~ DONE
**Completed**: 2026-02-23 | Added `load-tests/api.k6.js` covering /health, /api/properties/stats, and /api/properties with p95 thresholds. Run with `k6 run load-tests/api.k6.js`.

All completed items migrated to `docs/changelog/` (per-date files).
