# Testing Guide

Quick reference for running tests in the TCAD Scraper project.

## Quick Start

```bash
cd server

# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run integration tests (requires Doppler)
npm run test:integration
```

## Prerequisites

- **Database**: Remote PostgreSQL on Render (via `DATABASE_URL` in Doppler)
- **Redis**: Remote Redis on Render (via `REDIS_URL` in Doppler)
- **Doppler**: Required for integration tests (`doppler run -- npm run test:integration`)

No local Docker or database setup needed.

## Test Commands

All commands run from `server/`:

### Unit Tests

| Command | Description |
|---------|-------------|
| `npm test` | Run all unit tests (631+ tests, <5 sec) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Unit coverage report |

### Integration Tests

| Command | Description |
|---------|-------------|
| `npm run test:integration` | All integration tests |
| `npm run test:integration:watch` | Watch mode |
| `npm run test:integration:coverage` | Integration coverage report |
| `npm run test:security` | Security tests only |
| `npm run test:auth-db` | Auth/database tests |
| `npm run test:enqueue` | Queue tests |

### Combined

| Command | Description |
|---------|-------------|
| `npm run test:all` | Unit + integration |
| `npm run test:all:coverage` | Full coverage report |

## Test Structure

```
server/src/
├── __tests__/                          # Top-level integration tests
│   ├── setup.ts                        # Global test setup
│   ├── api.test.ts                     # API endpoint tests
│   ├── integration.test.ts             # General integration tests
│   ├── security.test.ts                # Security vulnerability tests
│   ├── enqueue.test.ts                 # Queue/BullMQ tests
│   ├── auth-database.connection.test.ts
│   └── auth-database.integration.test.ts
├── config/__tests__/                   # Config unit tests
├── controllers/__tests__/             # Controller unit tests
├── lib/__tests__/                     # Library unit tests
├── middleware/__tests__/              # Middleware unit tests
├── queues/__tests__/                  # Queue unit tests
├── routes/__tests__/                  # Route handler unit tests
├── schedulers/__tests__/              # Scheduler unit tests
├── services/__tests__/                # Service unit tests
└── utils/__tests__/                   # Utility unit tests
```

**33 test files** across 10 test directories.

## Test Configuration

Two Vitest configs split unit and integration tests:

- **`vitest.config.ts`** — Unit tests: mocked deps, parallel, 5s timeout
- **`vitest.integration.config.ts`** — Integration tests: real services, sequential, 60s timeout, retry 2x, bail on first failure

## Environment Variables

Tests use Doppler for secrets. Key variables:

```bash
NODE_ENV=test
DATABASE_URL=<from Doppler>
REDIS_URL=<from Doppler>
```

## Coverage

After running coverage:

```bash
# Unit coverage
open coverage/lcov-report/index.html

# Integration coverage
open coverage/integration/lcov-report/index.html
```

### Thresholds (unit tests)

| Metric | Minimum |
|--------|---------|
| Statements | 35% |
| Branches | 32% |
| Functions | 37% |
| Lines | 35% |

## Debugging Tests

```bash
# Run specific test file
npm test -- src/lib/__tests__/tcad-scraper.test.ts

# Filter by test name
npm test -- --testNamePattern="should return healthy status"

# Verbose output
npm test -- --verbose
```

## Writing Tests

### Code Standards

- Use `vitest` imports (`describe`, `it`, `expect`, `vi`)
- No `any` types — use `unknown` + type guards or mock patterns below
- No `console.*` — use `logger` from `../lib/logger`
- Use Arrange-Act-Assert structure

### Type-Safe Mock Patterns

**Flat mock objects:**
```typescript
let scraperQueue: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  scraperQueue = { add: vi.fn(), getJob: vi.fn() };
});
```

**Nested mock objects (Prisma):**
```typescript
let prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;

beforeEach(() => {
  prisma = {
    property: { findMany: vi.fn(), count: vi.fn() },
  };
});
```

**Safe casting:**
```typescript
const mockQueue = scraperQueue as unknown as {
  add: ReturnType<typeof vi.fn>;
};
```

**Config mutation:**
```typescript
(config.env as Record<string, unknown>).isProduction = true;
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot find module '@prisma/client'` | `npx prisma generate` |
| Integration tests fail with auth errors | Check Doppler config: `doppler run -- npm run test:integration` |
| Tests hanging | Check for unclosed connections; use `--forceExit` as last resort |
| Tests pass locally, fail in CI | Check CI env vars and Node.js version match |
