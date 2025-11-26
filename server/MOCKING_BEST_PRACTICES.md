# Vitest Mocking Best Practices for TCAD Scraper

**Last Updated**: November 26, 2025
**Status**: ✅ Validated with reproduction tests

This document outlines approved mocking patterns for the TCAD Scraper project based on comprehensive testing and bug fixes.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Playwright Browser Mocking](#playwright-browser-mocking)
3. [Anthropic SDK Mocking](#anthropic-sdk-mocking)
4. [Understanding Test Error Logs](#understanding-test-error-logs)
5. [Common Pitfalls](#common-pitfalls)
6. [Migration Guide](#migration-guide)

---

## Quick Reference

### ✅ DO: Factory-Based Mocking for Async SDKs

```typescript
// For Playwright, Puppeteer, or other async browser SDKs
let mockBrowser: any;
let mockContext: any;

beforeEach(() => {
  mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };

  vi.doMock('playwright', () => ({
    chromium: {
      launch: vi.fn().mockResolvedValue(mockBrowser),
    },
  }));
});
```

### ✅ DO: Class-Based Mocking for Synchronous SDKs

```typescript
// For Anthropic SDK, AWS SDK, or other class-based clients
const { mockCreate, MockAnthropic } = vi.hoisted(() => {
  const mockCreate = vi.fn();

  class MockAnthropic {
    messages = { create: mockCreate };
  }

  return { mockCreate, MockAnthropic };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
}));
```

### ❌ DON'T: Use vi.hoisted() for Async SDKs

```typescript
// ❌ BROKEN - Don't do this!
const { mockBrowser } = vi.hoisted(() => {
  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue({...}),
  };
  return { mockBrowser };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser), // Returns undefined!
  },
}));
```

---

## Playwright Browser Mocking

### Problem

Using `vi.hoisted()` for Playwright browser mocks causes `this.browser.newContext()` to fail with:

```
TypeError: Cannot read properties of undefined (reading 'newContext')
```

**Why it fails:**
1. `vi.hoisted()` runs before module mocks are set up
2. The mock structure is created but not properly connected to the module system
3. When `chromium.launch()` returns a Promise, Vitest can't resolve the mocked value
4. Result: `browser` is `undefined` or missing expected methods

### Solution: Factory-Based Mocking

**Pattern**: Create fresh mocks in `beforeEach()` using `vi.doMock()`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Token Refresh Service', () => {
  let mockBrowser: any;
  let mockContext: any;
  let mockPage: any;

  beforeEach(() => {
    vi.resetModules(); // Clear previous module cache

    // Create fresh mocks
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      waitForFunction: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
      press: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Playwright with factory-created browser
    vi.doMock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockResolvedValue(mockBrowser),
      },
    }));
  });

  it('should create browser context', async () => {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const context = await browser.newContext();

    expect(context).toBeDefined();
    expect(mockBrowser.newContext).toHaveBeenCalledTimes(1);
  });
});
```

### Alternative: Factory Function Pattern

**Pattern**: Use `vi.mock()` at top level but return a factory function

```typescript
let mockBrowser: any;

// Top-level mock with factory function
vi.mock('playwright', () => ({
  chromium: {
    // Factory function accesses current mock variable values
    launch: vi.fn(() => Promise.resolve(mockBrowser)),
  },
}));

import { chromium } from 'playwright';

beforeEach(() => {
  mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };
});
```

### Benefits of Factory Approach

✅ Works with async Promise chains
✅ Fresh mocks on each test (no state leakage)
✅ Proper Promise resolution
✅ All method calls tracked by `vi.fn()`
✅ Easier to debug - mocks visible in `beforeEach()`

---

## Anthropic SDK Mocking

### Problem

Anthropic SDK is a class-based client. Error logs appear in test output making it seem like tests are failing, but they're actually passing.

### Solution: Class-Based Mocking with vi.hoisted()

**Pattern**: Create a mock class using `vi.hoisted()`

```typescript
// This pattern WORKS for class-based SDKs
const { mockCreate, MockAnthropic } = vi.hoisted(() => {
  const mockCreate = vi.fn();

  class MockAnthropic {
    messages = {
      create: mockCreate,
    };
  }

  return { mockCreate, MockAnthropic };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
}));

import { ClaudeSearchService } from '../claude.service';

beforeEach(() => {
  vi.clearAllMocks();
});

it('should parse query successfully', async () => {
  mockCreate.mockResolvedValue({
    content: [{
      type: 'text',
      text: JSON.stringify({
        whereClause: { city: 'Austin' },
        explanation: 'Test',
      }),
    }],
  });

  const service = new ClaudeSearchService();
  const result = await service.parseNaturalLanguageQuery('test');

  expect(result.whereClause.city).toBe('Austin');
  expect(mockCreate).toHaveBeenCalledTimes(1);
});
```

### Testing Error Scenarios

```typescript
it('should fallback on API error', async () => {
  // This will log an error, but test should PASS
  mockCreate.mockRejectedValue(new Error('API Error'));

  const service = new ClaudeSearchService();
  const result = await service.parseNaturalLanguageQuery('test');

  // Verify fallback behavior
  expect(result.whereClause.OR).toBeDefined();
  expect(result.whereClause.OR).toHaveLength(4);
});
```

### Why vi.hoisted() Works Here

✅ Anthropic SDK constructor is synchronous
✅ `new Anthropic()` returns instance immediately
✅ Only async methods (`.create()`) return Promises
✅ Those Promises are properly mocked with `vi.fn()`

---

## Understanding Test Error Logs

### The Issue

When running tests, you may see RED error logs like:

```
[31mERROR[39m: Error parsing natural language query with Claude: {"message":"API Error"...}
✓ src/lib/__tests__/claude.service.test.ts > should fallback to simple text search on API error
```

### The Explanation

**This is CORRECT behavior, not a bug!**

1. Tests intentionally trigger error conditions (`mockRejectedValue()`)
2. The service catches these errors and logs them via `logger.error()`
3. The logger outputs to stdout during tests
4. The test output shows these logged errors in RED
5. BUT the test itself PASSES (✓ green checkmark)

### How to Identify

**FALSE ALARM** (Current situation):
- ✓ Test passes but shows error logs
- Test uses `mockRejectedValue()` to trigger errors
- Test expects fallback behavior or error handling
- **No action needed!**

**REAL PROBLEM** (Actual test failure):
- ✕ Test fails with unexpected errors
- Test expectations not met
- Mocks not working correctly
- **Fix required!**

### Reducing Noise (Optional)

If error logs are too noisy, you can:

1. **Mock the logger** to suppress output:

```typescript
vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(), // Suppress error logs
    warn: vi.fn(),
  },
}));
```

2. **Set log level in test config**:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./src/__tests__/setup.ts'],
    environment: 'node',
    env: {
      LOG_LEVEL: 'silent', // Suppress all logs during tests
    },
  },
});
```

3. **Use a custom test reporter** that filters expected errors

---

## Common Pitfalls

### ❌ Pitfall 1: Using vi.hoisted() for Async SDKs

**Problem:**
```typescript
const { mockBrowser } = vi.hoisted(() => ({
  mockBrowser: { newContext: vi.fn() }
}));
```

**Why it fails:** Promise chain resolution broken

**Fix:** Use factory-based mocking (see [Playwright section](#playwright-browser-mocking))

---

### ❌ Pitfall 2: Not Clearing Mocks Between Tests

**Problem:**
```typescript
it('test 1', async () => {
  mockCreate.mockResolvedValue({...});
  // Test runs
});

it('test 2', async () => {
  // mock still has value from test 1!
});
```

**Fix:** Always clear mocks in `beforeEach()`:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

---

### ❌ Pitfall 3: Importing Before Mocking

**Problem:**
```typescript
import { chromium } from 'playwright'; // TOO EARLY!

vi.mock('playwright', () => ({...}));
```

**Fix:** Import AFTER mocks are set up:

```typescript
vi.mock('playwright', () => ({...}));

import { chromium } from 'playwright'; // AFTER mock
```

Or use dynamic imports:

```typescript
it('test', async () => {
  const { chromium } = await import('playwright');
});
```

---

### ❌ Pitfall 4: Forgetting to Reset Modules

**Problem:**
```typescript
// Previous test cached the module
beforeEach(() => {
  // Create new mocks but module still cached
});
```

**Fix:** Reset module cache:

```typescript
beforeEach(() => {
  vi.resetModules(); // Clear cache
  // Then create new mocks
});
```

---

## Migration Guide

### From Jest to Vitest

| Jest Pattern | Vitest Equivalent |
|-------------|-------------------|
| `jest.mock()` | `vi.mock()` |
| `jest.fn()` | `vi.fn()` |
| `jest.clearAllMocks()` | `vi.clearAllMocks()` |
| `jest.resetModules()` | `vi.resetModules()` |
| `beforeEach()` | `beforeEach()` (same) |
| `expect().toHaveBeenCalled()` | `expect().toHaveBeenCalled()` (same) |

### Migrating Playwright Tests

**Before (Jest with hoisted):**
```typescript
const mockBrowser = { newContext: jest.fn() };
jest.mock('playwright', () => ({
  chromium: { launch: () => Promise.resolve(mockBrowser) }
}));
```

**After (Vitest with factory):**
```typescript
let mockBrowser: any;

beforeEach(() => {
  mockBrowser = { newContext: vi.fn().mockResolvedValue({...}) };
  vi.doMock('playwright', () => ({
    chromium: { launch: vi.fn().mockResolvedValue(mockBrowser) }
  }));
});
```

### Migrating Class-Based SDK Tests

**Before (Jest):**
```typescript
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() }
  }))
}));
```

**After (Vitest):**
```typescript
const { mockCreate, MockAnthropic } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { mockCreate, MockAnthropic };
});

vi.mock('@anthropic-ai/sdk', () => ({ default: MockAnthropic }));
```

---

## Validation

All patterns in this document have been validated with reproduction tests:

- ✅ `server/src/services/__tests__/token-refresh-mock-repro.test.ts` (Playwright)
- ✅ `server/src/lib/__tests__/claude-mock-repro.test.ts` (Anthropic SDK)

Run validation:

```bash
cd server
npm test -- token-refresh-mock-repro.test.ts
npm test -- claude-mock-repro.test.ts
```

Both test files should show 100% passing tests.

---

## Related Documentation

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Playwright Testing Best Practices](https://playwright.dev/docs/test-runners)
- [TCAD Scraper Testing Strategy](./src/__tests__/README.md)
- [Bugfix Plan](~/dev/active/bugfix-tcad-scraper-errors-2025-11-26/plan.md)

---

## Questions?

If you encounter mocking issues not covered here:

1. Check if the SDK is synchronous (class-based) or asynchronous (Promise-based)
2. Look at the reproduction tests for similar patterns
3. Add a new reproduction test to validate your approach
4. Update this document with your findings

---

**Document Version**: 1.0
**Last Validated**: November 26, 2025
**Approved By**: Automated test suite
