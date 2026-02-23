# Backlog - Remaining Technical Debt

**Last Updated**: 2026-02-23
**Status**: 617/617 tests passing | TypeScript clean | Lint clean | Biome clean

---

## Open Items

### BUG-1: Flaky timing test assertion (P1)
- **File**: `server/src/utils/__tests__/timing.test.ts:56`
- **Test**: `should compute delay using Math.random formula`
- **Error**: `expected 137 to be less than 50` — `setTimeout(resolve, 20)` overshoots under system load
- **Root cause**: Upper bound assertion (50ms) too tight for a mocked 20ms delay; `Date.now()` imprecise under load
- **Fix**: Widen upper bound to 200ms or restructure to test formula without wall-clock timing

### ~~BUG-2: MaxListenersExceededWarning in queue tests (P2)~~ FIXED
- See `docs/changelog/2026-02-21.md`

### BUG-3: JSDOM `<search>` element warning (P3)
- **File**: `src/components/__tests__/SearchBox.test.tsx`
- **Warning**: `The tag <search> is unrecognized in this browser`
- **Root cause**: JSDOM doesn't support HTML `<search>` element. Component correctly uses semantic HTML.
- **Fix**: No fix needed — console noise only. Will resolve when JSDOM adds support.

### BUG-4: Integration test TODOs (P3)
- **File**: `server/src/__tests__/integration.test.ts`
- **Details**: 5 TODO comments about tests depending on frontend build files or error handling setup
- **Fix**: Implement conditional test setup or mark as known skips

#### RENDER-1: test-utils.ts lacks REDIS_URL support (P3)
**Priority**: P3 | **Source**: Render migration session (68701c6)
Test infrastructure in `server/src/__tests__/test-utils.ts` creates Redis connections using `config.redis.host`/`config.redis.port` only. Does not use `config.redis.url` when set. Low impact — tests run locally where host/port is always correct.

#### RENDER-2: worker.ts uses raw env vars instead of config (P3)
**Priority**: P3 | **Source**: Render migration session (68701c6)
`server/src/scripts/worker.ts` logs `process.env.REDIS_HOST` / `process.env.REDIS_PORT` directly instead of using `config.redis`. Also uses `winston` instead of project-standard Pino logger. -- `server/src/scripts/worker.ts:14-17`

#### RENDER-3: Playwright Docker worker for Render (P2)
**Priority**: P2 | **Source**: docs/RENDER-MIGRATION.md (section 3: Playwright on Render)
Render's native Node runtime lacks Chromium system dependencies. Current approach is API-only mode (`TCAD_AUTO_REFRESH_TOKEN=true`). If browser fallback is needed, create a Docker-based Background Worker with Playwright deps pre-installed. Requires Dockerfile + `runtime: docker` in render.yaml.

#### RENDER-4: Pin Node.js version for Render (P3)
**Priority**: P3 | **Source**: Render migration session
No `.node-version` file or `engines` field in `package.json`. Render defaults to latest LTS. Pin to avoid unexpected breakage on Node major version bumps.

#### ~~E2E-1: Create comprehensive Playwright e2e test suite (P1)~~ DONE
**Completed**: 2026-02-23 | Playwright config + 3 e2e specs (search, property-card, error-handling) with 12 tests covering search flow, expand/collapse, error states.

#### ~~E2E-2: Reduce CSS module mocking in component tests (P2)~~ DONE
**Completed**: 2026-02-23 | Removed 100+ lines of CSS class mocks from PropertyCard/LoadingSkeleton tests. Switched to `data-testid` + `getByRole` selectors. Added `css.modules.classNameStrategy: "non-scoped"` to vite config.

#### ~~E2E-3: Add screenshot/trace collection on test failure (P2)~~ DONE
**Completed**: 2026-02-23 | Playwright config: `screenshot: "only-on-failure"`, `trace: "on-first-retry"`, `outputDir: "./e2e/test-results"`. Gitignore updated.

#### E2E-4: Increase integration test retry count (P2)
**Priority**: P2 | **Source**: e2e test audit (vitest.integration.config.ts)
Current retry limit is 1 for network-dependent integration tests. Intermittent CI failures likely. Recommendation: Increase to 2-3 retries. -- `server/vitest.integration.config.ts:56-57`

#### E2E-5: Reduce unit test timeout threshold (P3)
**Priority**: P3 | **Source**: e2e test audit
Unit test timeout is 10s (too generous). Integration tests correctly use 60s. Recommendation: Default unit tests to 5s, allow 30s on specific integration tests via `.test(..., { timeout: 30000 })`. -- `server/vitest.config.ts:65`

#### E2E-6: Implement page object pattern for complex components (P3)
**Priority**: P3 | **Source**: e2e test audit
Frontend tests directly interact with DOM without abstraction layer. Increases test maintenance burden when component structure changes. Recommendation: Create page object classes for PropertyCard, SearchBox, LoadingSkeleton.

#### E2E-7: Add test data factory pattern (P3)
**Priority**: P3 | **Source**: e2e test audit
Integration tests manually seed/clean data. No test data builder pattern. Recommendation: Use factory-bot style builders or faker.js for consistent test data generation.

#### E2E-8: Add visual regression testing (P3)
**Priority**: P3 | **Source**: e2e test audit
CSS changes can break layout silently without failing tests. Recommendation: Add Percy.io or Playwright visual comparisons for e2e tests.

#### E2E-9: Add accessibility testing with axe-core (P3)
**Priority**: P3 | **Source**: e2e test audit
Frontend tests mock accessibility features but don't verify WCAG compliance. Recommendation: Integrate axe-core automated a11y tests in e2e suite.

#### E2E-10: Add performance/load testing (P4)
**Priority**: P4 | **Source**: e2e test audit
No load testing on API endpoints. No Core Web Vitals monitoring. Recommendation: Add k6 or Artillery tests for scraping under load.

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).
