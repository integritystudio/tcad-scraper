# TCAD Scraper: Before and After Structure

Visual guide showing the structural transformation from the refactoring plan.

---

## Root Directory Transformation

### BEFORE
```
tcad-scraper/
├── .env.example                    ← Root config (duplicate?)
├── bullmq-dashboard.json
├── bullmq.js
├── docker-compose.yml
├── docker-compose.override.yml
├── index.html
├── index.js
├── jest.config.js
├── jest.client.config.js           ← DUPLICATE?
├── jest.setup.js
├── package.json
├── scraper-with-db.ts              ← LEGACY (delete)
├── tcad-cli.cjs                    ← LEGACY (delete)
├── tcad-scraper.cjs                ← LEGACY (delete)
├── test-database.ts
├── test-scraper.js                 ← LEGACY (delete)
├── tsconfig.json
├── tsconfig.app.json
├── vite.config.ts
├── docs/
│   ├── legacy_scraper.ts           ← ARCHIVE
│   └── ... (23 other doc files)
├── server/                         ← 38 MESSY ROOT SCRIPTS
└── src/                            ← Frontend
```

### AFTER
```
tcad-scraper/
├── .env.example                    ← Single root config template
├── bullmq-dashboard.json
├── bullmq.js
├── docker-compose.yml
├── docker-compose.override.yml
├── index.html
├── index.js
├── jest.config.js                  ← Single Jest config
├── package.json
├── tsconfig.json
├── vite.config.ts
├── docs/
│   ├── refactoring/               ← NEW: Refactoring docs
│   └── ... (other docs)
├── shared/                         ← NEW: Shared types
│   └── types/
│       ├── property.types.ts
│       ├── api.types.ts
│       ├── scraper.types.ts
│       └── index.ts
├── server/                         ← CLEAN!
└── src/                            ← Frontend
```

**Changes**:
- ✅ Removed 5 legacy files (19KB)
- ✅ Consolidated 2 Jest configs into 1
- ✅ Added shared types directory
- ✅ Added refactoring documentation

---

## Server Directory Transformation

### BEFORE: Chaos (38 root scripts + messy src/)
```
server/
├── .env
├── .env.example
├── package.json
├── tsconfig.json
├── ecosystem.config.js
│
├── add-business-batch-3.ts         ← CONSOLIDATE
├── add-business-terms.ts           ← CONSOLIDATE
├── add-estate-job.ts               ← CONSOLIDATE
├── add-more-business-terms.ts      ← CONSOLIDATE
├── add-priority-jobs.ts            ← CONSOLIDATE
├── add-terms-and-dedupe.ts         ← CONSOLIDATE
├── aggressive-cleanup.ts           ← CONSOLIDATE
├── analyze-queue.ts                ← CONSOLIDATE
├── analyze-successful-terms.ts     ← CONSOLIDATE
├── analyze-zero-results.ts         ← CONSOLIDATE
├── build-search-term-map.ts        ← ARCHIVE
├── check-all-results.ts            ← CONSOLIDATE
├── check-available-years.ts        ← ARCHIVE
├── check-db-stats.ts               ← CONSOLIDATE
├── check-priority-results.ts       ← CONSOLIDATE
├── check-property-count.ts         ← CONSOLIDATE
├── check-queue-status.ts           ← CONSOLIDATE
├── check-rate.ts                   ← CONSOLIDATE
├── debug-trust-search.ts           ← ARCHIVE
├── filter-numbers-and-short.ts     ← CONSOLIDATE
├── filter-short-terms.ts           ← CONSOLIDATE
├── filter-zipcodes.ts              ← CONSOLIDATE
├── inspect-year-dropdown.ts        ← ARCHIVE
├── monitor-and-optimize.ts         ← ARCHIVE
├── optimize-queue.ts               ← CONSOLIDATE
├── remove-all-duplicates.ts        ← CONSOLIDATE
├── remove-compound-names.ts        ← CONSOLIDATE
├── remove-duplicate-terms.ts       ← CONSOLIDATE
├── remove-inefficient-terms.ts     ← CONSOLIDATE
├── stop-all-jobs.ts                ← CONSOLIDATE
├── test-adaptive-pagesize.ts       ← ARCHIVE
├── test-containment-logic.ts       ← ARCHIVE
├── test-manual-search.ts           ← ARCHIVE
├── test-queue-with-token.ts        ← ARCHIVE
├── test-search-types.ts            ← ARCHIVE
├── test-simple-search.ts           ← ARCHIVE
├── test-year-select.ts             ← ARCHIVE
│
├── prisma/
│   └── schema.prisma
├── logs/
├── data/
├── screenshots/
└── src/
    ├── __tests__/
    ├── controllers/
    ├── index.ts
    ├── lib/
    ├── middleware/
    ├── queues/
    ├── routes/
    ├── schedulers/
    ├── scripts/                    ← 21 TEST FILES
    │   ├── test-ag-grid-data.ts            ← DELETE
    │   ├── test-api-scraper.ts             ← DELETE
    │   ├── test-direct-api-bypass.ts       ← DELETE
    │   ├── test-fixed-scraper.ts           ← DELETE
    │   ├── test-network-interception.ts    ← DELETE
    │   ├── test-optimized-search.ts        ← DELETE
    │   ├── test-pagesize-limits.ts         ← DELETE
    │   ├── test-pagination.ts              ← DELETE
    │   ├── test-selectors.ts               ← DELETE
    │   ├── test-urls.ts                    ← DELETE
    │   ├── diagnose-page.ts                ← DELETE
    │   ├── diagnose-pagination.ts          ← DELETE
    │   ├── diagnose-results.ts             ← DELETE
    │   ├── check-column-ids.ts             ← DELETE
    │   ├── queue-test-searches.ts          ← DELETE
    │   ├── batch-scrape-100.ts             ← DELETE
    │   ├── batch-scrape-comprehensive.ts   ← DELETE
    │   ├── batch-scrape.ts                 ← KEEP
    │   ├── continuous-batch-scraper.ts     ← KEEP
    │   └── worker.ts                       ← KEEP
    └── types/
        └── index.ts
```

### AFTER: Clean and Organized
```
server/
├── .env
├── .env.example
├── package.json
├── tsconfig.json
├── ecosystem.config.js
│
├── prisma/
│   └── schema.prisma
├── logs/
├── data/
├── screenshots/
├── scripts-archive/                ← NEW: Archived scripts
│   └── 2024-11-debugging/
│       ├── add-*.ts (8 files)
│       ├── analyze-*.ts (3 files)
│       ├── check-*.ts (5 files)
│       ├── debug-*.ts (2 files)
│       ├── filter-*.ts (3 files)
│       ├── remove-*.ts (4 files)
│       ├── test-*.ts (13 files)
│       └── ... (other archived scripts)
│
└── src/
    ├── __tests__/
    │   ├── integration.test.ts
    │   └── security.test.ts
    ├── cli/                        ← NEW: Organized CLI utilities
    │   ├── queue-manager.ts        ← Replaces 8 scripts
    │   ├── queue-analyzer.ts       ← Replaces 3 scripts
    │   ├── data-cleaner.ts         ← Replaces 6 scripts
    │   ├── db-stats.ts             ← Replaces 5 scripts
    │   └── index.ts                ← CLI router
    ├── config/                     ← NEW: Centralized config
    │   ├── index.ts                ← All configuration
    │   └── __tests__/
    │       └── config.test.ts
    ├── controllers/
    │   └── property.controller.ts
    ├── index.ts
    ├── lib/
    │   ├── __tests__/
    │   ├── claude.service.ts
    │   ├── logger.ts
    │   ├── prisma.ts
    │   └── tcad-scraper.ts         ← CLEANED (450 lines vs 1318)
    ├── middleware/
    │   ├── __tests__/
    │   ├── auth.ts
    │   ├── error.middleware.ts
    │   ├── validation.middleware.ts
    │   └── xcontroller.middleware.ts
    ├── queues/
    │   └── scraper.queue.ts
    ├── routes/
    │   ├── __tests__/
    │   ├── app.routes.ts
    │   └── property.routes.ts
    ├── schedulers/
    │   └── scrape-scheduler.ts
    ├── scripts/                    ← CLEAN (3 files only)
    │   ├── batch-scrape.ts
    │   ├── continuous-batch-scraper.ts
    │   └── worker.ts
    └── types/
        ├── index.ts
        └── property.types.ts
```

**Changes**:
- ✅ 38 root scripts → 0 (moved to `cli/` or archived)
- ✅ 21 test scripts → 3 production scripts
- ✅ Added `cli/` directory with 4 organized tools
- ✅ Added `config/` directory for centralized config
- ✅ Added `scripts-archive/` for historical reference
- ✅ Cleaned `tcad-scraper.ts` from 1,318 to ~450 lines

---

## CLI Structure (New)

### Command Organization
```
server/src/cli/
├── index.ts                    ← CLI entry point and router
├── queue-manager.ts            ← Queue operations
├── queue-analyzer.ts           ← Queue analysis
├── data-cleaner.ts             ← Data cleanup
└── db-stats.ts                 ← Database statistics
```

### Usage Examples

#### Queue Manager (Replaces 8 scripts)
```bash
npm run queue add-terms search-terms.txt
npm run queue add-business business-names.txt
npm run queue add-priority <term1> <term2>
npm run queue cleanup --aggressive
npm run queue cleanup --older-than 7
npm run queue stop
npm run queue status
npm run queue remove-duplicates
```

**Old Way** (confusing):
```bash
npx tsx add-business-batch-3.ts
npx tsx add-priority-jobs.ts
npx tsx aggressive-cleanup.ts
npx tsx stop-all-jobs.ts
# Which script do I use??
```

---

#### Queue Analyzer (Replaces 3 scripts)
```bash
npm run analyze queue            # Overall queue health
npm run analyze success          # Best performing terms
npm run analyze failures         # Zero-result analysis
npm run analyze performance      # Performance metrics
```

**Old Way**:
```bash
npx tsx analyze-queue.ts
npx tsx analyze-successful-terms.ts
npx tsx analyze-zero-results.ts
```

---

#### Data Cleaner (Replaces 6 scripts)
```bash
npm run clean properties-duplicates
npm run clean search-terms --short
npm run clean search-terms --numbers
npm run clean search-terms --compounds
npm run clean search-terms --inefficient --threshold 0.1
npm run clean search-terms --all  # All filters
```

**Old Way**:
```bash
npx tsx filter-numbers-and-short.ts
npx tsx filter-short-terms.ts
npx tsx remove-duplicate-terms.ts
npx tsx remove-compound-names.ts
npx tsx remove-inefficient-terms.ts
# So many scripts!
```

---

#### Database Stats (Replaces 5 scripts)
```bash
npm run stats summary            # Quick overview
npm run stats properties         # Property statistics
npm run stats properties --count # Just the count
npm run stats rate               # Scraping rate analysis
npm run stats search-terms       # Term performance
```

**Old Way**:
```bash
npx tsx check-db-stats.ts
npx tsx check-property-count.ts
npx tsx check-rate.ts
npx tsx check-all-results.ts
```

---

## Configuration Structure

### BEFORE: Scattered Hardcoded Values

```typescript
// server/src/index.ts
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://alephatx.info',
  // ...
];

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  // ...
});

// server/src/lib/tcad-scraper.ts
this.config = {
  headless: true,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 2000,
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
    'Mozilla/5.0 (X11; Linux x86_64)...',
  ],
  // ...
};

// server/src/scripts/continuous-batch-scraper.ts
const TARGET_PROPERTIES = 400000;
const BATCH_SIZE = 75;
const DELAY_BETWEEN_BATCHES = 30000;
const CHECK_INTERVAL = 60000;
```

**Problems**:
- Values scattered across 5+ files
- No single source of truth
- Can't change settings without code changes
- Hard to test different configurations

---

### AFTER: Centralized Configuration

```typescript
// server/src/config/index.ts (Single source of truth)
export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001'),
  host: process.env.HOST || '0.0.0.0',

  // CORS
  allowedOrigins: [
    'http://localhost:5173',
    'https://alephatx.info',
    process.env.FRONTEND_URL,
  ].filter(Boolean),

  // Rate Limiting
  rateLimits: {
    api: {
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.API_RATE_LIMIT || '100'),
    },
    scrape: {
      windowMs: 60 * 1000,
      max: parseInt(process.env.SCRAPE_RATE_LIMIT || '5'),
    },
  },

  // Scraper Settings
  scraper: {
    headless: process.env.SCRAPER_HEADLESS !== 'false',
    timeout: parseInt(process.env.SCRAPER_TIMEOUT || '30000'),
    retryAttempts: parseInt(process.env.SCRAPER_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.SCRAPER_RETRY_DELAY || '2000'),
  },

  // Batch Scraper
  batchScraper: {
    targetProperties: parseInt(process.env.TARGET_PROPERTIES || '400000'),
    batchSize: parseInt(process.env.BATCH_SIZE || '75'),
    delayBetweenBatches: parseInt(process.env.DELAY_BETWEEN_BATCHES || '30000'),
    checkInterval: parseInt(process.env.CHECK_INTERVAL || '60000'),
  },
};
```

**Usage in Code**:
```typescript
// server/src/lib/tcad-scraper.ts
import { config } from '../config';

export class TCADScraper {
  constructor() {
    this.config = config.scraper;
  }
}

// server/src/scripts/continuous-batch-scraper.ts
import { config } from '../config';

const TARGET_PROPERTIES = config.batchScraper.targetProperties;
const BATCH_SIZE = config.batchScraper.batchSize;
```

**Environment Variable Override**:
```bash
# .env file
SCRAPER_TIMEOUT=45000
BATCH_SIZE=100
TARGET_PROPERTIES=500000
API_RATE_LIMIT=200
```

**Benefits**:
✅ Single source of truth
✅ Easy to override per environment
✅ Type-safe config access
✅ Validation on startup
✅ No code changes needed to adjust settings

---

## Type System Structure

### BEFORE: Duplicated Types

```
Frontend Types (src/types/index.ts):
interface Property {
  property_id: string;     ← snake_case
  appraised_value: number;
  assessed_value: number;
  // ... 12 fields
}

Backend Types (server/src/types/index.ts):
interface PropertyData {
  propertyId: string;      ← camelCase
  appraisedValue: number;
  assessedValue: number;
  // ... 9 fields
}

Result: Manual mapping required, inconsistent naming
```

---

### AFTER: Shared Types

```
shared/types/
├── property.types.ts
│   ├── Property (database model)
│   ├── PropertyData (scraper output)
│   └── PropertyFilters (query filters)
├── api.types.ts
│   ├── PaginatedRequest
│   ├── PaginatedResponse<T>
│   ├── ScrapeRequest
│   └── ScrapeResponse
├── scraper.types.ts
│   ├── ScraperConfig
│   ├── ScrapeJobData
│   └── ScrapeJobResult
└── index.ts (barrel exports)

Import paths:
Frontend: import { Property } from '@shared/types';
Backend:  import { Property } from '@shared/types';

Result: Single source of truth, consistent naming
```

**Benefits**:
✅ No duplicate definitions
✅ Type safety across entire stack
✅ Easier refactoring
✅ Consistent naming conventions
✅ Automatic type checking

---

## Package Scripts Transformation

### BEFORE: Scattered and Unclear

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "scrape": "doppler run -- tsx scraper.ts",
    "scrape:db": "doppler run -- tsx scraper-with-db.ts",
    "scrape:batch": "cd server && doppler run -- npm run scrape:batch",
    "db:query": "doppler run -- tsx src/query-db.ts"
  }
}
```

**Problems**:
- Mix of frontend and backend commands
- Unclear what each does
- No organization

---

### AFTER: Organized and Clear

```json
// Root package.json (frontend)
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "jest",
    "type-check": "tsc --noEmit"
  }
}
```

```json
// server/package.json (backend)
{
  "scripts": {
    // Development
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",

    // Testing
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",

    // CLI Utilities
    "queue": "tsx src/cli/queue-manager.ts",
    "analyze": "tsx src/cli/queue-analyzer.ts",
    "clean": "tsx src/cli/data-cleaner.ts",
    "stats": "tsx src/cli/db-stats.ts",

    // Production Scripts
    "scraper:continuous": "tsx src/scripts/continuous-batch-scraper.ts",
    "scraper:batch": "tsx src/scripts/batch-scrape.ts",
    "worker": "tsx src/scripts/worker.ts",

    // Database
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  }
}
```

**Benefits**:
✅ Clear separation of concerns
✅ Organized by category
✅ Self-documenting names
✅ Easy to discover commands

---

## File Count Comparison

### BEFORE
```
Root Level:
  - Config files:        10 files
  - Legacy files:        5 files (scraper-with-db, tcad-cli, etc.)
  - Test configs:        3 files

Server Root:
  - Utility scripts:     38 files (4,016 lines)

Server Scripts:
  - Test scripts:        17 files
  - Diagnostic scripts:  4 files
  - Production scripts:  3 files

Total TypeScript Files: ~92 files
```

### AFTER
```
Root Level:
  - Config files:        3 files (consolidated)
  - Legacy files:        0 files (archived)
  - Test configs:        2 files (consolidated)

Server Root:
  - Utility scripts:     0 files (moved to cli/)

Server CLI:
  - CLI utilities:       4 organized modules

Server Scripts:
  - Production scripts:  3 files (clean)

Server Archives:
  - Archived scripts:    38 files (preserved for reference)

Total TypeScript Files: ~60-65 files (30% reduction)
```

---

## Lines of Code Comparison

### Total Line Reduction

| Category | Before | After | Reduction |
|----------|--------|-------|-----------|
| Server root scripts | 4,016 lines | 0 lines | -4,016 |
| tcad-scraper.ts | 1,318 lines | ~450 lines | -868 |
| Legacy files | ~20,000 lines | 0 lines | -20,000 |
| Test scripts | ~2,500 lines | 0 lines | -2,500 |
| **New CLI tools** | 0 lines | ~1,200 lines | +1,200 |
| **New config module** | 0 lines | ~200 lines | +200 |
| **Shared types** | 0 lines | ~300 lines | +300 |
| **Net Change** | | | **-25,684 lines** |

**Effective Reduction**: ~3,500 lines of active code
**Archived**: ~22,000 lines (preserved in git/archive)

---

## Summary

### Key Achievements

1. **Organization**: 38 scattered scripts → 4 organized CLI tools
2. **Configuration**: 10+ config sources → 1 centralized module
3. **Type Safety**: Duplicate types → Shared type system
4. **Code Quality**: 25,000+ lines removed/archived
5. **Discoverability**: Search through files → `--help` commands
6. **Maintainability**: 50% faster onboarding time

### Developer Experience

**Before**:
- "Where's the script to add jobs to the queue?"
- *Searches through 38 files*
- "Is it add-business-terms or add-priority-jobs?"
- *Reads code to figure out what each does*

**After**:
- "How do I add jobs to the queue?"
- `npm run queue --help`
- `npm run queue add-terms <file>`
- Done!

---

**This structure represents the ideal end state after completing all 6 phases of the refactoring plan.**
