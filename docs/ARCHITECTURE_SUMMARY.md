# TCAD Scraper - Quick Architecture Summary

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     TCAD SCRAPER SYSTEM                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                       │
├──────────────────────────────────────────────────────────────────────────┤
│  React Frontend (Port 5173)  │  Browser                                  │
│  ├── PropertySearch.tsx       │  └─ Axios API Client                     │
│  ├── ScrapeManager.tsx        │                                          │
│  ├── PropertyTable.tsx        │  Authentication:                         │
│  ├── Filters.tsx              │  • JWT Bearer Token                      │
│  ├── Charts.tsx               │  • API Key (X-API-Key header)            │
│  └── Analytics.tsx            │  • Optional in development               │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                              HTTP/HTTPS
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY LAYER                                  │
├──────────────────────────────────────────────────────────────────────────┤
│  Express Server (Port 3001)                                              │
│                                                                           │
│  Middleware Stack:                                                       │
│  ├─ CSP Nonce Generation                                                │
│  ├─ Helmet Security Headers                                             │
│  ├─ CORS (whitelist: localhost, alephatx.info)                          │
│  ├─ Body Parsing (JSON + URL-encoded)                                   │
│  ├─ API Rate Limiting (100 req/15min)                                   │
│  ├─ Scraper Rate Limiting (5 req/1min)                                  │
│  └─ Optional JWT/API Key Auth                                           │
│                                                                           │
│  Routes:                                                                 │
│  ├─ POST   /api/properties/scrape         → Trigger job                 │
│  ├─ GET    /api/properties                → Query with filters          │
│  ├─ POST   /api/properties/search         → Claude NL search            │
│  ├─ GET    /api/properties/stats          → Analytics                   │
│  ├─ GET    /api/properties/jobs/:jobId    → Job status                  │
│  ├─ GET    /admin/queues                  → Bull Dashboard              │
│  ├─ GET    /health                        → Server health               │
│  ├─ GET    /health/queue                  → Queue health                │
│  └─ GET    /                              → React SPA                    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                 ┌──────────────────┼──────────────────┬───────────────┐
                 │                  │                  │               │
                 ▼                  ▼                  ▼               ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │  PostgreSQL  │  │    Redis     │  │  Playwright  │  │  Claude API  │
         │  Database    │  │    Queue     │  │  Scraper     │  │  (Anthropic) │
         │  Port 5432   │  │  Port 6379   │  │              │  │              │
         └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                 │                  │
                 │         ┌────────┴─────────┐
                 │         │                  │
         ┌───────┴──┐  ┌────────┐      ┌──────────┐
         │ Properties│  │Scrape  │      │ Monitored│
         │ Table     │  │Jobs    │      │ Searches │
         │           │  │        │      │          │
         │ ~400k     │  │History │      │          │
         │ records   │  │of jobs │      │          │
         └───────────┘  └────────┘      └──────────┘
```

## Data Flow

### 1. User Initiates Scrape
```
User Input (Search Term)
        │
        ▼
POST /api/properties/scrape
        │
        ▼
Rate Limit Check (5 per min)
        │
        ▼
Create BullMQ Job
        │
        ▼
Return jobId (202 Accepted)
        │
        ▼
Frontend polls: GET /api/properties/jobs/{jobId}
```

### 2. Job Processing (Queue Worker)
```
BullMQ dequeues job
        │
        ▼
TCADScraper.initialize()
        │
        ├─ Launch Playwright browser
        └─ (10% progress)
        │
        ▼
TCADScraper.scrapePropertiesViaAPI()
        │
        ├─ Get auth token (from env or browser)
        ├─ Call TCAD API endpoint
        ├─ Handle pagination (up to 1000 results)
        └─ (30% progress)
        │
        ▼
Prisma.upsert() - Save properties (dedup by propertyId)
        │
        ├─ Update database (70% progress)
        ├─ Log scrape job metadata
        └─ (100% progress)
        │
        ▼
Return results { count, properties, duration }
```

### 3. Frontend Property Query
```
User searches: "properties in Austin worth over 500k"
        │
        ▼
POST /api/properties/search
        │
        ▼
Claude AI parses NL query
        │
        ▼
Generate Prisma where clause & orderBy
        │
        ▼
Query database
        │
        ▼
Return { data, pagination, explanation }
```

## Core Components Breakdown

### Backend Services

#### 1. TCADScraper Service (`/server/src/lib/tcad-scraper.ts`)
- **Primary Method**: Direct API calls to TCAD backend
  - Endpoint: `https://prod-container.trueprodigyapi.com/public/property/searchfulltext`
  - Up to 1000 results per search
  - Token-based auth (Bearer)
  
- **Fallback Method**: Browser automation
  - Navigate to `https://travis.prodigycad.com/property-search`
  - DOM parsing (limited to ~20 results)
  
- **Features**:
  - Anti-detection (random user agents, viewports, delays)
  - Proxy support (Bright Data + generic)
  - Automatic retry with exponential backoff
  - Progress tracking (10% → 30% → 70% → 100%)

#### 2. Queue System (`/server/src/queues/scraper.queue.ts`)
- **Engine**: BullMQ (Redis-backed)
- **Concurrency**: 2 parallel jobs
- **Retries**: 3 attempts with exponential backoff
- **Job Lifecycle**: waiting → active → completed/failed
- **Cleanup**: Keep 100 completed, 50 failed jobs

#### 3. Database Layer (`Prisma ORM`)
- **Tables**:
  - `Property` - ~400k records (indexed by propertyId, city, type, value)
  - `ScrapeJob` - Job execution history
  - `MonitoredSearch` - Terms to periodically re-scrape
  
- **Access Patterns**:
  - Write: `prisma` client
  - Read: `prismaReadOnly` (separate pool)
  - Connection pooling: 10 connections

#### 4. Claude Service (`/server/src/lib/claude.service.ts`)
- **Purpose**: Natural language query parsing
- **Input**: "find commercial properties over 1 million"
- **Output**: { whereClause, orderBy, explanation }
- **Model**: claude-3-haiku (cost-optimized)

#### 5. Scheduled Jobs (`/server/src/schedulers/scrape-scheduler.ts`)
- **Daily** (2 AM): Run "daily" monitored searches
- **Weekly** (3 AM Sunday): Run "weekly" monitored searches
- **Monthly** (4 AM 1st): Run "monthly" monitored searches
- **Hourly**: Clean up old queue jobs

### Configuration System

Centralized configuration at `/server/src/config/index.ts`:
- Environment-based (development, production, test)
- 12 major sections (server, database, redis, queue, rate limit, cors, security, scraper, claude, logging, frontend, monitoring)
- Environment variable parsing with type-safe defaults
- Feature flags for analytics, monitoring, search

## Security Architecture

```
Request Flow → Security Enforcement
        │
        ├─ CSP Nonce (Random per request)
        ├─ Helmet Headers
        ├─ CORS Whitelist
        ├─ Rate Limiting
        ├─ Input Validation (Zod)
        ├─ Optional JWT/API Key Auth
        └─ SQL Injection Prevention (Prisma)

Response Flow → Additional Security
        ├─ CSP Headers
        ├─ Secure HTML (for SPA)
        ├─ No sensitive data in logs
        ├─ Connection timeout enforcement
        └─ Graceful error handling
```

## Performance Characteristics

| Operation | Method | Speed |
|-----------|--------|-------|
| Scrape 1000 properties | API method | ~5-10 sec |
| Scrape 20 properties | Browser method | ~15-30 sec |
| Query 100 properties | Database | <100 ms |
| Process job queue | Concurrent, 2 at a time | Configurable |
| Claude NL parsing | API call | ~1-2 sec |
| Health check | In-memory | <1 ms |

## Deployment Architecture

### Development
```
Docker Compose:
├─ Redis (bullmq-redis:6379)
└─ BullMQ Metrics Exporter (:4000)

Local Services:
├─ PostgreSQL (localhost:5432)
├─ Express Server (localhost:5050)
└─ React Dev Server (localhost:5173)
```

### Production
```
Environment-Based:
├─ Database URL (remote PostgreSQL)
├─ Redis URL (hosted or local)
├─ Doppler Secrets Integration
└─ Systemd Process Management

Endpoints:
├─ API: https://alephatx.info/api/*
├─ Web: https://alephatx.info/*
└─ Queue: https://alephatx.info/admin/queues
```

## File Location Reference

| Component | Location |
|-----------|----------|
| Main Server | `/server/src/index.ts` |
| Scraper Class | `/server/src/lib/tcad-scraper.ts` |
| Queue Config | `/server/src/queues/scraper.queue.ts` |
| Database Schema | `/server/prisma/schema.prisma` |
| Central Config | `/server/src/config/index.ts` |
| API Routes | `/server/src/routes/property.routes.ts` |
| Controllers | `/server/src/controllers/property.controller.ts` |
| Claude Service | `/server/src/lib/claude.service.ts` |
| Schedulers | `/server/src/schedulers/scrape-scheduler.ts` |
| React App | `/src/App.tsx` |
| API Client | `/src/services/api.service.ts` |
| Components | `/src/components/*.tsx` |

## Environment Variable Categories

| Category | Key Variables |
|----------|---------------|
| Database | DATABASE_URL, DATABASE_READ_ONLY_URL |
| Redis | REDIS_HOST, REDIS_PORT, REDIS_PASSWORD |
| Server | PORT, NODE_ENV, HOST |
| Scraper | SCRAPER_HEADLESS, TCAD_API_KEY, SCRAPER_TIMEOUT |
| Claude | ANTHROPIC_API_KEY, CLAUDE_MODEL |
| Security | JWT_SECRET, API_KEY, CORS_ALLOWED_ORIGINS |
| Queue | QUEUE_CONCURRENCY, QUEUE_JOB_ATTEMPTS |
| Rate Limit | API_RATE_LIMIT_MAX, SCRAPER_RATE_LIMIT_MAX |
| Logging | LOG_LEVEL, LOG_FILES_ENABLED |
| Frontend | FRONTEND_URL, VITE_API_URL |

## API Rate Limiting

```
┌─────────────────────────────────────────────┐
│         RATE LIMITING CONFIGURATION          │
├─────────────────────────────────────────────┤
│ API Endpoints:                              │
│   • Window: 15 minutes                      │
│   • Max: 100 requests                       │
│   • Status Code: 429 (Too Many Requests)    │
│                                             │
│ Scraper Endpoints (/api/properties/scrape): │
│   • Window: 1 minute                        │
│   • Max: 5 requests                         │
│   • Adds job delay: 5 seconds               │
│   • Cache cleanup: 1 minute                 │
└─────────────────────────────────────────────┘
```

## Monitoring & Observability

```
Health Endpoints:
  GET /health        → { status, uptime, environment }
  GET /health/queue  → { queue: { waiting, active, completed, failed } }

Logging:
  Winston Logger
  ├─ Console (configurable)
  ├─ File: logs/error.log
  └─ File: logs/combined.log

Metrics:
  BullMQ Dashboard: /admin/queues
  Prometheus: /metrics (optional)

Queue Monitoring:
  Real-time job status
  Success/failure rates
  Job duration tracking
```

## Key Technologies Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 19.2 |
| | Vite | 7.1 |
| | TypeScript | 5.3+ |
| **Backend** | Node.js | 18+ |
| | Express | 4.18 |
| | Playwright | 1.56 |
| | Prisma ORM | 5.8 |
| **Queue** | BullMQ | 5.62 |
| | Redis | 7 |
| **Database** | PostgreSQL | 15+ |
| **AI** | Anthropic Claude | 3-haiku |
| **Auth** | JWT | jsonwebtoken 9.0 |
| **Validation** | Zod | 3.22 |
| **Logging** | Winston | 3.11 |
| **Security** | Helmet | 7.1 |

## Development Workflow

```
1. Clone & Setup
   npm install
   cd server && npm install
   cp .env.example .env
   cd server && npx prisma migrate dev

2. Development
   Terminal 1: cd server && npm run dev     (Express + hot reload)
   Terminal 2: npm run dev                  (Vite frontend)
   Terminal 3: docker-compose up           (Redis + metrics)
   Browser:   http://localhost:5173

3. Database Work
   npm run prisma:studio                    (Visual DB browser)
   npm run prisma:migrate                   (Create migrations)

4. Testing
   npm run test                             (Jest)
   npm run test:watch                       (Watch mode)
   npm run test:coverage                    (Coverage report)

5. Production Build
   npm run build                            (Frontend + Backend)
   NODE_ENV=production npm start            (Start server)
```

---

**Last Updated:** November 5, 2025
**Version:** 1.0.0
**Status:** Production-Ready

