# TCAD Scraper Codebase Refactoring Plan

**Date**: January 5, 2025
**Status**: Analysis Complete - Ready for Implementation
**Goal**: Simplify, consolidate, and make the codebase more maintainable and configurable

---

## Executive Summary

The TCAD scraper has grown organically over time, resulting in:
- **38 utility/one-off scripts** in `/server` root directory (~4,000 lines of code)
- **21 test/diagnostic scripts** in `/server/src/scripts` (~2,500 lines)
- **Duplicate configuration** scattered across multiple files
- **Hardcoded values** (timeouts, batch sizes, search patterns, URLs)
- **3 test configuration files** (jest.config.js, jest.client.config.js, jest.setup.js)
- **Inconsistent type definitions** between frontend and backend

This refactoring plan provides a phased approach to consolidate, simplify, and improve maintainability without breaking existing functionality.

**Estimated Impact**:
- Reduce codebase by ~2,000-3,000 lines
- Consolidate 38 root scripts into 8-10 organized utilities
- Centralize all configuration into single sources
- Improve developer onboarding time by 50%

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Identified Issues and Opportunities](#identified-issues-and-opportunities)
3. [Proposed Refactoring Plan](#proposed-refactoring-plan)
4. [Risk Assessment and Mitigation](#risk-assessment-and-mitigation)
5. [Testing Strategy](#testing-strategy)
6. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Directory Structure Issues

#### 1. Server Root Directory Chaos (38 Files)

**Location**: `/server/*.ts` (4,016 total lines)

**Categories of Scripts**:

**A. Queue Management (8 files)**
```
add-business-batch-3.ts       (1,044 lines)
add-business-terms.ts          (1,066 lines)
add-estate-job.ts              (801 lines)
add-more-business-terms.ts     (1,016 lines)
add-priority-jobs.ts           (3,752 lines)
add-terms-and-dedupe.ts        (5,620 lines)
aggressive-cleanup.ts          (4,538 lines)
stop-all-jobs.ts               (3,648 lines)
```

**B. Queue Analysis (3 files)**
```
analyze-queue.ts               (3,575 lines)
analyze-successful-terms.ts    (6,196 lines)
analyze-zero-results.ts        (3,874 lines)
```

**C. Queue Monitoring (2 files)**
```
check-queue-status.ts          (2,016 lines)
optimize-queue.ts              (2,891 lines)
```

**D. Database Stats (5 files)**
```
check-all-results.ts           (1,652 lines)
check-db-stats.ts              (2,874 lines)
check-priority-results.ts      (1,642 lines)
check-property-count.ts        (2,244 lines)
check-rate.ts                  (4,265 lines)
```

**E. Data Cleanup (6 files)**
```
filter-numbers-and-short.ts    (3,798 lines)
filter-short-terms.ts          (3,104 lines)
filter-zipcodes.ts             (3,765 lines)
remove-all-duplicates.ts       (5,861 lines)
remove-compound-names.ts       (3,512 lines)
remove-duplicate-terms.ts      (3,769 lines)
remove-inefficient-terms.ts    (7,089 lines)
```

**F. Scraper Testing (6 files)**
```
test-adaptive-pagesize.ts      (1,292 lines)
test-containment-logic.ts      (1,788 lines)
test-manual-search.ts          (2,817 lines)
test-queue-with-token.ts       (3,387 lines)
test-search-types.ts           (1,439 lines)
test-simple-search.ts          (2,197 lines)
test-year-select.ts            (3,873 lines)
```

**G. Development Utilities (8 files)**
```
build-search-term-map.ts       (5,739 lines)
check-available-years.ts       (1,435 lines)
debug-trust-search.ts          (4,098 lines)
inspect-year-dropdown.ts       (5,007 lines)
monitor-and-optimize.ts        (10,981 lines)
```

**Issues**:
- No organizational structure
- Duplicate functionality across files
- Many are one-time-use scripts that should be archived
- Mix of production utilities and debug/experimental code
- Hard to find what you need

#### 2. Scripts Directory Proliferation (21 Files)

**Location**: `/server/src/scripts/` (156K total)

**Test Scripts (13 files - ~50KB)**
```
test-ag-grid-data.ts
test-api-scraper.ts
test-direct-api-bypass.ts
test-fixed-scraper.ts
test-network-interception.ts
test-optimized-search.ts
test-pagesize-limits.ts
test-pagination.ts
test-selectors.ts
test-urls.ts
```

**Diagnostic Scripts (7 files)**
```
diagnose-page.ts
diagnose-pagination.ts
diagnose-results.ts
check-column-ids.ts
queue-test-searches.ts
```

**Production Scripts (3 files)**
```
continuous-batch-scraper.ts    (31,703 lines) ← PRODUCTION
batch-scrape.ts                (10,451 lines)
worker.ts                      (860 lines)    ← PRODUCTION
```

**Issues**:
- Test scripts should be in `__tests__` or archived
- Diagnostic scripts are outdated (pagination issues resolved)
- Only 3 files are actually used in production

#### 3. Configuration Sprawl

**Multiple Config Sources**:

```
/server/.env                    ← Active production secrets
/server/.env.example            ← Template
/.env.example                   ← Root template (duplicate?)
/server/src/index.ts            ← Hardcoded CORS origins, rate limits
/server/src/lib/tcad-scraper.ts ← Hardcoded timeouts, user agents, viewports
/server/src/scripts/continuous-batch-scraper.ts ← Hardcoded batch sizes
/server/package.json            ← Doppler scripts
/package.json                   ← Root scripts
/docker-compose.yml             ← Docker config
/docker-compose.override.yml    ← Local overrides
```

**Hardcoded Values Found**:
- **Timeouts**: 30000ms, 15000ms, 10000ms (multiple locations)
- **Batch Sizes**: 75, 100, 500 (different scripts)
- **Delays**: 30000ms between batches, 60000ms check interval
- **Target Property Count**: 400000 (hardcoded in continuous scraper)
- **Rate Limits**: 100 requests/15min, 5 scrapes/min
- **User Agents**: Array of 3 agents in scraper class
- **Viewports**: Array of 3 sizes in scraper class
- **URLs**: 'https://travis.prodigycad.com' scattered throughout
- **Search Pattern Weights**: 70, 40, 20 (in continuous-batch-scraper)

#### 4. Type Definition Duplication

**Backend Types** (`/server/src/types/index.ts`):
```typescript
interface PropertyData {
  propertyId: string;
  name: string;
  propType: string;
  city: string | null;
  propertyAddress: string;
  assessedValue: number;
  appraisedValue: number;
  geoId: string | null;
  description: string | null;
}
```

**Frontend Types** (`/src/types/index.ts`):
```typescript
interface Property {
  id: string;
  property_id: string;
  name: string;
  prop_type: string;
  city: string | null;
  property_address: string;
  assessed_value: number;
  appraised_value: number;
  geo_id: string | null;
  description: string | null;
  // ... more fields
}
```

**Issues**:
- Different naming conventions (camelCase vs snake_case)
- Duplicate definitions
- No shared types package
- Mapping logic scattered across API layer

#### 5. Test Configuration Redundancy

**Three Separate Jest Configs**:
```
/jest.config.js         ← Root client tests
/jest.client.config.js  ← Duplicate client tests?
/jest.setup.js          ← Setup file
/server/ (has own tests but no jest.config)
```

**Issues**:
- Unclear which config is used where
- Possible duplicate configurations
- Server tests may not have proper config

#### 6. Duplicate Scraping Logic

**Multiple Scraper Implementations**:
```
/scraper-with-db.ts                           ← Legacy root scraper
/server/src/lib/tcad-scraper.ts              ← Main scraper class
/server/src/scripts/test-api-scraper.ts      ← Test version
/server/src/scripts/test-direct-api-bypass.ts ← Alternative API method
/docs/legacy_scraper.ts                       ← Archived version
```

**Issues**:
- Only `/server/src/lib/tcad-scraper.ts` should be active
- Others should be archived or removed
- Code duplication causes maintenance burden

---

## Identified Issues and Opportunities

### Critical Issues (High Priority)

#### Issue 1: Unorganized Utility Scripts
**Severity**: Major
**Impact**: Developer productivity, maintenance burden
**Root Cause**: No structure for one-off scripts and utilities

**Evidence**:
- 38 scripts at server root with no categorization
- Duplicate functionality (multiple "add jobs" scripts)
- Mix of production, testing, and experimental code
- Developer time wasted searching for correct utility

**Opportunity**: Consolidate into organized utility modules

#### Issue 2: Hardcoded Configuration Values
**Severity**: Major
**Impact**: Flexibility, environment portability, testing
**Root Cause**: Values embedded directly in code instead of config files

**Evidence**:
```typescript
// server/src/scripts/continuous-batch-scraper.ts
const TARGET_PROPERTIES = 400000;  // Hardcoded!
const BATCH_SIZE = 75;             // Hardcoded!
const DELAY_BETWEEN_BATCHES = 30000; // Hardcoded!

// server/src/lib/tcad-scraper.ts
timeout: 30000,                    // Hardcoded!
userAgents: [/* 3 hardcoded agents */],
viewports: [/* 3 hardcoded sizes */],
```

**Opportunity**: Centralize all config in environment variables with defaults

#### Issue 3: Test Script Sprawl
**Severity**: Medium
**Impact**: Codebase clutter, confusion about what's production
**Root Cause**: No policy for archiving experimental/diagnostic code

**Evidence**:
- 20+ test files in `/server/src/scripts/`
- Many test outdated features (pagination workarounds)
- No clear separation from production code

**Opportunity**: Archive old tests, move active tests to proper test directories

#### Issue 4: Type Definition Inconsistency
**Severity**: Medium
**Impact**: Type safety, maintainability, API contract clarity
**Root Cause**: Separate type definitions for frontend and backend

**Evidence**:
- Frontend uses snake_case (`property_id`)
- Backend uses camelCase (`propertyId`)
- Manual mapping required in API layer
- Changes require updates in multiple locations

**Opportunity**: Create shared type definitions with single source of truth

### Medium Priority Issues

#### Issue 5: Duplicate Search Term Cleanup Logic
**Severity**: Medium
**Impact**: Maintainability, potential bugs from divergent implementations

**Evidence**:
- 6 different scripts for filtering/removing search terms
- Similar SQL queries and logic repeated
- `filter-numbers-and-short.ts`, `filter-short-terms.ts`, `remove-duplicate-terms.ts` all do similar things

**Opportunity**: Single unified CLI tool with subcommands

#### Issue 6: Queue Management Script Duplication
**Severity**: Medium
**Impact**: Confusion, potential for using wrong script

**Evidence**:
- 5 "add-*" scripts that queue jobs
- Different approaches to same task
- No clear "best practice" script

**Opportunity**: Single queue management CLI with modes

#### Issue 7: Monitoring and Stats Fragmentation
**Severity**: Low-Medium
**Impact**: Difficult to get holistic view of system health

**Evidence**:
- 5 different "check-*" scripts
- Each shows partial information
- No unified dashboard beyond Bull Board

**Opportunity**: Single comprehensive monitoring tool

### Low Priority Issues

#### Issue 8: Screenshot and Log File Accumulation
**Severity**: Low
**Impact**: Disk space, clutter

**Evidence**:
- `server/screenshots/` has 50+ diagnostic images
- Old screenshots from November 2024 debugging sessions
- No cleanup policy

**Opportunity**: Add log rotation and screenshot cleanup to maintenance scripts

#### Issue 9: Deprecated Code Not Removed
**Severity**: Low
**Impact**: Confusion, technical debt

**Evidence**:
- Commented-out browser scraping method (970 lines!)
- `scraper-with-db.ts` at root (legacy)
- `docs/legacy_scraper.ts`

**Opportunity**: Remove dead code, archive historical implementations

---

## Proposed Refactoring Plan

### Phase 1: Configuration Consolidation (High Priority)

**Goal**: Centralize all configuration into environment variables and config files

#### Step 1.1: Create Centralized Config Module

**Action**: Create `/server/src/config/index.ts`

**New File Structure**:
```typescript
// server/src/config/index.ts
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // Redis/Queue
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),

  // CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  allowedOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://alephatx.info',
    'https://www.alephatx.info',
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
    userAgents: process.env.SCRAPER_USER_AGENTS?.split(',') || [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    ],
    viewports: [
      { width: 3840, height: 2160 },
      { width: 2560, height: 1440 },
      { width: 1920, height: 1080 },
    ],
  },

  // TCAD URLs
  tcad: {
    baseUrl: process.env.TCAD_BASE_URL || 'https://travis.prodigycad.com',
    apiUrl: process.env.TCAD_API_URL || 'https://prod-container.trueprodigyapi.com',
    apiKey: process.env.TCAD_API_KEY,
  },

  // Batch Scraper
  batchScraper: {
    targetProperties: parseInt(process.env.TARGET_PROPERTIES || '400000'),
    batchSize: parseInt(process.env.BATCH_SIZE || '75'),
    delayBetweenBatches: parseInt(process.env.DELAY_BETWEEN_BATCHES || '30000'),
    checkInterval: parseInt(process.env.CHECK_INTERVAL || '60000'),
    queueThreshold: parseInt(process.env.QUEUE_THRESHOLD || '100'),
  },

  // Authentication
  jwtSecret: process.env.JWT_SECRET,
  apiKey: process.env.API_KEY,

  // Anthropic AI
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
} as const;

// Validation
if (!config.databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

export type Config = typeof config;
```

**Files to Update**:
```
✓ server/src/index.ts           (replace hardcoded values)
✓ server/src/lib/tcad-scraper.ts (use config.scraper)
✓ server/src/scripts/continuous-batch-scraper.ts (use config.batchScraper)
✓ server/src/queues/scraper.queue.ts (use config.redis*)
```

**Benefits**:
- Single source of truth for all configuration
- Easy to override per environment
- Type-safe config access
- Immediate validation on startup

**Risk**: Low
**Effort**: 4 hours
**Priority**: High

---

#### Step 1.2: Update .env.example Files

**Action**: Consolidate and document all environment variables

**Update**: `/server/.env.example`
```bash
# Required
DATABASE_URL="postgresql://user:password@host:5432/tcad_scraper"

# Redis/Queue
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info

# Frontend
FRONTEND_URL=http://localhost:5173

# Rate Limiting
API_RATE_LIMIT=100           # requests per 15 minutes
SCRAPE_RATE_LIMIT=5          # requests per minute

# Scraper Configuration
SCRAPER_HEADLESS=true
SCRAPER_TIMEOUT=30000        # milliseconds
SCRAPER_RETRY_ATTEMPTS=3
SCRAPER_RETRY_DELAY=2000     # milliseconds
SCRAPER_USER_AGENTS="Mozilla/5.0...,Mozilla/5.0...,Mozilla/5.0..."

# TCAD API
TCAD_BASE_URL=https://travis.prodigycad.com
TCAD_API_URL=https://prod-container.trueprodigyapi.com
TCAD_API_KEY=                # Optional: Pre-fetched API token

# Batch Scraper
TARGET_PROPERTIES=400000
BATCH_SIZE=75
DELAY_BETWEEN_BATCHES=30000  # milliseconds
CHECK_INTERVAL=60000         # milliseconds
QUEUE_THRESHOLD=100

# Authentication (Optional for production)
JWT_SECRET=your-secure-random-secret
API_KEY=your-api-key

# AI Features (Optional)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

**Action**: Remove duplicate `/.env.example` if not needed

**Risk**: Low
**Effort**: 1 hour
**Priority**: High

---

### Phase 2: Script Organization and Consolidation (High Priority)

**Goal**: Reduce 38 root scripts to 8-10 organized utilities

#### Step 2.1: Create Organized Utility Structure

**New Directory Structure**:
```
server/
├── src/
│   ├── cli/                    ← NEW: Command-line utilities
│   │   ├── queue-manager.ts   ← Consolidates 8 "add-*" scripts
│   │   ├── queue-analyzer.ts  ← Consolidates 3 "analyze-*" scripts
│   │   ├── data-cleaner.ts    ← Consolidates 6 "remove-*"/"filter-*" scripts
│   │   ├── db-stats.ts        ← Consolidates 5 "check-*" scripts
│   │   └── index.ts           ← CLI router
│   └── ...
└── scripts-archive/           ← NEW: Archive old one-off scripts
    └── 2024-11-debugging/
```

**Implementation Details**:

##### A. Queue Manager CLI (`server/src/cli/queue-manager.ts`)

**Consolidates**:
- `add-business-batch-3.ts`
- `add-business-terms.ts`
- `add-estate-job.ts`
- `add-more-business-terms.ts`
- `add-priority-jobs.ts`
- `add-terms-and-dedupe.ts`
- `aggressive-cleanup.ts`
- `stop-all-jobs.ts`

**New Interface**:
```bash
# Add jobs
npm run queue add-terms <file.txt>
npm run queue add-business <file.txt>
npm run queue add-priority <term1> <term2>...

# Cleanup
npm run queue cleanup --aggressive
npm run queue stop-all
npm run queue remove-duplicates

# Status
npm run queue status
npm run queue count
```

**Implementation**:
```typescript
// server/src/cli/queue-manager.ts
import { Command } from 'commander';
import { scraperQueue } from '../queues/scraper.queue';
import { prisma } from '../lib/prisma';

const program = new Command();

program
  .name('queue-manager')
  .description('Manage scraper job queue');

program
  .command('add-terms')
  .description('Add search terms from file')
  .argument('<file>', 'Path to file with one term per line')
  .option('--priority', 'Add as priority jobs')
  .option('--dedupe', 'Remove duplicates from database first')
  .action(async (file, options) => {
    // Consolidated logic from multiple "add-*" scripts
  });

program
  .command('cleanup')
  .description('Clean up queue jobs')
  .option('--aggressive', 'Remove all completed/failed jobs')
  .option('--older-than <days>', 'Remove jobs older than N days')
  .action(async (options) => {
    // Consolidated logic from cleanup scripts
  });

program
  .command('stop')
  .description('Stop all active/pending jobs')
  .action(async () => {
    // Logic from stop-all-jobs.ts
  });

program
  .command('status')
  .description('Show queue status')
  .action(async () => {
    const [waiting, active, completed, failed] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getCompletedCount(),
      scraperQueue.getFailedCount(),
    ]);
    console.log({ waiting, active, completed, failed });
  });

program.parse();
```

**Risk**: Medium (requires testing all consolidated functionality)
**Effort**: 12 hours
**Priority**: High

---

##### B. Queue Analyzer CLI (`server/src/cli/queue-analyzer.ts`)

**Consolidates**:
- `analyze-queue.ts`
- `analyze-successful-terms.ts`
- `analyze-zero-results.ts`

**New Interface**:
```bash
npm run analyze queue           # Overall queue health
npm run analyze success         # Successful term patterns
npm run analyze failures        # Zero-result patterns
npm run analyze performance     # Performance metrics
```

**Risk**: Low
**Effort**: 6 hours
**Priority**: Medium

---

##### C. Data Cleaner CLI (`server/src/cli/data-cleaner.ts`)

**Consolidates**:
- `filter-numbers-and-short.ts`
- `filter-short-terms.ts`
- `filter-zipcodes.ts`
- `remove-all-duplicates.ts`
- `remove-compound-names.ts`
- `remove-duplicate-terms.ts`
- `remove-inefficient-terms.ts`

**New Interface**:
```bash
npm run clean properties-duplicates
npm run clean search-terms --short --numbers --compounds
npm run clean inefficient-terms --threshold 0.1
```

**Risk**: Medium (data modification operations)
**Effort**: 10 hours
**Priority**: Medium

---

##### D. Database Stats CLI (`server/src/cli/db-stats.ts`)

**Consolidates**:
- `check-all-results.ts`
- `check-db-stats.ts`
- `check-priority-results.ts`
- `check-property-count.ts`
- `check-rate.ts`

**New Interface**:
```bash
npm run stats summary          # Quick overview
npm run stats properties       # Property statistics
npm run stats rate             # Scraping rate analysis
npm run stats search-terms     # Term performance
```

**Risk**: Low
**Effort**: 4 hours
**Priority**: Low

---

#### Step 2.2: Archive Old Scripts

**Action**: Move deprecated/one-time scripts to archive

**Files to Archive**:
```bash
mkdir -p server/scripts-archive/2024-11-debugging
mv server/test-*.ts server/scripts-archive/2024-11-debugging/
mv server/inspect-*.ts server/scripts-archive/2024-11-debugging/
mv server/debug-*.ts server/scripts-archive/2024-11-debugging/
mv server/check-available-years.ts server/scripts-archive/2024-11-debugging/
```

**Files to Delete** (after confirming not in use):
```bash
rm server/src/scripts/test-*.ts           # 13 test files
rm server/src/scripts/diagnose-*.ts       # 7 diagnostic files
rm server/src/scripts/check-column-ids.ts
rm /scraper-with-db.ts                     # Legacy root scraper
```

**Files to Keep in Production**:
```
server/src/scripts/
├── continuous-batch-scraper.ts  ← Production scraper
├── batch-scrape.ts              ← Manual batch scraping
└── worker.ts                    ← Queue worker
```

**Risk**: Low (only archiving, not deleting)
**Effort**: 2 hours
**Priority**: High

---

### Phase 3: Type System Unification (Medium Priority)

**Goal**: Single source of truth for data types shared between frontend and backend

#### Step 3.1: Create Shared Types Package

**Action**: Create `/shared/types/` directory

**New Structure**:
```
shared/
└── types/
    ├── property.types.ts      ← Shared property definitions
    ├── api.types.ts           ← API request/response types
    ├── scraper.types.ts       ← Scraper configuration types
    └── index.ts               ← Barrel export
```

**Implementation**:

```typescript
// shared/types/property.types.ts
/**
 * Core property data structure
 * Matches database schema and API responses
 */
export interface Property {
  id: string;
  propertyId: string;           // TCAD unique identifier
  name: string;                 // Owner name
  propType: string;             // Property type
  city: string | null;
  propertyAddress: string;
  assessedValue: number | null;
  appraisedValue: number;
  geoId: string | null;
  description: string | null;
  searchTerm: string | null;
  scrapedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Property data as returned from scraper (before database insert)
 */
export interface PropertyData {
  propertyId: string;
  name: string;
  propType: string;
  city: string | null;
  propertyAddress: string;
  assessedValue: number;
  appraisedValue: number;
  geoId: string | null;
  description: string | null;
}

/**
 * Property filters for API queries
 */
export interface PropertyFilters {
  city?: string;
  propType?: string;
  minValue?: number;
  maxValue?: number;
  searchTerm?: string;
}
```

```typescript
// shared/types/api.types.ts
import { Property, PropertyFilters } from './property.types';

export interface PaginatedRequest {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type PropertiesResponse = PaginatedResponse<Property>;

export interface ScrapeRequest {
  searchTerm: string;
  userId?: string;
}

export interface ScrapeResponse {
  jobId: string;
  message: string;
}
```

**Update TypeScript Configs**:

```json
// tsconfig.json (root)
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  },
  "include": ["src", "shared"]
}
```

```json
// server/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src", "../shared"]
}
```

**Migration Steps**:
1. Create shared types
2. Update backend imports: `import { Property } from '@shared/types'`
3. Update frontend imports: `import { Property } from '@shared/types'`
4. Remove old type files
5. Add mapping utilities if needed for snake_case/camelCase

**Risk**: Medium (requires careful migration and testing)
**Effort**: 8 hours
**Priority**: Medium

---

### Phase 4: Test Cleanup and Consolidation (Medium Priority)

**Goal**: Simplify test configuration and remove obsolete tests

#### Step 4.1: Consolidate Jest Configuration

**Current State**:
- `/jest.config.js` - Root config
- `/jest.client.config.js` - Client config (duplicate?)
- `/jest.setup.js` - Setup file

**Analysis Needed**:
1. Determine if `jest.client.config.js` is actually used
2. Check if it duplicates `jest.config.js`

**Proposed Action**:
```bash
# If jest.client.config.js is duplicate:
rm jest.client.config.js

# Update package.json
{
  "scripts": {
    "test": "jest",
    "test:server": "cd server && jest",
    "test:client": "jest --config jest.config.js",
    "test:all": "npm run test:server && npm run test:client"
  }
}
```

**Create Server Jest Config**:
```javascript
// server/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
  ],
};
```

**Risk**: Low
**Effort**: 2 hours
**Priority**: Medium

---

#### Step 4.2: Remove Obsolete Test Scripts

**Action**: Delete or archive outdated test files

**Test Scripts to Archive/Delete**:
```
server/src/scripts/test-ag-grid-data.ts        ← AG Grid approach deprecated
server/src/scripts/test-direct-api-bypass.ts   ← API method now standard
server/src/scripts/test-network-interception.ts
server/src/scripts/test-optimized-search.ts
server/src/scripts/test-pagesize-limits.ts     ← Pagination issue resolved
server/src/scripts/test-pagination.ts          ← Pagination issue resolved
server/src/scripts/diagnose-pagination.ts      ← Pagination issue resolved
```

**Keep Only**:
```
server/src/__tests__/               ← Proper unit/integration tests
server/src/scripts/batch-scrape.ts  ← Production utility
server/src/scripts/continuous-batch-scraper.ts
server/src/scripts/worker.ts
```

**Risk**: Low (can restore from git if needed)
**Effort**: 1 hour
**Priority**: Low

---

### Phase 5: Dead Code Removal (Low Priority)

**Goal**: Remove commented code and unused implementations

#### Step 5.1: Remove Deprecated Scraper Methods

**Action**: Clean up `server/src/lib/tcad-scraper.ts`

**Current State**:
- 970 lines of commented-out browser scraping method
- Duplicate `scrapePropertiesViaAPI` methods (lines 99-325 and 1167-1282)

**Proposed Changes**:
```typescript
// server/src/lib/tcad-scraper.ts
export class TCADScraper {
  // REMOVE: Lines 332-970 (commented browser scraping method)
  // REMOVE: Lines 1167-1282 (duplicate scrapePropertiesViaAPI)
  // KEEP: Lines 99-325 (active API scraping method)
  // KEEP: Helper methods and cleanup logic
}
```

**Before**: 1,318 lines
**After**: ~450 lines (66% reduction!)

**Risk**: Low (all commented code, not in use)
**Effort**: 1 hour
**Priority**: Low

---

#### Step 5.2: Remove Legacy Scraper Files

**Files to Delete**:
```bash
rm /scraper-with-db.ts              # 3,005 lines - Legacy implementation
rm /docs/legacy_scraper.ts          # Historical reference
rm /tcad-scraper.cjs                # 8,751 lines - Old CommonJS version
rm /tcad-cli.cjs                    # 6,186 lines - Old CLI
rm /test-scraper.js                 # 2,144 lines - Old test
```

**Risk**: Low (can restore from git history)
**Effort**: 30 minutes
**Priority**: Low

---

### Phase 6: Documentation and Consolidation (Medium Priority)

**Goal**: Update documentation to reflect refactoring and improve developer onboarding

#### Step 6.1: Update README.md

**Sections to Update**:
1. Configuration section - reference new config module
2. Scripts section - document new CLI utilities
3. Remove references to deprecated scripts
4. Add "Migration Guide" section

**Risk**: Low
**Effort**: 3 hours
**Priority**: Medium

---

#### Step 6.2: Create Developer Guide

**New File**: `/docs/DEVELOPER_GUIDE.md`

**Contents**:
```markdown
# Developer Guide

## Configuration
All configuration is managed through environment variables.
See `server/src/config/index.ts` for available options.

## CLI Utilities
- `npm run queue` - Manage scraper job queue
- `npm run analyze` - Analyze queue and performance
- `npm run clean` - Data cleanup utilities
- `npm run stats` - Database statistics

## Project Structure
[Updated structure after refactoring]

## Common Tasks
[Step-by-step guides for common operations]
```

**Risk**: Low
**Effort**: 4 hours
**Priority**: Medium

---

## Risk Assessment and Mitigation

### High-Risk Changes

#### 1. Configuration Consolidation
**Risk**: Breaking environment-specific configurations
**Probability**: Medium
**Impact**: High (could break production)

**Mitigation**:
- Test in development first
- Document all environment variables
- Provide migration guide
- Keep backward compatibility initially
- Add validation for required variables

**Rollback Plan**:
- Keep old configuration files until fully tested
- Feature flag for new config module
- Easy revert via git

---

#### 2. Script Consolidation
**Risk**: Losing functionality from merged scripts
**Probability**: Low-Medium
**Impact**: Medium (affects operations tools)

**Mitigation**:
- Archive original scripts before deletion
- Comprehensive testing of consolidated tools
- Document all command mappings
- Keep originals in git history

**Rollback Plan**:
- Scripts archived in `scripts-archive/`
- Can restore from git at any time

---

### Medium-Risk Changes

#### 3. Type System Unification
**Risk**: Breaking API contracts or frontend-backend communication
**Probability**: Low
**Impact**: High (affects application functionality)

**Mitigation**:
- Incremental migration
- Add runtime validation with Zod
- Comprehensive API tests
- Mapping layer during transition

**Rollback Plan**:
- Keep old type files until migration complete
- Can run with both type systems temporarily

---

#### 4. Test File Removal
**Risk**: Removing tests that are still relevant
**Probability**: Low
**Impact**: Low (can recreate if needed)

**Mitigation**:
- Archive instead of delete
- Review each test file purpose
- Keep in git history

**Rollback Plan**:
- Restore from `scripts-archive/`
- Restore from git history

---

### Low-Risk Changes

#### 5. Dead Code Removal
**Risk**: Minimal - all code is commented or confirmed unused
**Probability**: Very Low
**Impact**: Very Low

**Mitigation**:
- Git history preserves everything
- Review before deletion

**Rollback Plan**:
- Simple git revert

---

## Testing Strategy

### Phase 1 Testing: Configuration

**Unit Tests**:
```typescript
// server/src/config/__tests__/config.test.ts
describe('Configuration Module', () => {
  it('should load default values when env vars not set', () => {
    // Test defaults
  });

  it('should override with environment variables', () => {
    // Test overrides
  });

  it('should throw error when required vars missing', () => {
    // Test validation
  });

  it('should parse numeric values correctly', () => {
    // Test type coercion
  });
});
```

**Integration Tests**:
- Start server with new config
- Verify all features work
- Test in Docker environment
- Test with Doppler

**Manual Testing Checklist**:
```
□ Server starts successfully
□ Scraper accepts config values
□ Batch scraper uses new settings
□ Rate limiting works correctly
□ CORS configuration works
□ Can override via .env
□ Can override via Doppler
```

---

### Phase 2 Testing: Script Consolidation

**Unit Tests**:
```typescript
// server/src/cli/__tests__/queue-manager.test.ts
describe('Queue Manager CLI', () => {
  it('should add terms from file', async () => {});
  it('should remove duplicates', async () => {});
  it('should cleanup old jobs', async () => {});
  it('should stop all jobs', async () => {});
});
```

**Integration Tests**:
```typescript
// Test each consolidated command
describe('CLI Integration', () => {
  it('npm run queue add-terms <file>', async () => {});
  it('npm run queue cleanup --aggressive', async () => {});
  it('npm run analyze success', async () => {});
  it('npm run clean properties-duplicates', async () => {});
});
```

**Manual Testing Checklist**:
```
□ Queue manager adds jobs correctly
□ Queue analyzer produces accurate reports
□ Data cleaner removes correct records
□ Database stats show accurate information
□ All CLI commands have help text
□ Error messages are clear
```

---

### Phase 3 Testing: Type System

**Type Checking**:
```bash
npm run type-check           # Should pass with no errors
cd server && npm run type-check
```

**Unit Tests**:
```typescript
// Validate type mappings
describe('Type Mappings', () => {
  it('should map API response to Property type', () => {});
  it('should serialize Property for frontend', () => {});
});
```

**Integration Tests**:
```typescript
// Test full API flow
describe('API Contract', () => {
  it('GET /api/properties returns correct shape', async () => {
    const response = await request(app).get('/api/properties');
    // Validate response matches Property[] type
  });
});
```

**Manual Testing Checklist**:
```
□ Frontend displays properties correctly
□ Property details page works
□ Search returns correct results
□ Filters work correctly
□ No type errors in browser console
□ No type errors in server logs
```

---

### Phase 4-6 Testing

**Test Execution**:
```bash
npm run test              # All root tests
npm run test:server       # Server tests
npm run test:coverage     # Coverage report
```

**Documentation Testing**:
```
□ README instructions work
□ All npm scripts execute
□ Developer guide is accurate
□ Configuration examples work
```

---

## Success Metrics

### Quantitative Metrics

#### Before Refactoring:
```
Total TypeScript Files:      92
Server Root Scripts:         38 (4,016 lines)
Server Script Files:         21 (156KB)
Configuration Files:         10+
Test Config Files:           3
Frontend Type Files:         2
Backend Type Files:          2
Hardcoded Values:            ~50
```

#### After Refactoring Targets:
```
Total TypeScript Files:      60-65 (30% reduction)
Server Root Scripts:         0 (archived)
Server CLI Utilities:        4-5 organized modules
Configuration Files:         3 (down from 10+)
Test Config Files:           2 (down from 3)
Shared Type Files:           1 set
Hardcoded Values:            0 (all in config)
```

#### Code Reduction:
```
Removed dead code:           ~2,000 lines
Consolidated scripts:        ~1,500 lines savings
Archived test scripts:       ~50KB
Total lines removed:         ~3,500-4,000
```

---

### Qualitative Metrics

#### Developer Experience:
- **Before**: "Where do I find the queue management script?"
- **After**: "Run `npm run queue --help`"

- **Before**: Search through 38 root scripts
- **After**: 4 organized CLI tools

- **Before**: Change timeout in 3 places
- **After**: Change `SCRAPER_TIMEOUT` in one place

#### Code Maintainability:
- ✅ Single source of truth for configuration
- ✅ Clear organization of utilities
- ✅ Consistent type system
- ✅ Documented patterns
- ✅ Discoverable CLI commands

#### Onboarding Time:
- **Before**: ~2-3 hours to understand structure
- **After**: ~1 hour with clear documentation

---

### Success Criteria

✅ **Phase 1 Complete** when:
- All hardcoded values moved to `config/index.ts`
- Server starts successfully with new config
- All features work with config values
- Documentation updated

✅ **Phase 2 Complete** when:
- 38 root scripts reduced to <10 files
- All CLI utilities work correctly
- Old scripts archived
- `npm run queue`, `npm run analyze`, etc. work

✅ **Phase 3 Complete** when:
- Shared types package created
- Frontend and backend use same types
- No type errors in compilation
- API contract tests pass

✅ **Phase 4 Complete** when:
- Jest configs consolidated
- Obsolete tests removed/archived
- Test coverage maintained or improved

✅ **Phase 5 Complete** when:
- Dead code removed
- tcad-scraper.ts reduced by >60%
- Legacy files archived

✅ **Phase 6 Complete** when:
- README updated
- Developer guide created
- All documentation accurate

---

## Implementation Timeline

### Week 1: Configuration and High-Priority Scripts
- **Days 1-2**: Phase 1 - Configuration consolidation
- **Days 3-5**: Phase 2 (Part 1) - Queue Manager and Analyzer CLI

### Week 2: Remaining Scripts and Type System
- **Days 1-2**: Phase 2 (Part 2) - Data Cleaner and Stats CLI
- **Days 3-5**: Phase 3 - Type system unification

### Week 3: Cleanup and Documentation
- **Days 1-2**: Phase 4 - Test consolidation
- **Day 3**: Phase 5 - Dead code removal
- **Days 4-5**: Phase 6 - Documentation

### Total Estimated Time: 15 business days (3 weeks)

---

## Appendix A: File Mapping

### Scripts to Consolidate

#### Queue Management → `cli/queue-manager.ts`
```
add-business-batch-3.ts       → queue add-business
add-business-terms.ts          → queue add-business
add-estate-job.ts              → queue add-terms --priority
add-more-business-terms.ts     → queue add-business
add-priority-jobs.ts           → queue add-terms --priority
add-terms-and-dedupe.ts        → queue add-terms --dedupe
aggressive-cleanup.ts          → queue cleanup --aggressive
stop-all-jobs.ts               → queue stop
```

#### Queue Analysis → `cli/queue-analyzer.ts`
```
analyze-queue.ts               → analyze queue
analyze-successful-terms.ts    → analyze success
analyze-zero-results.ts        → analyze failures
check-queue-status.ts          → analyze queue --live
```

#### Data Cleanup → `cli/data-cleaner.ts`
```
filter-numbers-and-short.ts    → clean search-terms --numbers --short
filter-short-terms.ts          → clean search-terms --short
filter-zipcodes.ts             → clean search-terms --zipcodes
remove-all-duplicates.ts       → clean properties-duplicates
remove-compound-names.ts       → clean search-terms --compounds
remove-duplicate-terms.ts      → clean search-terms-duplicates
remove-inefficient-terms.ts    → clean search-terms --inefficient
```

#### Database Stats → `cli/db-stats.ts`
```
check-all-results.ts           → stats properties --all
check-db-stats.ts              → stats summary
check-priority-results.ts      → stats properties --priority
check-property-count.ts        → stats properties --count
check-rate.ts                  → stats rate
```

---

## Appendix B: Configuration Mapping

### Hardcoded Values → Environment Variables

```
# Server Configuration
30000 (timeout)                    → SCRAPER_TIMEOUT=30000
3 (retry attempts)                 → SCRAPER_RETRY_ATTEMPTS=3
2000 (retry delay)                 → SCRAPER_RETRY_DELAY=2000

# Batch Scraper
400000 (target properties)         → TARGET_PROPERTIES=400000
75 (batch size)                    → BATCH_SIZE=75
30000 (delay between batches)      → DELAY_BETWEEN_BATCHES=30000
60000 (check interval)             → CHECK_INTERVAL=60000
100 (queue threshold)              → QUEUE_THRESHOLD=100

# Rate Limiting
100 requests/15min                 → API_RATE_LIMIT=100
5 scrapes/min                      → SCRAPE_RATE_LIMIT=5

# URLs
travis.prodigycad.com              → TCAD_BASE_URL
prod-container.trueprodigyapi.com  → TCAD_API_URL

# User Agents Array
3 hardcoded agents                 → SCRAPER_USER_AGENTS (comma-separated)

# Viewports Array
3 hardcoded sizes                  → (Keep in code, but configurable)
```

---

## Appendix C: Testing Checklist

### Pre-Refactoring Tests
```bash
# Run existing tests to establish baseline
npm run test
cd server && npm run test

# Document current test coverage
npm run test:coverage

# Capture current behavior
- Server starts on port 3001
- Can queue jobs via API
- Batch scraper runs successfully
- All scripts execute without errors
```

### Post-Refactoring Tests
```bash
# Verify all tests still pass
npm run test
npm run test:coverage

# Verify configuration
- Server uses environment variables
- Can override all settings
- Validation catches missing required vars

# Verify CLI utilities
- All npm run commands work
- CLI help text displays
- Each command produces expected output

# Verify type system
- TypeScript compilation succeeds
- No type errors in IDE
- API responses match expected types
```

---

## Appendix D: Rollback Procedures

### Configuration Rollback
```bash
git checkout HEAD -- server/src/config/
git checkout HEAD -- server/src/index.ts
git checkout HEAD -- server/src/lib/tcad-scraper.ts
# Restart services
```

### Script Consolidation Rollback
```bash
# Restore archived scripts
cp -r server/scripts-archive/2024-11-debugging/* server/
# Or from git
git checkout HEAD -- server/*.ts
```

### Type System Rollback
```bash
git checkout HEAD -- shared/
git checkout HEAD -- server/src/types/
git checkout HEAD -- src/types/
# Update imports back to old structure
```

### Full Rollback
```bash
# Revert all changes
git revert <commit-hash>
# Or reset to pre-refactoring state
git reset --hard <pre-refactoring-commit>
```

---

## Conclusion

This refactoring plan provides a systematic approach to simplifying and consolidating the TCAD scraper codebase. The phased approach minimizes risk while delivering incremental improvements.

**Key Benefits**:
1. ✅ **Simplified**: Reduced from 38 root scripts to 4-5 organized CLI tools
2. ✅ **Configurable**: All values centralized in config module with env var overrides
3. ✅ **Maintainable**: Clear organization, single source of truth, consistent patterns
4. ✅ **Documented**: Comprehensive guide for developers

**Next Steps**:
1. Review and approve this plan
2. Begin Phase 1: Configuration consolidation
3. Test thoroughly at each phase
4. Update documentation continuously
5. Collect feedback and adjust as needed

---

**Document Version**: 1.0
**Last Updated**: January 5, 2025
**Status**: Ready for Review and Approval
