# Comprehensive Codebase Analysis: TCAD Property Scraper

## 1. Project Overview

### Project Type
**Backend API Server with Web Scraping Capabilities**

This is a production-ready Node.js/Express backend service designed to scrape property data from the Travis Central Appraisal District (TCAD) website and provide it through a RESTful API with AI-powered search capabilities.

### Core Technology Stack
- **Runtime**: Node.js 18+ with TypeScript 5.3.3
- **Framework**: Express.js 4.18.2
- **Database**: PostgreSQL 15+ (via Prisma ORM 5.8.0)
- **Queue System**: BullMQ (Bull 4.12.0) with Redis 7+
- **Web Scraping**: Playwright 1.56.1 (Chromium automation)
- **AI Integration**: Anthropic Claude API (claude-3-haiku)
- **Process Management**: PM2 (via ecosystem.config.js)

### Architecture Pattern
**Job Queue-based Web Scraper with RESTful API**

The application follows a **distributed job processing architecture** with:
- Express API layer for HTTP endpoints
- BullMQ queue system for asynchronous scraping jobs
- Playwright-based browser automation for data extraction
- PostgreSQL for persistent storage
- Redis for queue state management
- Centralized configuration module

### Language & Version
- **Primary Language**: TypeScript (strict mode enabled)
- **Compilation Target**: ES2022
- **Module System**: CommonJS

---

## 2. Detailed Directory Structure Analysis

### `/src` - Main Application Source
**Purpose**: Contains all TypeScript source code for the application

#### `/src/config` - Configuration Module
**Role**: Single source of truth for all application configuration
- **`index.ts`**: Centralized config module with environment variable parsing
  - Exports `config` object with nested configuration sections
  - Provides `validateConfig()` for startup validation
  - Includes `logConfigSummary()` for debugging
  - Handles 70+ environment variables across 15+ configuration domains

#### `/src/controllers` - API Controllers
**Role**: Business logic layer for API endpoints
- **`property.controller.ts`**: Handles all property-related operations
  - `scrapeProperties()`: Queues new scraping jobs
  - `getJobStatus()`: Returns scrape job progress
  - `getProperties()`: Queries database with filters
  - `naturalLanguageSearch()`: Claude AI-powered search
  - `getStats()`: Aggregate statistics
  - `addMonitoredSearch()`: Scheduled monitoring setup

#### `/src/lib` - Core Libraries
**Role**: Reusable business logic and services
- **`tcad-scraper.ts`**: Main web scraping engine (1342 lines)
  - `TCADScraper` class: Browser automation orchestration
  - `scrapePropertiesViaAPI()`: Direct API method (recommended, bypasses 20-result limit)
  - Token management with automatic refresh integration
  - Retry logic with exponential backoff
  - Human-like behavior simulation (random delays, user agents)

- **`claude.service.ts`**: AI integration for natural language queries
  - Converts user questions to SQL queries
  - Uses Claude Haiku model for cost efficiency

- **`prisma.ts`**: Database client singleton

- **`logger.ts`**: Winston logger configuration

#### `/src/middleware` - Express Middleware
**Role**: Request/response processing pipeline
- **`auth.ts`**: Authentication middleware
  - `apiKeyAuth`: API key validation
  - `jwtAuth`: JWT token verification
  - `optionalAuth`: Allows both authenticated/unauthenticated
  - `generateToken()`: JWT creation utility

- **`xcontroller.middleware.ts`**: Security middleware
  - CSP (Content Security Policy) with nonce generation
  - XSS protection

- **`validation.middleware.ts`**: Request validation with Zod schemas

- **`error.middleware.ts`**: Global error handling

#### `/src/queues` - Job Queue System
**Role**: Asynchronous task processing
- **`scraper.queue.ts`**: BullMQ queue configuration
  - Processes scraping jobs with concurrency control
  - Database integration (creates `ScrapeJob` records)
  - Progress tracking (10% → 30% → 70% → 100%)
  - Automatic retry with exponential backoff
  - Job cleanup after 24 hours
  - Rate limiting per search term

#### `/src/routes` - API Routes
**Role**: HTTP endpoint definitions
- **`property.routes.ts`**: Property API endpoints
  - `POST /api/properties/scrape`: Trigger scrape job
  - `GET /api/properties/jobs/:jobId`: Job status
  - `GET /api/properties`: Query database
  - `POST /api/properties/search`: AI-powered search
  - `GET /api/properties/stats`: Statistics
  - `POST /api/properties/monitor`: Add monitored search

- **`app.routes.ts`**: Frontend SPA routes

#### `/src/services` - Business Services
**Role**: Standalone service modules
- **`token-refresh.service.ts`**: TCAD API token auto-refresh
  - Launches headless browser every 4.5 minutes
  - Captures Authorization header from network requests
  - Maintains in-memory token cache
  - Health monitoring and statistics
  - Cron-based or interval-based scheduling

#### `/src/scripts` - Utility Scripts
**Role**: Standalone executable scripts
- **Batch enqueueing scripts**: 10 different entity type batches
  - `enqueue-llc-batch.ts`, `enqueue-trust-batch.ts`, etc.
  - Generate search terms for different business entity types

- **Testing scripts**: API validation, queue flow testing
  - `test-api-token-config.ts`: Token configuration validation
  - `test-queue-job-flow.ts`: End-to-end job processing

- **Diagnostic scripts**: Pagination, AG Grid debugging
  - `diagnose-page.ts`, `diagnose-pagination.ts`

- **Worker script**: `worker.ts` for standalone job processing

#### `/src/schedulers` - Scheduled Tasks
**Role**: Cron job definitions
- **`scrape-scheduler.ts`**: Manages monitored search execution
  - Runs periodic scrapes for monitored search terms
  - Integration with job queue

#### `/src/types` - TypeScript Type Definitions
**Role**: Shared type definitions and schemas
- **`property.types.ts`**: Zod schemas and TypeScript interfaces
  - `PropertyData`, `ScrapeJobData`, `ScrapeJobResult`
  - Request/response validation schemas

- **`index.ts`**: Re-exports all types

#### `/src/utils` - Utility Functions
**Role**: Helper functions
- **`deduplication.ts`**: Property deduplication logic

#### `/src/__tests__` - Test Files
**Role**: Integration and security tests
- **`integration.test.ts`**: End-to-end API tests
- **`security.test.ts`**: Security vulnerability tests

### `/prisma` - Database Schema
**Role**: Database schema and migrations
- **`schema.prisma`**: Prisma schema definition
  - `Property`: Main property data table
  - `ScrapeJob`: Job tracking and history
  - `MonitoredSearch`: Scheduled scraping configuration

- **`/migrations`**: Database migration history
  - `20251028203525_init/`: Initial schema creation

### `/dist` - Compiled JavaScript
**Role**: TypeScript compilation output
- Contains `.js`, `.d.ts`, and `.js.map` files
- Generated by `tsc` build process
- Mirrors `/src` structure

### `/data` - Analysis Data
**Role**: Scraping analytics and optimization data
- `search-term-map.json`: Term → result count mapping
- `high-performing-terms.json`: Best-performing search patterns
- `zero-result-analysis.json`: Failed search analysis

### `/fallbackBrowserSearch` - Legacy Code
**Role**: Deprecated DOM-based scraping methods
- Contains old scraper implementations
- Kept for reference but not actively used

### `/one-off-enqueues` - One-time Scripts
**Role**: Historical batch job scripts
- `add-business-batch-3.ts`: Business entity batch
- `add-business-terms.ts`: Business search terms
- `add-terms-and-dedupe.ts`: Deduplication script

### Root Directory Files
- **`ecosystem.config.js`**: PM2 process manager configuration
- **`tsconfig.json`**: TypeScript compiler options
- **`Dockerfile`**: Container build instructions (Alpine Linux + Chromium)
- **`.env.example`**: Environment variable template
- **`package.json`**: Dependencies and npm scripts

---

## 3. File-by-File Breakdown

### Core Application Files

#### **Main Entry Points**

**`src/index.ts`** (275 lines)
- **Purpose**: Express server initialization and lifecycle management
- **Key Functions**:
  - Express app setup with security middleware (Helmet, CORS)
  - Rate limiting (API: 100 req/15min, Scraper: 5 req/min)
  - Bull Dashboard integration at `/admin/queues`
  - Health check endpoints (`/health`, `/health/queue`, `/health/token`)
  - Route mounting and error handling
  - Graceful shutdown handlers (SIGTERM, SIGINT)
  - Token refresh service initialization
- **Connections**:
  - Uses `config` from `./config`
  - Mounts `propertyRouter` and `appRouter`
  - Initializes `scraperQueue` and `tokenRefreshService`

**`src/lib/tcad-scraper.ts`** (1342 lines)
- **Purpose**: Core web scraping engine using Playwright
- **Architecture**:
  - `TCADScraper` class with browser lifecycle management
  - Supports both API-based and DOM-based scraping
  - Bright Data proxy support for IP rotation
- **Key Methods**:
  - `scrapePropertiesViaAPI()`: **Recommended method** - Directly calls TCAD backend API
    - Bypasses 20-result UI limitation
    - Fetches up to 1000 results per API call
    - Uses string injection to avoid TypeScript transformation issues
    - Implements adaptive page size (1000 → 500 → 100 → 50) for truncation handling
  - `initialize()`: Browser launch with anti-detection settings
  - `cleanup()`: Browser resource cleanup
- **Token Handling**:
  - Priority: Auto-refresh service → Environment config → Browser capture
- **Human Behavior Simulation**:
  - Random user agents (Windows/Mac/Linux)
  - Variable viewports (4K, 1440p, 1080p)
  - Random typing delays (50-150ms)
  - Human-like mouse movements

**`src/queues/scraper.queue.ts`** (191 lines)
- **Purpose**: BullMQ job queue processor
- **Configuration**:
  - Queue name: `scraper-queue`
  - Concurrency: 2 workers (configurable)
  - Retry: 3 attempts with exponential backoff
  - Cleanup: Removes jobs after 24 hours
- **Job Processing Flow**:
  1. Creates `ScrapeJob` database record (status: `processing`)
  2. Initializes `TCADScraper` instance
  3. Calls `scrapePropertiesViaAPI()`
  4. Bulk upserts properties to database
  5. Updates job status to `completed` or `failed`
- **Rate Limiting**:
  - Tracks active jobs per search term
  - Minimum 5 second delay between identical searches
  - In-memory cache with automatic cleanup

#### **Configuration Files**

**`src/config/index.ts`** (331 lines)
- **Purpose**: Single source of truth for all configuration
- **Structure**: Nested configuration object with 15 sections:
  - `env`: Environment detection (dev/prod/test)
  - `doppler`: Secrets management integration
  - `server`: Host, port, logging
  - `database`: PostgreSQL connection
  - `redis`: Redis connection for BullMQ
  - `queue`: Job queue settings
  - `rateLimit`: API and scraper rate limits
  - `cors`: CORS policy configuration
  - `security`: Helmet, CSP, HSTS settings
  - `auth`: API key and JWT configuration
  - `scraper`: Browser automation settings
  - `claude`: AI integration config
  - `logging`: Winston logger settings
  - `frontend`: Frontend app configuration
  - `monitoring`: Sentry integration (optional)
- **Validation**: `validateConfig()` checks critical env vars at startup
- **Logging**: `logConfigSummary()` prints safe (non-secret) config summary

#### **Data Layer**

**`prisma/schema.prisma`** (58 lines)
- **Models**:
  1. **Property** (12 fields)
     - `propertyId`: Unique TCAD property ID
     - `name`: Owner name
     - `propType`: Property type (residential, commercial, etc.)
     - `city`, `propertyAddress`: Location data
     - `assessedValue`, `appraisedValue`: Valuation
     - `geoId`, `description`: Additional metadata
     - `searchTerm`: Which search found this property
     - `scrapedAt`, `createdAt`, `updatedAt`: Timestamps
     - **Indexes**: 5 indexes on common query fields

  2. **ScrapeJob** (7 fields)
     - Job tracking and history
     - `status`: pending/processing/completed/failed
     - `resultCount`: Number of properties found
     - `error`: Error message if failed
     - **Indexes**: On status+timestamp and search term

  3. **MonitoredSearch** (6 fields)
     - Scheduled scraping configuration
     - `frequency`: daily/weekly/monthly
     - `active`: Enable/disable monitoring

#### **Services**

**`src/services/token-refresh.service.ts`** (324 lines)
- **Purpose**: Automatic TCAD API token refresh
- **Why Needed**: TCAD tokens expire after ~5 minutes
- **Strategy**:
  1. Launch headless Chromium browser
  2. Navigate to TCAD property search
  3. Perform test search to trigger API call
  4. Intercept network request and capture Authorization header
  5. Update in-memory token cache
- **Scheduling Options**:
  - Cron-based: `startAutoRefresh("*/4 * * * *")`
  - Interval-based: `startAutoRefreshInterval(270000)` (4.5 minutes)
  - Adds ±30 second randomization to avoid detection
- **Health Monitoring**:
  - Tracks refresh count, failure count, failure rate
  - Exposes `/health/token` endpoint
  - Keeps existing token on refresh failure (graceful degradation)

#### **Frontend/UI**
This is primarily a backend service, but includes:
- Bull Board dashboard at `/admin/queues` for queue monitoring
- SPA routing via `app.routes.ts` for potential frontend integration
- CORS configuration for frontend at `http://localhost:5173`

#### **Testing**

**Test File Structure**:
- `src/__tests__/integration.test.ts`: API endpoint tests
- `src/__tests__/security.test.ts`: XSS, SQL injection, CSRF tests
- `src/middleware/__tests__/`: Middleware unit tests
- `src/routes/__tests__/`: Route handler tests
- `src/lib/__tests__/`: Service layer tests

**Test Configuration**: Jest with `ts-jest` transformer
- Config file: `jest.config.js`
- Scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`

#### **Documentation**

**README Files**:
- `/server/README.md`: Main documentation (288 lines)
  - Setup instructions
  - Database operations
  - Queue management
  - Troubleshooting guide
  - Architecture diagram
  - Search term strategy (weighted random)
  - Known limitations

- `/server/QUICK-START.md`: Fast setup guide
- `/server/ENQUEUE_SCRIPTS_README.md`: Batch script documentation

**Additional Documentation** (in `/docs`):
- `ARCHITECTURE_SUMMARY.md`: System design overview
- `CURRENT-STATE.md`: Project status tracking
- `INTEGRATION-SUMMARY.md`: API integration guide
- `TESTING.md`: Testing strategy
- `TCAD_API_TOKEN_SETUP.md`: Token configuration guide
- `TOKEN_AUTO_REFRESH.md`: Auto-refresh implementation details

#### **DevOps**

**`Dockerfile`** (35 lines)
- **Base Image**: `node:18-alpine3.19` (minimal footprint)
- **Key Dependencies**:
  - Chromium browser for Playwright
  - OpenSSL for Prisma
  - Font libraries (NSS, FreeType, HarfBuzz)
- **Build Process**:
  1. Install system dependencies
  2. Copy package files and run `npm ci`
  3. Copy application code
  4. Generate Prisma client
  5. Run with `tsx src/index.ts` (development mode)
- **Note**: Uses `tsx` instead of compiled code for faster iteration

**`ecosystem.config.js`** (PM2 configuration)
- Process management for production deployment
- Supports clustering, auto-restart, log rotation

**CI/CD**: No automated CI/CD detected (manual deployment)

---

## 4. API Endpoints Analysis

### Scraping Endpoints

#### `POST /api/properties/scrape`
- **Purpose**: Queue a new scraping job
- **Request Body**:
  ```json
  {
    "searchTerm": "string",
    "userId": "string (optional)",
    "scheduled": "boolean (optional)"
  }
  ```
- **Validation**: Zod schema `scrapeRequestSchema`
- **Response**:
  ```json
  {
    "jobId": "string",
    "status": "queued",
    "searchTerm": "string"
  }
  ```
- **Rate Limit**: 5 requests/minute
- **Authentication**: Optional (optionalAuth middleware)

#### `GET /api/properties/jobs/:jobId`
- **Purpose**: Get scrape job status
- **Response**:
  ```json
  {
    "id": "string",
    "status": "pending|processing|completed|failed",
    "progress": "number (0-100)",
    "resultCount": "number",
    "error": "string|null",
    "startedAt": "ISO8601",
    "completedAt": "ISO8601|null"
  }
  ```

#### `GET /api/properties/history`
- **Purpose**: Get scrape job history with pagination
- **Query Parameters**: `page`, `limit`, `status`
- **Response**: Paginated list of scrape jobs

### Property Query Endpoints

#### `GET /api/properties`
- **Purpose**: Query properties from database
- **Query Parameters**:
  - `city`: Filter by city
  - `propType`: Filter by property type
  - `minValue`, `maxValue`: Appraised value range
  - `searchTerm`: Search term filter
  - `page`, `limit`: Pagination
- **Response**: Paginated property list with metadata

#### `POST /api/properties/search`
- **Purpose**: Natural language search powered by Claude AI
- **Request Body**:
  ```json
  {
    "query": "string (e.g., 'Find properties in Austin over $1M')"
  }
  ```
- **Process**:
  1. Sends query to Claude Haiku
  2. Claude converts to SQL query
  3. Executes query against database
  4. Returns results with explanation
- **Response**:
  ```json
  {
    "results": "Property[]",
    "explanation": "string",
    "sqlQuery": "string"
  }
  ```

#### `GET /api/properties/search/test`
- **Purpose**: Test Claude API connection
- **Response**: Connection status and API availability

### Statistics & Analytics Endpoints

#### `GET /api/properties/stats`
- **Purpose**: Aggregate statistics
- **Response**:
  ```json
  {
    "totalProperties": "number",
    "totalJobs": "number",
    "successRate": "number",
    "cityCounts": "object",
    "typeCounts": "object",
    "avgAppraisedValue": "number"
  }
  ```

### Monitoring Endpoints

#### `POST /api/properties/monitor`
- **Purpose**: Add search term to monitoring schedule
- **Request Body**:
  ```json
  {
    "searchTerm": "string",
    "frequency": "daily|weekly|monthly"
  }
  ```

#### `GET /api/properties/monitor`
- **Purpose**: Get all monitored searches
- **Response**: List of active monitored search configurations

### Health Check Endpoints

#### `GET /health`
- **Purpose**: Basic health check
- **Response**:
  ```json
  {
    "status": "healthy",
    "timestamp": "ISO8601",
    "uptime": "number",
    "environment": "string"
  }
  ```

#### `GET /health/queue`
- **Purpose**: Queue system health
- **Response**: Queue counts (waiting, active, completed, failed)

#### `GET /health/token`
- **Purpose**: Token refresh service health
- **Response**: Token status, refresh count, failure rate

### Authentication & Authorization

**Authentication Patterns**:
1. **API Key Authentication**: `X-API-Key` header
2. **JWT Authentication**: `Authorization: Bearer <token>` header
3. **Optional Authentication**: Allows both authenticated and guest access

**Authorization Strategy**:
- Most endpoints use `optionalAuth` (no auth required in development)
- Production deployment should enforce API key or JWT
- Configurable via `AUTH_SKIP_IN_DEVELOPMENT` env var

### Request/Response Formats
- **Content-Type**: `application/json`
- **Error Format**:
  ```json
  {
    "error": "string",
    "message": "string (development only)",
    "stack": "string (development only)"
  }
  ```

### API Versioning
**Current State**: No versioning (implied v1)
**Future**: Could implement `/api/v1/`, `/api/v2/` pattern

---

## 5. Architecture Deep Dive

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           TCAD Scraper System                        │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────────────────────────────┐
│   Frontend   │────────▶│         Express API Server           │
│  (Optional)  │  HTTP   │  - Routes & Controllers              │
│              │  CORS   │  - Authentication & Validation       │
└──────────────┘         │  - Rate Limiting                     │
                          │  - Health Checks                     │
                          └──────────┬───────────────────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
                ▼                    ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │  Queue System   │  │  Claude AI      │  │  Database       │
    │  (BullMQ/Redis) │  │  Service        │  │  (PostgreSQL)   │
    │                 │  │                 │  │                 │
    │  - Job Queue    │  │  - NL Search    │  │  - Properties   │
    │  - Workers      │  │  - SQL Gen      │  │  - Scrape Jobs  │
    │  - Dashboard    │  │                 │  │  - Monitoring   │
    └────────┬────────┘  └─────────────────┘  └─────────────────┘
             │
             ▼
    ┌─────────────────┐
    │  Scraper Worker │
    │  (Playwright)   │
    │                 │
    │  - Browser      │◀─────┐
    │  - Token Mgmt   │      │ Refresh
    │  - API Calls    │      │ Service
    └────────┬────────┘      │
             │               │
             ▼               │
    ┌─────────────────┐     │
    │  TCAD Website   │     │
    │  API Backend    │     │
    │                 │     │
    │  - Auth Token   │─────┘
    │  - Property API │
    └─────────────────┘
```

### Data Flow & Request Lifecycle

#### **Scraping Request Flow**

1. **API Request** → `POST /api/properties/scrape`
   - Express receives HTTP request
   - Rate limiter checks (5 req/min)
   - Optional authentication
   - Validation middleware (Zod schema)

2. **Job Queuing** → `propertyController.scrapeProperties()`
   - Creates BullMQ job with search term
   - Returns job ID to client
   - Client can poll `/jobs/:jobId` for status

3. **Job Processing** → `scraperQueue.process()`
   - Worker picks up job from Redis queue
   - Creates `ScrapeJob` record in PostgreSQL
   - Updates progress: 10% (initializing)

4. **Browser Automation** → `TCADScraper.initialize()`
   - Launches Chromium browser (headless)
   - Sets random user agent and viewport
   - Configures proxy if enabled

5. **Token Acquisition** → Priority order:
   - **Option A**: Get token from `tokenRefreshService` (cached)
   - **Option B**: Use `TCAD_API_KEY` from environment
   - **Option C**: Capture token from browser (fallback)

6. **Data Extraction** → `scrapePropertiesViaAPI()`
   - Injects JavaScript function into page context
   - Makes direct POST request to TCAD API
   - Fetches paginated results (adaptive page size: 1000 → 500 → 100 → 50)
   - Handles truncation errors by reducing page size
   - Updates progress: 30% (scraping)

7. **Data Persistence** → Bulk upsert to PostgreSQL
   - Transforms API response to `PropertyData` format
   - Upserts each property (update if exists, insert if new)
   - Updates progress: 70% (saving)

8. **Job Completion** → Update database
   - Sets `ScrapeJob.status` to `completed` or `failed`
   - Records `resultCount` and `completedAt`
   - Updates progress: 100%
   - Client receives final status

9. **Cleanup** → Browser resource cleanup
   - Closes browser context
   - Releases memory

#### **Natural Language Search Flow**

1. **User Query** → `POST /api/properties/search`
   - Example: "Find properties in Austin over $1M"

2. **AI Processing** → `claudeService.generateSQL()`
   - Sends query to Claude Haiku model
   - Claude analyzes database schema
   - Generates SQL query with explanation

3. **Query Execution** → Prisma executes SQL
   - Validates generated SQL for safety
   - Executes against PostgreSQL
   - Returns results with metadata

4. **Response** → Formatted results
   - Property list
   - AI-generated explanation
   - SQL query (for debugging)

### Component Relationships

#### **Queue System Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                      BullMQ Queue System                     │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Producer   │────────▶│  Redis Queue │────────▶│   Worker 1   │
│ (Controller) │   Add   │              │  Fetch  │  (Scraper)   │
└──────────────┘   Job   │  - Waiting   │   Job   └──────────────┘
                          │  - Active    │               │
┌──────────────┐         │  - Complete  │         ┌──────┴───────┐
│  Dashboard   │◀────────│  - Failed    │         │   Worker 2   │
│ (Bull Board) │  Monitor│              │◀────────│  (Scraper)   │
└──────────────┘         └──────────────┘ Update  └──────────────┘
                                                    Status/Progress
```

**Queue Configuration**:
- **Concurrency**: 2 workers (configurable)
- **Retry Strategy**: 3 attempts with exponential backoff (2s, 4s, 8s)
- **Job Lifecycle**:
  - `waiting` → `active` → `completed` ✓
  - `waiting` → `active` → `failed` → `waiting` (retry) → ...
- **Cleanup**: Jobs removed after 24 hours (100 completed, 50 failed retained)

#### **Token Management Flow**

```
┌─────────────────────────────────────────────────────────────┐
│              Token Refresh Service (Auto-Refresh)            │
└─────────────────────────────────────────────────────────────┘

Every 4.5 minutes (±30s randomization):
   │
   ▼
┌──────────────────┐
│ Launch Browser   │
│ (Chromium)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Navigate to TCAD │
│ Property Search  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐       ┌────────────────────┐
│ Perform Test     │──────▶│ Intercept Request  │
│ Search ("test")  │       │ Capture Auth Token │
└──────────────────┘       └─────────┬──────────┘
                                     │
                                     ▼
                           ┌────────────────────┐
                           │ Update In-Memory   │
                           │ Token Cache        │
                           └─────────┬──────────┘
                                     │
                                     ▼
                           ┌────────────────────┐
                           │ Used by Scrapers   │
                           │ for API Calls      │
                           └────────────────────┘
```

**Token Refresh Benefits**:
- **No manual token management**: Fully automated
- **Always fresh**: Refreshes before 5-minute expiration
- **Graceful degradation**: Keeps old token on failure
- **Fast scraping**: API calls use cached token (no browser overhead)

### Key Design Patterns

#### 1. **Factory Pattern**
- `TCADScraper` class creates browser instances
- Configuration-based instantiation

#### 2. **Singleton Pattern**
- `tokenRefreshService`: Single instance shared across workers
- `prisma`: Database client singleton
- `scraperInstance`: Reusable scraper instance

#### 3. **Observer Pattern**
- Queue event listeners (`completed`, `failed`, `stalled`)
- Browser request/response interception

#### 4. **Strategy Pattern**
- Multiple scraping strategies (API vs. DOM)
- Configurable proxy strategies (Bright Data vs. generic)

#### 5. **Repository Pattern**
- Prisma ORM abstracts database operations
- Controllers → Services → Repositories

#### 6. **Middleware Chain Pattern**
- Express middleware pipeline
- Composable request/response processing

#### 7. **Command Pattern**
- Job queue encapsulates scraping commands
- Deferred execution with retry logic

### Dependencies Between Modules

```
src/index.ts
├── src/config/index.ts (configuration)
├── src/routes/property.routes.ts
│   ├── src/controllers/property.controller.ts
│   │   ├── src/queues/scraper.queue.ts
│   │   │   └── src/lib/tcad-scraper.ts
│   │   │       └── src/services/token-refresh.service.ts
│   │   ├── src/lib/claude.service.ts
│   │   └── src/lib/prisma.ts
│   └── src/middleware/validation.middleware.ts
├── src/middleware/auth.ts
├── src/middleware/xcontroller.middleware.ts
└── src/services/token-refresh.service.ts
```

**Dependency Injection**: Minimal (mostly manual imports)
**Circular Dependencies**: None detected (good architecture)

---

## 6. Environment & Setup Analysis

### Required Environment Variables

#### **Critical (Must Set)**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/tcad_scraper
```

#### **Recommended for Production**
```bash
# Authentication
JWT_SECRET=<strong-random-secret>
API_KEY=<api-key-for-access>

# AI Integration
ANTHROPIC_API_KEY=<claude-api-key>

# TCAD API Token (optional but highly recommended)
TCAD_API_KEY=<captured-token>
TCAD_AUTO_REFRESH_TOKEN=true
TCAD_TOKEN_REFRESH_INTERVAL=270000  # 4.5 minutes
```

#### **Infrastructure**
```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<optional>

# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
```

#### **Optional Enhancements**
```bash
# Proxy for IP Rotation
BRIGHT_DATA_ENABLED=true
BRIGHT_DATA_API_TOKEN=<token>

# Monitoring
SENTRY_ENABLED=true
SENTRY_DSN=<sentry-dsn>

# Doppler Secrets Management
DOPPLER_PROJECT=tcad-scraper
DOPPLER_CONFIG=prod
```

### Installation Process

**Prerequisites**:
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker (for infrastructure)

**Step-by-Step Setup**:

```bash
# 1. Clone repository and install dependencies
cd server
npm install

# 2. Install Playwright browsers
npx playwright install chromium
npx playwright install-deps chromium

# 3. Start infrastructure (Docker)
cd ..
docker-compose up -d

# 4. Initialize database
cd server
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" \
  npx prisma db push

# 5. Configure secrets (Doppler recommended)
doppler login
doppler setup  # Select project and config

# 6. Start development server
npm run dev

# 7. Start production server
npm run build
npm start

# 8. Monitor with PM2 (production)
pm2 start ecosystem.config.js
pm2 logs
```

### Development Workflow

**Local Development**:
```bash
# Terminal 1: Infrastructure
docker-compose up

# Terminal 2: API Server
npm run dev  # Auto-reload with tsx watch

# Terminal 3: Queue Dashboard
open http://localhost:3001/admin/queues

# Terminal 4: Database Studio
npm run prisma:studio
```

**Testing Workflow**:
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Security tests only
npm run test:security

# Coverage report
npm run test:coverage
```

**Database Workflow**:
```bash
# Generate Prisma client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# View data
npm run prisma:studio

# Direct SQL queries
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT COUNT(*) FROM properties;"
```

### Production Deployment Strategy

#### **Option 1: Docker Deployment**
```bash
# Build image
docker build -t tcad-scraper:latest .

# Run container
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_HOST="redis" \
  --name tcad-scraper \
  tcad-scraper:latest
```

#### **Option 2: PM2 Deployment**
```bash
# Build TypeScript
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Scale workers
pm2 scale tcad-scraper 4

# Monitor
pm2 monit

# Logs
pm2 logs tcad-scraper --lines 100
```

#### **Option 3: Kubernetes Deployment**
*No K8s manifests detected, but could be implemented*

**Deployment Checklist**:
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set strong `JWT_SECRET`
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up monitoring (Sentry)
- [ ] Enable `TCAD_AUTO_REFRESH_TOKEN`
- [ ] Configure Doppler for secrets
- [ ] Set up database backups
- [ ] Configure log rotation

---

## 7. Technology Stack Breakdown

### Runtime Environment
- **Node.js 18+** (LTS)
- **TypeScript 5.3.3** with strict mode
- **tsx 4.7.0** for development (faster than `ts-node`)

### Web Framework
- **Express.js 4.18.2**
  - Mature, battle-tested HTTP server
  - Rich middleware ecosystem
  - 50K+ GitHub stars

### Database Technologies
- **PostgreSQL 15+**
  - ACID compliance
  - JSON support for flexible schema
  - Full-text search capabilities
  - Excellent performance for 400K+ records

- **Prisma ORM 5.8.0**
  - Type-safe database queries
  - Automatic migrations
  - Schema introspection
  - Built-in connection pooling

### Job Queue & Caching
- **Bull 4.12.0** (BullMQ)
  - Redis-backed job queue
  - Priority queues
  - Delayed jobs
  - Job retry with exponential backoff
  - Job progress tracking

- **Redis 7+**
  - In-memory data store
  - Pub/sub capabilities
  - Atomic operations
  - Persistence options (AOF/RDB)

### Web Scraping Stack
- **Playwright 1.56.1**
  - Cross-browser automation (Chromium, Firefox, WebKit)
  - Network interception
  - Screenshot/PDF generation
  - Mobile emulation
  - Geolocation spoofing

- **Chromium** (latest)
  - Headless browser
  - DevTools Protocol access
  - JavaScript execution in page context

### AI Integration
- **Anthropic Claude API** (SDK 0.68.0)
  - Natural language to SQL conversion
  - Model: Claude 3 Haiku (fast, cost-effective)
  - Streaming responses supported
  - 200K token context window

### Security & Authentication
- **Helmet 7.1.0**: HTTP security headers
  - CSP, HSTS, X-Frame-Options
  - XSS protection
  - Content type sniffing prevention

- **CORS 2.8.5**: Cross-origin resource sharing
  - Configurable allowed origins
  - Credentials support

- **jsonwebtoken 9.0.2**: JWT authentication
  - HS256/RS256 signing
  - Expiration handling

- **express-rate-limit 7.1.5**: DDoS protection
  - IP-based rate limiting
  - Configurable windows and limits

### Logging & Monitoring
- **Winston 3.11.0**: Structured logging
  - Multiple transports (console, file, HTTP)
  - Log levels (error, warn, info, debug)
  - JSON formatting

- **Pino 10.1.0**: High-performance logging
  - 30% faster than Winston
  - Low overhead
  - Child loggers

### Build Tools & Bundlers
- **TypeScript Compiler**: `tsc` with source maps
- **tsx**: TypeScript execution without compilation
- **No bundler**: Direct Node.js execution (CommonJS)

### Testing Frameworks
- **Jest 29.7.0**: Test runner
  - Snapshot testing
  - Code coverage
  - Parallel test execution

- **ts-jest 29.1.2**: TypeScript transformer for Jest

- **Supertest 6.3.4**: HTTP assertions
  - Request/response testing
  - Chai-like assertions

### Process Management
- **PM2** (via ecosystem.config.js)
  - Process clustering
  - Auto-restart on crash
  - Log rotation
  - CPU/memory monitoring

### Development Tools
- **ESLint 8.56.0**: Linting
  - TypeScript plugin
  - Consistent code style

- **Nodemon 3.0.2**: Auto-reload (alternative to tsx watch)

- **Doppler CLI**: Secrets management
  - Environment variable injection
  - Team secret sharing
  - Audit logging

### Container Technologies
- **Docker**: Containerization
  - Alpine Linux base image (minimal)
  - Multi-stage builds possible

- **Docker Compose**: Local development
  - PostgreSQL container
  - Redis container
  - Network isolation

### Optional Integrations
- **Bright Data Proxy**: Residential IP rotation
- **Sentry**: Error tracking and performance monitoring
- **Prometheus**: Metrics export (via `bullmq-exporter`)

---

## 8. Visual Architecture Diagram

### System-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        TCAD Property Scraper System                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                            EXTERNAL SYSTEMS
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐ │
│  │  TCAD Website    │      │  Anthropic API   │      │  Bright Data     │ │
│  │  (Target)        │      │  (Claude AI)     │      │  (Proxy)         │ │
│  │                  │      │                  │      │                  │ │
│  │  - Property API  │      │  - NL → SQL      │      │  - IP Rotation   │ │
│  │  - Auth Tokens   │      │  - Haiku Model   │      │  - Residential   │ │
│  └────────┬─────────┘      └────────┬─────────┘      └────────┬─────────┘ │
│           │                         │                         │           │
└───────────┼─────────────────────────┼─────────────────────────┼───────────┘
            │                         │                         │
            │ HTTPS                   │ HTTPS                   │ HTTPS
            │                         │                         │
┌───────────┼─────────────────────────┼─────────────────────────┼───────────┐
│           │                         │                         │           │
│           ▼                         ▼                         ▼           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    Express.js API Server (Port 3001)                │  │
│  │                                                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                     Middleware Pipeline                      │  │  │
│  │  │  1. Nonce Generation (CSP)                                   │  │  │
│  │  │  2. Helmet (Security Headers)                                │  │  │
│  │  │  3. CORS (Cross-Origin)                                      │  │  │
│  │  │  4. Body Parser (JSON)                                       │  │  │
│  │  │  5. Rate Limiter (API: 100/15min, Scraper: 5/min)           │  │  │
│  │  │  6. Optional Auth (JWT/API Key)                              │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                       API Routes                             │  │  │
│  │  │                                                              │  │  │
│  │  │  /health                    → Health check                   │  │  │
│  │  │  /health/queue              → Queue status                   │  │  │
│  │  │  /health/token              → Token refresh status           │  │  │
│  │  │  /admin/queues              → Bull Board (UI)                │  │  │
│  │  │  /api/properties            → Property CRUD                  │  │  │
│  │  │  /api/properties/scrape     → Trigger scrape job             │  │  │
│  │  │  /api/properties/search     → AI-powered search              │  │  │
│  │  │  /api/properties/stats      → Statistics                     │  │  │
│  │  │  /api/properties/monitor    → Scheduled monitoring           │  │  │
│  │  └──────────────────┬──────────────────────────────────────────┘  │  │
│  └─────────────────────┼──────────────────────────────────────────────┘  │
│                        │                                                  │
│         APPLICATION LAYER                                                 │
└────────────────────────┼──────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌───────────────┐  ┌──────────────┐  ┌──────────────┐
│   Property    │  │    Claude    │  │   Scraper    │
│  Controller   │  │   Service    │  │    Queue     │
│               │  │              │  │   Manager    │
│ - scrape()    │  │ - genSQL()   │  │              │
│ - get()       │  │ - execute()  │  │ - add()      │
│ - search()    │  │              │  │ - process()  │
│ - stats()     │  │              │  │ - monitor()  │
└───────┬───────┘  └──────┬───────┘  └──────┬───────┘
        │                 │                 │
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           DATA & QUEUE LAYER                              │
│                                                                           │
│  ┌───────────────────────┐          ┌──────────────────────────────────┐ │
│  │   PostgreSQL 15+      │          │      Redis 7+ (Queue)            │ │
│  │                       │          │                                  │ │
│  │  ┌─────────────────┐ │          │  ┌────────────────────────────┐ │ │
│  │  │  Properties     │ │          │  │  scraper-queue:waiting     │ │ │
│  │  │  17,352 records │ │          │  │  scraper-queue:active      │ │ │
│  │  │                 │ │          │  │  scraper-queue:completed   │ │ │
│  │  │  - propertyId   │ │          │  │  scraper-queue:failed      │ │ │
│  │  │  - name         │ │          │  └────────────────────────────┘ │ │
│  │  │  - propType     │ │          │                                  │ │
│  │  │  - city         │ │          │  Concurrency: 2 workers          │ │
│  │  │  - address      │ │          │  Retry: 3 attempts               │ │
│  │  │  - values       │ │          │  Backoff: Exponential            │ │
│  │  └─────────────────┘ │          └──────────────────────────────────┘ │
│  │                       │                        │                       │
│  │  ┌─────────────────┐ │                        │                       │
│  │  │  ScrapeJobs     │ │                        │                       │
│  │  │  13,380 records │ │                        │                       │
│  │  │                 │ │                        │                       │
│  │  │  - searchTerm   │ │                        │                       │
│  │  │  - status       │ │                        │                       │
│  │  │  - resultCount  │ │                        │                       │
│  │  │  - error        │ │                        │                       │
│  │  └─────────────────┘ │                        │                       │
│  └───────────────────────┘                        │                       │
└───────────────────────────────────────────────────┼───────────────────────┘
                                                    │
                                                    │ Job Picked Up
                                                    │
                                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          WORKER PROCESSES (x2)                            │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      Scraper Worker Loop                            │ │
│  │                                                                     │ │
│  │  1. Get Job from Queue          ┌──────────────────────────────┐  │ │
│  │  2. Create ScrapeJob record ───▶│  PostgreSQL (status update)  │  │ │
│  │  3. Initialize Browser          └──────────────────────────────┘  │ │
│  │  4. Get/Refresh Token           ┌──────────────────────────────┐  │ │
│  │                            ────▶│  Token Refresh Service       │  │ │
│  │  5. Call TCAD API               └──────────────────────────────┘  │ │
│  │  6. Parse Results                                                 │ │
│  │  7. Bulk Upsert to DB           ┌──────────────────────────────┐  │ │
│  │                            ────▶│  PostgreSQL (properties)     │  │ │
│  │  8. Update Job Status           └──────────────────────────────┘  │ │
│  │  9. Cleanup Browser                                               │ │
│  │                                                                     │ │
│  │  ┌───────────────────────────────────────────────────────────┐   │ │
│  │  │              Playwright Browser Instance                  │   │ │
│  │  │                                                            │   │ │
│  │  │  ┌────────────────────────────────────────────────────┐  │   │ │
│  │  │  │  Chromium (Headless)                               │  │   │ │
│  │  │  │                                                     │  │   │ │
│  │  │  │  - Network Interception                            │  │   │ │
│  │  │  │  - JavaScript Injection                            │  │   │ │
│  │  │  │  - API Call from Browser Context                   │  │   │ │
│  │  │  │  - Token Capture                                   │  │   │ │
│  │  │  │                                                     │  │   │ │
│  │  │  │  Injected Function: window.__tcad_search()         │  │   │ │
│  │  │  │    - Fetches API directly                          │  │   │ │
│  │  │  │    - Handles pagination (1000/500/100/50)          │  │   │ │
│  │  │  │    - Returns JSON to Playwright                    │  │   │ │
│  │  │  └────────────────────────────────────────────────────┘  │   │ │
│  │  └───────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                      BACKGROUND SERVICES                                  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │              Token Refresh Service (Auto-Refresh)                   │ │
│  │                                                                     │ │
│  │  Schedule: Every 4.5 minutes (±30s randomization)                  │ │
│  │                                                                     │ │
│  │  1. Launch headless browser                                        │ │
│  │  2. Navigate to TCAD property search                               │ │
│  │  3. Perform test search ("test")                                   │ │
│  │  4. Intercept network request → Capture Authorization header       │ │
│  │  5. Update in-memory token cache                                   │ │
│  │  6. Close browser context                                          │ │
│  │                                                                     │ │
│  │  Stats: refreshCount, failureCount, lastRefreshTime                │ │
│  │  Health: /health/token endpoint                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │              Scrape Scheduler (Cron Jobs)                           │ │
│  │                                                                     │ │
│  │  - Reads MonitoredSearch table                                     │ │
│  │  - Queues jobs for active monitored searches                       │ │
│  │  - Frequency: daily/weekly/monthly                                 │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                         MONITORING & OBSERVABILITY                        │
│                                                                           │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │   Bull Board Dashboard   │  │    Winston/Pino Logs                │   │
│  │   /admin/queues          │  │                                     │   │
│  │                          │  │  - logs/error.log                   │   │
│  │  - Queue metrics         │  │  - logs/combined.log                │   │
│  │  - Job details           │  │  - Console (pretty print)           │   │
│  │  - Manual retry          │  │                                     │   │
│  └─────────────────────────┘  └─────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │   Prisma Studio          │  │    Health Check Endpoints           │   │
│  │   localhost:5555         │  │                                     │   │
│  │                          │  │  GET /health                        │   │
│  │  - Browse database       │  │  GET /health/queue                  │   │
│  │  - Edit records          │  │  GET /health/token                  │   │
│  │  - Visual queries        │  │                                     │   │
│  └─────────────────────────┘  └─────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

### File Structure Hierarchy

```
tcad-scraper/server/
│
├── src/                                    # TypeScript source code
│   ├── index.ts                            # ⭐ Express server entry point
│   │   ├── → config/index.ts
│   │   ├── → routes/property.routes.ts
│   │   ├── → routes/app.routes.ts
│   │   ├── → queues/scraper.queue.ts
│   │   ├── → services/token-refresh.service.ts
│   │   └── → middleware/*
│   │
│   ├── config/
│   │   └── index.ts                        # ⭐ Centralized configuration
│   │       └── 70+ environment variables
│   │
│   ├── controllers/
│   │   └── property.controller.ts          # API business logic
│   │       ├── scrapeProperties()
│   │       ├── getProperties()
│   │       ├── naturalLanguageSearch()
│   │       └── getStats()
│   │
│   ├── lib/
│   │   ├── tcad-scraper.ts                 # ⭐ Core scraping engine (1342 lines)
│   │   │   ├── class TCADScraper
│   │   │   ├── scrapePropertiesViaAPI()    # Direct API method
│   │   │   ├── initialize()                # Browser setup
│   │   │   └── cleanup()                   # Resource cleanup
│   │   ├── claude.service.ts               # AI integration
│   │   ├── prisma.ts                       # Database client
│   │   └── logger.ts                       # Winston logger
│   │
│   ├── middleware/
│   │   ├── auth.ts                         # JWT + API key auth
│   │   ├── xcontroller.middleware.ts       # CSP + security
│   │   ├── validation.middleware.ts        # Zod schema validation
│   │   └── error.middleware.ts             # Error handling
│   │
│   ├── queues/
│   │   └── scraper.queue.ts                # ⭐ BullMQ job processing
│   │       ├── Queue creation
│   │       ├── Worker process (concurrency: 2)
│   │       ├── Job lifecycle management
│   │       └── Event listeners
│   │
│   ├── routes/
│   │   ├── property.routes.ts              # API endpoint definitions
│   │   └── app.routes.ts                   # SPA routes
│   │
│   ├── services/
│   │   └── token-refresh.service.ts        # ⭐ Auto token refresh
│   │       ├── class TCADTokenRefreshService
│   │       ├── refreshToken()
│   │       ├── startAutoRefresh()
│   │       └── getHealth()
│   │
│   ├── scripts/                            # Executable scripts
│   │   ├── enqueue-*.ts                    # Batch job scripts (10)
│   │   ├── test-*.ts                       # Testing scripts (8)
│   │   └── continuous-batch-scraper.ts     # 24/7 scraper
│   │
│   ├── schedulers/
│   │   └── scrape-scheduler.ts             # Cron job manager
│   │
│   ├── types/
│   │   ├── property.types.ts               # Zod schemas + interfaces
│   │   └── index.ts                        # Type exports
│   │
│   ├── utils/
│   │   └── deduplication.ts                # Dedup helpers
│   │
│   └── __tests__/                          # Test files
│       ├── integration.test.ts
│       └── security.test.ts
│
├── prisma/
│   ├── schema.prisma                       # ⭐ Database schema
│   │   ├── model Property
│   │   ├── model ScrapeJob
│   │   └── model MonitoredSearch
│   └── migrations/                         # Migration history
│
├── dist/                                   # Compiled JavaScript output
│   └── [mirrors src/ structure]
│
├── data/                                   # Analytics data
│   ├── search-term-map.json
│   └── high-performing-terms.json
│
├── logs/                                   # Application logs
│   ├── error.log
│   └── combined.log
│
├── Configuration Files
│   ├── package.json                        # Dependencies + scripts
│   ├── tsconfig.json                       # TypeScript config
│   ├── Dockerfile                          # Container build
│   ├── ecosystem.config.js                 # PM2 config
│   ├── .env.example                        # Env var template
│   └── .env                                # Local environment (gitignored)
│
└── Documentation
    ├── README.md                           # Main documentation (288 lines)
    ├── QUICK-START.md                      # Fast setup guide
    └── ENQUEUE_SCRIPTS_README.md           # Batch script docs
```

---

## 9. Key Insights & Recommendations

### Code Quality Assessment

#### **Strengths** ✅

1. **Excellent Architecture**
   - Clean separation of concerns (routes → controllers → services → models)
   - No circular dependencies
   - Centralized configuration module (single source of truth)
   - Reusable service singletons

2. **Robust Error Handling**
   - Try-catch blocks throughout
   - Graceful degradation (e.g., token refresh failures)
   - Detailed error logging with Winston/Pino
   - Database transaction rollback on failures

3. **Type Safety**
   - Full TypeScript coverage
   - Strict mode enabled (`noImplicitAny`, `strictNullChecks`)
   - Zod schemas for runtime validation
   - Prisma for type-safe database queries

4. **Production-Ready Features**
   - Health check endpoints
   - Graceful shutdown handlers (SIGTERM/SIGINT)
   - Database connection pooling
   - Job retry with exponential backoff
   - Rate limiting
   - Security headers (Helmet, CSP)

5. **Comprehensive Documentation**
   - Detailed README with troubleshooting
   - Inline code comments
   - API endpoint documentation
   - Database schema comments

6. **Innovative Scraping Strategy**
   - Direct API calls (bypasses 20-result limit)
   - Automatic token refresh (brilliant!)
   - Adaptive page size handling for truncation
   - Human behavior simulation

#### **Areas for Improvement** 🔧

1. **Testing Coverage**
   - **Current**: Limited test files detected
   - **Recommendation**: Aim for 80%+ coverage
   - **Action Items**:
     - Unit tests for all controllers
     - Integration tests for scraper queue flow
     - E2E tests for API endpoints
     - Mock external dependencies (Playwright, Claude API)
   - **Tools**: Jest coverage reports, Codecov integration

2. **Error Monitoring**
   - **Current**: Winston logging to files
   - **Recommendation**: Implement distributed error tracking
   - **Action Items**:
     - Enable Sentry (already configured but disabled)
     - Add custom error tags and context
     - Set up Slack/email alerts for critical errors
     - Implement error rate thresholds

3. **API Documentation**
   - **Current**: Inline comments and README
   - **Recommendation**: Generate interactive API docs
   - **Action Items**:
     - Add Swagger/OpenAPI spec
     - Use `tsoa` or `swagger-jsdoc`
     - Generate Postman collection
     - Host docs at `/api-docs`

4. **Database Optimization**
   - **Current**: Indexes on common fields
   - **Potential Issues**:
     - Bulk upserts may be slow at scale (400K+ properties)
     - No database query optimization monitoring
   - **Recommendations**:
     - Implement batch upsert in chunks (e.g., 1000 at a time)
     - Add database query logging with slow query detection
     - Consider read replicas for analytics queries
     - Implement database connection pooling tuning
     - Add database backup strategy

5. **Security Hardening**
   - **Current**: Good (Helmet, CORS, rate limiting, JWT)
   - **Additional Measures**:
     - Implement API request signing (HMAC)
     - Add IP whitelisting for admin endpoints
     - Rotate JWT secrets periodically
     - Implement CSP violation reporting
     - Add input sanitization for SQL injection (Prisma helps, but validate further)
     - Enable HTTPS enforcement in production

6. **Configuration Management**
   - **Current**: Doppler integration (excellent)
   - **Recommendation**: Environment-specific configs
   - **Action Items**:
     - Separate dev/staging/prod configs
     - Validate all required env vars at startup (partially done)
     - Document all environment variables with examples
     - Add `.env.template` with descriptions

7. **Codebase Organization**
   - **Current**: Some clutter in root directory
   - **Recommendations**:
     - Move analysis scripts to `/scripts/analysis/`
     - Move one-off enqueue scripts to `/scripts/one-off/`
     - Archive fallback browser search code
     - Move diagnostics to `/scripts/diagnostics/`
     - Clean up root directory (40+ files)

8. **Performance Optimization**
   - **Current**: 2 concurrent workers (configurable)
   - **Potential Improvements**:
     - Implement worker scaling based on queue depth
     - Add Redis caching for frequently accessed properties
     - Optimize Prisma queries (use `select` for specific fields)
     - Implement pagination on `/api/properties` endpoint
     - Add database query result caching
     - Consider bulk insert instead of individual upserts

9. **Observability**
   - **Current**: Winston logs + Bull Dashboard
   - **Recommendations**:
     - Add Prometheus metrics export
     - Implement request tracing (OpenTelemetry)
     - Add performance monitoring (APM)
     - Dashboard for scraping statistics (Grafana)
     - Alert on job failure rate > 10%

10. **CI/CD Pipeline**
    - **Current**: None detected
    - **Recommendation**: Automate testing and deployment
    - **Action Items**:
      - GitHub Actions for CI (lint, test, build)
      - Automated Docker image builds
      - Deployment to staging/production environments
      - Database migration automation
      - Rollback strategy

### Security Considerations

#### **Current Security Measures** 🔒
- ✅ Helmet security headers (CSP, XSS protection)
- ✅ CORS with configurable allowed origins
- ✅ JWT authentication with expiration
- ✅ API key authentication
- ✅ Rate limiting (API + scraper)
- ✅ Input validation with Zod schemas
- ✅ Prisma ORM (parameterized queries, SQL injection protection)
- ✅ Environment variable secrets (Doppler)

#### **Additional Security Recommendations** 🛡️

1. **Authentication & Authorization**
   - Implement role-based access control (RBAC)
   - Add refresh token rotation
   - Implement account lockout after failed attempts
   - Add two-factor authentication (2FA) for admin routes
   - Implement session management

2. **Data Protection**
   - Encrypt sensitive data at rest (property owner names?)
   - Implement field-level encryption for PII
   - Add data anonymization for analytics
   - Implement GDPR compliance (right to deletion)
   - Add audit logging for data access

3. **Network Security**
   - Enforce HTTPS in production (nginx reverse proxy)
   - Implement certificate pinning
   - Add firewall rules (only expose necessary ports)
   - VPC isolation for database
   - Private network for Redis

4. **Dependency Security**
   - Automated dependency scanning (`npm audit`)
   - Dependabot alerts
   - Regular security updates
   - Pin exact versions (no `^` or `~`)
   - License compliance checking

5. **Secrets Management**
   - Never commit secrets to git (currently good)
   - Rotate secrets regularly (TCAD token, JWT secret)
   - Use separate secrets per environment
   - Implement secret expiration
   - Audit secret access

6. **Input Validation**
   - Validate all user inputs (partially done with Zod)
   - Sanitize inputs to prevent XSS
   - Limit request body size
   - Implement CSRF protection for state-changing operations
   - Validate file uploads (if implemented)

7. **Logging & Monitoring**
   - Never log sensitive data (tokens, passwords)
   - Implement security event logging
   - Alert on suspicious patterns
   - Log authentication failures
   - Implement log integrity verification

### Performance Optimization Opportunities

1. **Database Query Optimization**
   - **Current**: Individual upserts for each property
   - **Improvement**: Batch insert in chunks of 1000
   - **Expected Gain**: 10-50x faster inserts
   - **Implementation**:
     ```typescript
     // Instead of:
     await Promise.all(properties.map(p => prisma.property.upsert(...)))

     // Use:
     await prisma.property.createMany({
       data: properties,
       skipDuplicates: true,
     })
     ```

2. **Redis Caching Layer**
   - **Opportunity**: Cache frequently accessed properties
   - **Strategy**: Cache-aside pattern
   - **TTL**: 5 minutes
   - **Expected Gain**: 90%+ reduction in database queries
   - **Implementation**:
     ```typescript
     const cacheKey = `property:${propertyId}`;
     const cached = await redis.get(cacheKey);
     if (cached) return JSON.parse(cached);

     const property = await prisma.property.findUnique({ where: { propertyId } });
     await redis.setex(cacheKey, 300, JSON.stringify(property));
     return property;
     ```

3. **Worker Scaling**
   - **Current**: Fixed 2 workers
   - **Improvement**: Dynamic scaling based on queue depth
   - **Logic**:
     - Queue > 100 jobs → Scale to 4 workers
     - Queue > 500 jobs → Scale to 8 workers
     - Queue < 50 jobs → Scale down to 2 workers
   - **Implementation**: PM2 cluster mode or Kubernetes HPA

4. **Connection Pooling**
   - **Current**: Prisma default pooling
   - **Improvement**: Tune pool size based on workload
   - **Recommendation**:
     ```javascript
     // prisma/schema.prisma
     datasource db {
       provider = "postgresql"
       url      = env("DATABASE_URL")
       connection_limit = 20
       pool_timeout = 10
     }
     ```

5. **API Response Pagination**
   - **Current**: Returns all matching properties
   - **Issue**: Large result sets (1000+ properties) slow down API
   - **Improvement**: Implement cursor-based pagination
   - **Expected Gain**: 10x faster response times

6. **Browser Reuse**
   - **Current**: Browser initialized per job
   - **Improvement**: Reuse browser across jobs
   - **Caution**: May introduce state issues, need careful context management
   - **Expected Gain**: 2-3x faster scraping (no browser startup overhead)

### Maintainability Suggestions

1. **Code Documentation**
   - Add JSDoc comments to all public methods
   - Document complex algorithms (especially in scraper)
   - Add inline comments for non-obvious logic
   - Create architecture decision records (ADRs)

2. **Code Organization**
   - Move business logic from controllers to services
   - Extract magic numbers to constants
   - Create utility functions for repeated logic
   - Use dependency injection for better testability

3. **Linting & Formatting**
   - **Current**: ESLint configured
   - **Additions**:
     - Prettier for consistent formatting
     - Pre-commit hooks (Husky + lint-staged)
     - Enforce commit message format (conventional commits)

4. **Version Control**
   - Tag releases (semantic versioning)
   - Maintain CHANGELOG.md
   - Use feature branches
   - Require code reviews for production

5. **Monitoring & Alerting**
   - Set up alerts for:
     - Job failure rate > 10%
     - Queue depth > 1000
     - Database connection errors
     - Token refresh failures
     - API error rate > 5%

6. **Refactoring Opportunities**
   - Extract `scrapePropertiesViaAPI()` logic into smaller functions
   - Separate token management into dedicated service (already done)
   - Create a `PropertyService` layer
   - Extract validation logic into separate validators

### Migration Path for Improvements

**Phase 1: Quick Wins (1-2 weeks)**
1. Enable Sentry error tracking
2. Add Swagger/OpenAPI docs
3. Implement batch upsert optimization
4. Add pre-commit hooks (Husky)
5. Clean up root directory

**Phase 2: Testing & Quality (2-3 weeks)**
1. Achieve 80% test coverage
2. Set up CI/CD pipeline
3. Implement automated security scanning
4. Add integration tests for queue flow

**Phase 3: Performance (2-4 weeks)**
1. Implement Redis caching
2. Optimize database queries
3. Add API pagination
4. Implement worker auto-scaling

**Phase 4: Observability (1-2 weeks)**
1. Add Prometheus metrics
2. Set up Grafana dashboards
3. Implement distributed tracing
4. Configure alerting rules

**Phase 5: Security Hardening (2-3 weeks)**
1. Implement RBAC
2. Add refresh token rotation
3. Enable HTTPS enforcement
4. Audit logging implementation

---

## 10. Summary

### Project Highlights

This is a **production-ready, enterprise-grade web scraping system** that demonstrates:

1. **Innovative Problem Solving**: Direct API calls bypass UI limitations (20 → 1000+ results)
2. **Robust Architecture**: Queue-based processing with automatic retries and graceful degradation
3. **Automation Excellence**: Auto-refreshing tokens eliminate manual maintenance
4. **AI Integration**: Claude-powered natural language search provides intuitive query interface
5. **Scalability**: Job queue system can handle thousands of concurrent scraping jobs
6. **Maintainability**: Centralized configuration, comprehensive documentation, type safety

### Technical Achievement

**Current State**:
- 17,352 properties scraped (4.3% of target 400K)
- 13,380 scrape jobs processed
- 98.1% success rate
- Running 24/7 with optimized search term generation

**System Capabilities**:
- Can scrape 1000+ properties per API call (vs. 20 via UI)
- Processes 2-4 concurrent jobs
- Auto-refreshes API tokens every 4.5 minutes
- Supports natural language queries via Claude AI
- Provides real-time job progress tracking
- Maintains comprehensive scraping history

### Recommended Next Steps

**Immediate (This Week)**:
1. Enable Sentry for error tracking
2. Implement batch upsert optimization
3. Add API documentation (Swagger)

**Short-term (This Month)**:
1. Achieve 80% test coverage
2. Set up CI/CD pipeline
3. Implement Redis caching
4. Add monitoring dashboards

**Long-term (This Quarter)**:
1. Scale to 400K properties
2. Implement advanced analytics
3. Add scheduled monitoring features
4. Open-source or commercialize

This codebase represents a **professional-grade solution** to a complex web scraping challenge. The architecture is sound, the code is maintainable, and the system is production-ready. With the recommended improvements, it could easily scale to millions of properties and serve as a foundation for a commercial product.

---

**Analysis Generated**: 2025-11-06
**Total Lines Analyzed**: ~15,000+ lines of TypeScript
**Files Analyzed**: 119 files
**Directories Analyzed**: 26 directories
**Documentation Quality**: ⭐⭐⭐⭐⭐ (Excellent)
**Code Quality**: ⭐⭐⭐⭐☆ (Very Good)
**Architecture**: ⭐⭐⭐⭐⭐ (Excellent)
**Production Readiness**: ⭐⭐⭐⭐☆ (Very Good)
