# TCAD Scraper - Comprehensive Codebase Overview

## 1. PROJECT STRUCTURE

### Root Directory Organization
```
tcad-scraper/
├── server/                    # Express API backend (Node.js/TypeScript)
├── src/                       # React frontend (Vite + React)
├── docs/                      # Documentation files
├── public/                    # Static assets
├── .github/                   # GitHub workflows (CI/CD)
├── node_modules/              # Root dependencies
├── package.json               # Root npm configuration
├── docker-compose.yml         # Docker services orchestration
├── vite.config.ts             # Vite build configuration
└── tsconfig.json              # TypeScript root configuration
```

### Server Structure
```
server/
├── src/
│   ├── index.ts               # Main Express server entry point
│   ├── config/
│   │   └── index.ts           # Centralized configuration (350+ lines)
│   ├── lib/
│   │   ├── tcad-scraper.ts    # Core Playwright scraper with dual methods
│   │   ├── claude.service.ts  # Claude AI integration for natural language search
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── logger.ts          # Winston logger setup
│   ├── routes/
│   │   ├── property.routes.ts # API endpoints for properties
│   │   └── app.routes.ts      # Frontend app serving with security
│   ├── controllers/
│   │   └── property.controller.ts  # Business logic for property operations
│   ├── middleware/
│   │   ├── auth.ts            # JWT and API key authentication
│   │   ├── error.middleware.ts # Error handling and async wrappers
│   │   ├── validation.middleware.ts # Zod schema validation
│   │   └── xcontroller.middleware.ts # CSP nonce and security headers
│   ├── queues/
│   │   └── scraper.queue.ts   # BullMQ job queue configuration
│   ├── schedulers/
│   │   └── scrape-scheduler.ts # Cron job scheduling
│   ├── types/
│   │   ├── index.ts           # Core type definitions
│   │   └── property.types.ts  # Property-specific types and Zod schemas
│   ├── utils/                 # Utility functions
│   ├── scripts/               # Standalone scripts and tools
│   └── __tests__/             # Test files
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   └── migrations/            # Database migrations
├── dist/                      # Compiled JavaScript output
├── package.json               # Server dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                  # Server-specific documentation
```

### Frontend Structure
```
src/
├── components/
│   ├── PropertySearch.tsx      # Main search interface component
│   ├── ScrapeManager.tsx       # Job management and history
│   ├── PropertyTable.tsx       # Data display table
│   ├── Filters.tsx             # Filter UI controls
│   ├── Charts.tsx              # Analytics charts
│   └── Analytics.tsx           # Analytics dashboard
├── services/
│   └── api.service.ts          # API client with axios
├── lib/
│   ├── xcontroller.client.ts   # Client-side security utilities
│   └── __tests__/              # Client-side tests
├── types/
│   └── index.ts                # Frontend TypeScript types
├── App.tsx                     # Root React component
├── main.tsx                    # React app entry point
├── App.css                     # Global styles
└── vite-env.d.ts               # Vite environment types
```

---

## 2. KEY ENTRY POINTS

### Backend Entry Point
**File:** `/server/src/index.ts`

**Responsibilities:**
- Initialize Express application with middleware stack
- Configure security (Helmet, CORS, rate limiting)
- Set up BullMQ dashboard
- Register API and frontend routes
- Initialize scheduled jobs
- Handle graceful shutdown

**Key Features:**
- Health check endpoints (`/health`, `/health/queue`)
- Two-layer middleware: security first, then routing
- Bull Dashboard at `/admin/queues` for queue monitoring
- Structured logging with Winston

### Frontend Entry Point
**File:** `/src/main.tsx`

**Responsibilities:**
- React app initialization
- Root component rendering
- Vite module configuration

### Server Scripts (in `/server/src/scripts/`)
- `batch-scrape.ts` - Manual batch scraping with search term generation
- `continuous-batch-scraper.ts` - Production 24/7 scraper with intelligent term generation
- `worker.ts` - Dedicated worker for processing jobs
- Various diagnostic scripts for API testing and troubleshooting

---

## 3. API ROUTES AND ENDPOINTS

### Property Routes (`/api/properties/*`)

#### Scraping Endpoints
- **POST** `/api/properties/scrape` - Trigger a new scrape job
  - Payload: `{ searchTerm: string, userId?: string }`
  - Response: `{ jobId: string, message: string }`
  - Rate limited: max 5 requests per 1 minute

- **GET** `/api/properties/jobs/:jobId` - Get job status
  - Response: Job status with progress, result count, error details

- **GET** `/api/properties/history` - Get scrape job history
  - Query params: `limit` (1-100, default 20), `offset` (default 0)
  - Response: Paginated job list with metadata

#### Property Query Endpoints
- **GET** `/api/properties` - Get properties with filters
  - Query params: `searchTerm`, `city`, `propType`, `minValue`, `maxValue`, `limit`, `offset`
  - Response: Paginated property list

- **POST** `/api/properties/search` - Natural language search powered by Claude
  - Payload: `{ query: string, limit?: number, offset?: number }`
  - Response: Filtered properties with explanation of applied filters

- **GET** `/api/properties/search/test` - Test Claude API connection

#### Statistics & Analytics
- **GET** `/api/properties/stats` - Get aggregate statistics
  - Response: Total properties, jobs, city distribution, property types

#### Monitoring
- **POST** `/api/properties/monitor` - Add search term to monitoring list
  - Payload: `{ searchTerm: string, frequency: 'hourly'|'daily'|'weekly' }`

- **GET** `/api/properties/monitor` - Get all active monitored searches

### App Routes (`/`)
- **GET** `/` - Serve React SPA with secure HTML
- **GET** `/health` - Health check endpoint

### Admin Routes
- **GET** `/admin/queues` - BullMQ Bull Dashboard (configurable, default enabled)

---

## 4. CORE SCRAPING FUNCTIONALITY

### Main Scraper Class: `TCADScraper`
**File:** `/server/src/lib/tcad-scraper.ts`

#### Capabilities
1. **API-Based Scraping** (Recommended - Primary Method)
   - Direct HTTP calls to TCAD backend API
   - Endpoint: `https://prod-container.trueprodigyapi.com/public/property/searchfulltext`
   - Fetches up to 1000 results per API call
   - Handles pagination automatically
   - Multiple page size attempts: 1000 → 500 → 100 → 50
   - Token-based authentication (Bearer token)
   - Captures auth token from browser or uses pre-fetched `TCAD_API_KEY`

2. **Browser-Based Scraping** (Fallback Method)
   - Launches headless Playwright browser
   - Navigates to `https://travis.prodigycad.com/property-search`
   - Interacts with search form
   - Parses AG Grid DOM for results
   - Limited to ~20 results per search

#### Key Features
- **Anti-detection measures:**
  - Randomized user agents
  - Randomized viewports (4K, 1440p, 1080p)
  - Human-like delays between actions (100-500ms configurable)
  - Timezone set to America/Chicago
  - Disabled Blink automation detection

- **Proxy Support:**
  - Bright Data proxy integration (via `BRIGHT_DATA_ENABLED`)
  - Generic proxy support (via `SCRAPER_PROXY_ENABLED`)
  - Proxy fallback if primary method fails

- **Error Handling:**
  - Automatic retry with exponential backoff
  - Multiple attempts with different page sizes
  - Graceful fallback from API to browser method

- **Configuration:**
  - Headless mode (configurable)
  - Timeout settings (default 30 seconds)
  - Retry attempts (default 3)
  - Human delay randomization

#### Data Structure Returned
```typescript
interface PropertyData {
  propertyId: string;     // Unique property ID
  name: string;           // Owner name
  propType: string;       // Property type (Residential, Commercial, etc.)
  city: string | null;
  propertyAddress: string;
  assessedValue: number;  // Assessed value in dollars
  appraisedValue: number; // Appraised value in dollars
  geoId: string | null;   // Geographic ID
  description: string | null; // Legal description
}
```

---

## 5. JOB QUEUE SYSTEM

### BullMQ Queue Configuration
**File:** `/server/src/queues/scraper.queue.ts`

#### Architecture
- **Queue Name:** `scraper-queue`
- **Job Name:** `scrape-properties`
- **Concurrency:** 2 parallel jobs (configurable)
- **Backend:** Redis (localhost:6379)

#### Job Configuration
```typescript
{
  attempts: 3,           // Retry 3 times on failure
  backoff: {
    type: 'exponential',
    delay: 2000          // Start with 2 second delay
  },
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 50       // Keep last 50 failed jobs
}
```

#### Job Lifecycle
1. Job added to queue (status: waiting)
2. BullMQ picks up job when worker available (status: active)
3. Scraper processes job:
   - 10% progress: Initialize browser
   - 30% progress: Scrape API/browser
   - 70% progress: Saving to database
   - 100% progress: Complete
4. Results stored in database
5. Job marked completed or failed

#### Job Data Structure
```typescript
interface ScrapeJobData {
  searchTerm: string;
  userId?: string;
  scheduled?: boolean; // true if from cron scheduler
}

interface ScrapeJobResult {
  count: number;
  properties: PropertyData[];
  searchTerm: string;
  duration: number;
}
```

---

## 6. DATABASE SCHEMA (Prisma ORM)

**File:** `/server/prisma/schema.prisma`

### Tables

#### Properties Table
```prisma
model Property {
  id              String   @id @default(uuid())
  propertyId      String   @unique              // Unique per property
  name            String                        // Owner name
  propType        String                        // Property type
  city            String?
  propertyAddress String
  assessedValue   Float?
  appraisedValue  Float
  geoId           String?
  description     String?  @db.Text
  searchTerm      String?                       // Term used to find it
  scrapedAt       DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([searchTerm, scrapedAt])
  @@index([propertyId])
  @@index([city])
  @@index([propType])
  @@index([appraisedValue])
}
```

**Key Optimization:** Unique constraint on `propertyId` allows upsert operations for deduplication

#### ScrapeJob Table
```prisma
model ScrapeJob {
  id          String    @id @default(uuid())
  searchTerm  String
  status      String    // pending, processing, completed, failed
  resultCount Int?
  error       String?   @db.Text
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  @@index([status, startedAt])
  @@index([searchTerm])
}
```

**Purpose:** Track all scraping job executions for analytics and monitoring

#### MonitoredSearch Table
```prisma
model MonitoredSearch {
  id         String   @id @default(uuid())
  searchTerm String   @unique
  active     Boolean  @default(true)
  frequency  String   @default("daily")  // daily, weekly, monthly
  lastRun    DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Purpose:** Store search terms to periodically re-scrape

### Database Access
- **Write Operations:** Via `prisma` client (standard)
- **Read Operations:** Via `prismaReadOnly` client (separate connection pool)
- **Connection Pooling:** Configurable pool size (default 10)

---

## 7. CONFIGURATION SYSTEM

**File:** `/server/src/config/index.ts`

### Configuration Sections

#### Environment Configuration
```typescript
env: {
  nodeEnv: 'development' | 'production' | 'test'
  isDevelopment: boolean
  isProduction: boolean
  isTest: boolean
}
```

#### Server Configuration
```typescript
server: {
  port: 3001          // Server port
  host: '0.0.0.0'     // Listen on all interfaces
  logLevel: 'info'
  gracefulShutdownTimeout: 10000  // ms
}
```

#### Database Configuration
```typescript
database: {
  url: 'postgresql://user:pass@host:5432/tcad_scraper'
  readOnlyUrl?: string
  connectionTimeout: 10000
  poolSize: 10
}
```

#### Redis Configuration
```typescript
redis: {
  host: 'localhost'
  port: 6379
  password?: string
  db: 0
  connectionTimeout: 10000
}
```

#### Queue Configuration
```typescript
queue: {
  name: 'scraper-queue'
  jobName: 'scrape-properties'
  concurrency: 2
  defaultJobOptions: {
    attempts: 3
    backoffDelay: 2000
    removeOnComplete: 100
    removeOnFail: 50
  }
  cleanupInterval: 3600000  // 1 hour
  cleanupGracePeriod: 86400000  // 24 hours
  dashboard: {
    basePath: '/admin/queues'
    enabled: true
  }
}
```

#### Rate Limiting
```typescript
rateLimit: {
  api: {
    windowMs: 900000    // 15 minutes
    max: 100            // 100 requests per window
    message: string
  }
  scraper: {
    windowMs: 60000     // 1 minute
    max: 5              // 5 requests per minute
    message: string
    jobDelay: 5000
    cacheCleanupInterval: 60000
  }
}
```

#### CORS Configuration
```typescript
cors: {
  allowedOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://alephatx.info',
    'https://www.alephatx.info'
  ]
  credentials: true
  allowNoOrigin: true  // For mobile apps, curl, etc.
}
```

#### Security Configuration
```typescript
security: {
  helmet: {
    crossOriginResourcePolicy: 'cross-origin'
    enableHsts: false
    enableCoop: false
    enableCsp: false
    enableOriginAgentCluster: false
  }
  csp: {
    enabled: true
    nonceLength: 16
    directives: { /* CSP rules */ }
  }
  hsts: {
    maxAge: 31536000
    includeSubDomains: true
  }
}
```

#### Scraper Configuration
```typescript
scraper: {
  headless: true
  timeout: 30000
  retryAttempts: 3
  retryDelay: 2000
  humanDelay: { min: 100, max: 500 }
  userAgents: [...]
  viewports: [
    { width: 3840, height: 2160 },
    { width: 2560, height: 1440 },
    { width: 1920, height: 1080 }
  ]
  proxy: {
    enabled: false
    server?: string
    username?: string
    password?: string
  }
  brightData: {
    enabled: false
    apiToken?: string
    proxyHost: 'brd.superproxy.io'
    proxyPort: 22225
  }
}
```

#### Claude AI Configuration
```typescript
claude: {
  apiKey: string
  model: 'claude-3-haiku-20240307'
  maxTokens: 1024
  timeout: 30000
}
```

#### Logging Configuration
```typescript
logging: {
  level: 'info'
  format: 'json'
  colorize: true
  files: {
    error: 'logs/error.log'
    combined: 'logs/combined.log'
    enabled: true
  }
  console: { enabled: true }
}
```

---

## 8. EXTERNAL INTEGRATIONS

### Anthropic Claude AI
**File:** `/server/src/lib/claude.service.ts`

**Purpose:** Natural language search query parsing

**Functionality:**
- Converts user natural language queries to Prisma query filters
- Generates `whereClause`, `orderBy`, and `explanation`
- Supports complex filters: city, property type, value ranges, address search

**Example Query Parsing:**
```
User: "properties in Austin worth over 500k"
→ whereClause: { city: "Austin", appraisedValue: { gte: 500000 } }
→ orderBy: { appraisedValue: "desc" }
→ explanation: "Searching for properties in Austin..."
```

### Doppler Secrets Management
- Optional integration for environment variable management
- Configured via `DOPPLER_PROJECT` and `DOPPLER_CONFIG`
- Used in npm scripts: `doppler run -- tsx ...`

### Playwright Browser Automation
- Latest version 1.56.1
- Headless Chromium browser
- Anti-detection features built-in

### Redis Queue Backend
- Version 7 Alpine image (Docker)
- Container name: `bullmq-redis`
- Port: 6379
- Data persistence: Volume mount
- Health checks every 10 seconds

### Prometheus Metrics Collection
- Optional metrics endpoint
- BullMQ custom exporter (custom build in `/bullmq-exporter`)
- Port 4000 (metrics), port 9090 (Prometheus)

---

## 9. ENVIRONMENT VARIABLES

**Example File:** `/.env.example` (203 lines)

### Critical Variables
```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/tcad_scraper
DATABASE_READ_ONLY_URL=postgresql://...

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3001
NODE_ENV=development

# Scraper
SCRAPER_HEADLESS=true
SCRAPER_TIMEOUT=30000
TCAD_API_KEY=<bearer-token>  # Pre-fetched auth token

# Claude AI
ANTHROPIC_API_KEY=<your-anthropic-key>
CLAUDE_MODEL=claude-3-haiku-20240307

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://alephatx.info

# Queue
QUEUE_CONCURRENCY=2
QUEUE_DASHBOARD_ENABLED=true
```

---

## 10. MIDDLEWARE STACK

### Applied in Order

1. **nonce-middleware** (CSP nonce generation)
2. **helmet** (Security headers)
3. **cors** (Cross-origin resource sharing)
4. **express.json** (Body parsing)
5. **express.urlencoded** (URL-encoded body parsing)
6. **rate-limit** (API-wide: 100 req/15min)
7. **rate-limit** (Scraper-specific: 5 req/1min)
8. **optionalAuth** (JWT/API key, optional)

### Custom Middleware

#### Error Handler (`error.middleware.ts`)
- `asyncHandler()` - Wraps async route handlers to catch errors
- `errorHandler()` - Global error handling
- `notFoundHandler()` - 404 responses

#### Authentication (`auth.ts`)
- `apiKeyAuth()` - Validates X-API-Key header
- `jwtAuth()` - Validates Bearer token
- `optionalAuth()` - Allows both auth'd and unauth'd access
- `generateToken()` - Create JWT tokens

#### Validation (`validation.middleware.ts`)
- `validateBody()` - Validate request body with Zod schema
- `validateQuery()` - Validate query parameters

#### Security (`xcontroller.middleware.ts`)
- `nonceMiddleware()` - Generate CSP nonce
- `cspMiddleware()` - Add CSP headers
- `generateSecureHtml()` - Secure HTML generation
- `getInitialAppData()` - Initial app data with nonce

---

## 11. SCHEDULED JOBS

**File:** `/server/src/schedulers/scrape-scheduler.ts`

### Cron Jobs (node-cron)

1. **Daily Scrape**
   - Time: 2:00 AM (America/Chicago timezone)
   - Runs: All active "daily" monitored searches

2. **Weekly Scrape**
   - Time: 3:00 AM Sunday
   - Runs: All active "weekly" monitored searches

3. **Monthly Scrape**
   - Time: 4:00 AM on 1st of month
   - Runs: All active "monthly" monitored searches

4. **Cleanup Job**
   - Time: Every hour at :00
   - Action: Remove old jobs from queue

**Features:**
- Random delay (0-60 seconds) per search to avoid overwhelming target
- Automatic job queuing via BullMQ
- Timezone-aware scheduling

---

## 12. KEY DEPENDENCIES

### Production Dependencies

**Backend (server/package.json):**
- `express@4.18.2` - REST API framework
- `@prisma/client@5.8.0` - ORM for database access
- `bullmq@5.62.0` - Job queue library
- `@bull-board/express@5.10.0` - Queue monitoring UI
- `playwright@1.56.1` - Browser automation
- `redis@4.6.0` - Redis client
- `winston@3.11.0` - Logging
- `zod@3.22.0` - Runtime type validation
- `cors@2.8.5` - CORS middleware
- `helmet@7.1.0` - Security headers
- `express-rate-limit@7.1.5` - Rate limiting
- `jsonwebtoken@9.0.2` - JWT authentication
- `node-cron@3.0.3` - Cron scheduling
- `axios@1.6.0` - HTTP client
- `@anthropic-ai/sdk@0.68.0` - Claude AI API
- `dotenv@16.3.1` - Environment variable loading

**Frontend (package.json):**
- `react@19.2.0` - UI framework
- `react-dom@19.2.0` - React DOM rendering
- `vite@7.1.11` - Build tool and dev server
- `puppeteer@24.27.0` - Browser automation (legacy)
- `cheerio@1.1.2` - HTML parsing
- `bullmq@5.62.0` - Queue access
- `ioredis@5.4.1` - Redis client

### Development Dependencies
- TypeScript 5.3+ for type safety
- Jest for testing
- ESLint for linting
- ts-jest for TypeScript test compilation

---

## 13. FRONTEND COMPONENTS

### Main Components

#### PropertySearch.tsx
- Root component for search interface
- Manages search form and results display
- Orchestrates other components

#### ScrapeManager.tsx
- Trigger new scrape jobs
- Monitor job progress
- View scrape history
- Manage monitored searches

#### PropertyTable.tsx
- Display scraped properties in table format
- Pagination support
- Sorting and filtering controls

#### Filters.tsx
- UI for advanced filtering
- City, property type, value range filters
- Dynamic filter generation

#### Charts.tsx
- Analytics visualizations
- Chart.js or similar charting library
- Property distribution charts

#### Analytics.tsx
- Dashboard with aggregate statistics
- Property count by city/type
- Job execution trends

### API Service Layer (`api.service.ts`)

**Exported Methods:**
```typescript
propertyAPI = {
  triggerScrape(searchTerm: string): Promise<ScrapeJobResponse>
  getJobStatus(jobId: string): Promise<JobStatus>
  pollJobStatus(jobId: string, onProgress: Function): Promise<JobStatus>
  getScrapeHistory(limit: number, offset: number): Promise<PaginatedResponse>
  getProperties(filters: PropertyFilters): Promise<PaginatedResponse>
  naturalLanguageSearch(query: string): Promise<PaginatedResponse>
  getStats(): Promise<StatsResponse>
  addMonitoredSearch(searchTerm: string, frequency: string): Promise<void>
  getMonitoredSearches(): Promise<MonitoredSearch[]>
}
```

**Features:**
- Axios interceptors for auth token handling
- Automatic rate limit error handling
- Error response extraction
- 30-second request timeout

---

## 14. TYPESCRIPT TYPES

### Core Type System

**Server Types** (`/server/src/types/index.ts`):
```typescript
interface ScraperConfig
interface PropertyData
interface ScrapeRequest
interface ScrapeResponse
interface JobStatus
interface ScrapeJobData
interface ScrapeJobResult
```

**Property-Specific Types** (`/server/src/types/property.types.ts`):
```typescript
// Zod Schemas
scrapeRequestSchema
propertyFilterSchema
naturalLanguageSearchSchema
historyQuerySchema
monitorRequestSchema

// Inferred Types
type ScrapeRequestBody
type PropertyFilters
type NaturalLanguageSearchBody
type HistoryQueryParams
type MonitorRequestBody

// Response Types
interface PaginationMeta
interface PaginatedResponse<T>
interface JobStatusResponse
interface StatsResponse
```

**Frontend Types** (`/src/types/index.ts`):
```typescript
interface Property
interface SearchFilters
interface APIResponse
interface AuthToken
```

---

## 15. TESTING & QUALITY ASSURANCE

### Test Files Located
- `/server/src/__tests__/` - Backend tests
- `/server/src/routes/__tests__/` - Route-specific tests
- `/server/src/middleware/__tests__/` - Middleware tests
- `/server/src/lib/__tests__/` - Library tests
- `/src/lib/__tests__/` - Frontend tests

### Testing Configuration
- Jest test runner (jest.config.js)
- Supertest for API testing
- ts-jest for TypeScript compilation

### Test Commands
```bash
npm run test                    # Run all tests
npm run test:watch            # Watch mode
npm run test:coverage         # Coverage report
npm run test:security         # Security-specific tests
```

---

## 16. BUILD & DEPLOYMENT

### Build Process

**Backend:**
```bash
npm run build  # Runs: tsc (TypeScript compilation to dist/)
```

**Frontend:**
```bash
npm run build  # Runs: tsc && vite build (builds to dist/)
```

### Development Servers

**Backend Development:**
```bash
npm run dev    # Runs: tsx watch src/index.ts (with hot reload)
```

**Frontend Development:**
```bash
npm run dev    # Runs: vite (dev server on port 5173)
```

### Docker Services (docker-compose.yml)

```yaml
redis:
  image: redis:7-alpine
  port: 6379
  volumes: redis-data

bullmq-metrics:
  build: ./bullmq-exporter
  port: 4000
  depends_on: redis
```

---

## 17. SECURITY CONSIDERATIONS

### Authentication
- Optional JWT tokens (Bearer token)
- Optional API key header (X-API-Key)
- Configurable auth skip in development mode

### Rate Limiting
- API endpoints: 100 requests per 15 minutes
- Scraper endpoints: 5 requests per 1 minute
- Rate limit information returned in headers

### CORS
- Whitelist of allowed origins
- Credentials support for authenticated requests
- Allows no-origin requests (mobile/CLI)

### Content Security Policy
- Nonce-based CSP for script execution
- Customizable directives per environment
- Default restrictive policy

### Input Validation
- Zod runtime schema validation
- Type-safe request bodies
- Bounds checking on numeric inputs

### Database Security
- Read-only connection pool option
- Connection timeout configuration
- SQL injection prevention via Prisma ORM

### Secrets Management
- Environment variable based
- Doppler integration for production
- Pre-configured secret fallbacks

---

## 18. MONITORING & OBSERVABILITY

### Health Checks
```
GET /health          - Server health
GET /health/queue    - Queue health with job counts
```

### Logging
- Winston structured logging (JSON or simple format)
- Configurable log levels (error, warn, info, debug)
- File output support
- Console output with optional colorization

### Metrics & Monitoring
- Prometheus metrics export
- BullMQ queue metrics via custom exporter
- Queue statistics dashboard at `/admin/queues`

### Performance Monitoring
- Job duration tracking
- Property count per scrape
- Error rate monitoring
- Queue depth monitoring

---

## 19. KNOWN LIMITATIONS & CONSIDERATIONS

### Scraper Limitations
- TCAD auth token requires periodic refresh (~5 minutes)
- API rate limiting on TCAD backend
- Browser-based fallback limited to ~20 results per search
- May require proxy for high-volume scraping

### Scalability
- Single Playwright instance per worker (resource intensive)
- BullMQ limited by Redis memory
- Database connection pooling limits concurrent queries
- Batch scraping depends on search term diversity

### API Limitations
- Natural language search requires Claude API access
- Search parsing depends on query clarity
- Property filtering limited to database schema fields

---

## 20. DOCUMENTATION FILES

**Location:** `/docs/`

Key documentation files:
- `CURRENT-STATE.md` - Project current status
- `README-HANDOFF.md` - Handoff documentation
- `INTEGRATION-SUMMARY.md` - Integration details
- `CLAUDE_SEARCH.md` - Claude AI search documentation
- `DATABASE.md` - Database schema details
- `TESTING.md` - Testing guide
- `XCONTROLLER-MIGRATION.md` - Security migration details
- `TASK-LOG.md` - Development task history
- `NEXT-STEPS.md` - Recommended next steps

---

## 21. QUICK START COMMANDS

### Installation
```bash
# Root installation
npm install

# Server installation
cd server && npm install

# Database setup
cd server && npx prisma migrate dev
```

### Development
```bash
# Terminal 1: Start server
cd server && npm run dev

# Terminal 2: Start frontend
npm run dev

# Terminal 3: Start Docker services
docker-compose up
```

### Production Scraping
```bash
# Start continuous batch scraper
cd server && npm run scrape:batch:comprehensive

# With Doppler secrets
cd server && doppler run -- npm run scrape:batch:comprehensive
```

### Database Operations
```bash
# Open Prisma Studio
cd server && npm run prisma:studio

# Run migrations
cd server && npm run prisma:migrate

# Generate Prisma client
cd server && npm run prisma:generate
```

---

## 22. ARCHITECTURE STRENGTHS

1. **Modular Design** - Clear separation of concerns
2. **Type Safety** - Full TypeScript with runtime validation via Zod
3. **Scalability** - Queue-based architecture for parallel processing
4. **Flexibility** - Dual scraping methods with automatic fallback
5. **Monitoring** - Built-in health checks and metrics
6. **Security** - Multiple auth methods, rate limiting, CSP, CORS
7. **Maintainability** - Centralized config, structured logging, comprehensive types
8. **Resilience** - Job retry logic, error handling, graceful shutdown
9. **AI Integration** - Natural language search via Claude
10. **Persistent State** - Database + Redis for reliable job tracking

---

**Document Generated:** November 5, 2025
**TCAD Scraper Version:** 1.0.0
**Technology Stack:** Node.js, Express, Playwright, Prisma, PostgreSQL, Redis, React, TypeScript

