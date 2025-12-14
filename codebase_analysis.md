# TCAD Scraper - Comprehensive Codebase Analysis

**Generated:** December 13, 2025
**Version:** 3.1
**Repository:** tcad-scraper

---

## 1. Project Overview

### Project Type
TCAD Scraper is a **production-grade full-stack web application** that combines:
- A **React SPA frontend** for property search and visualization
- An **Express REST API backend** for data access and job orchestration
- A **distributed scraping system** using BullMQ queues and Playwright
- A **PostgreSQL database** for persistent property data storage

### Purpose
Automated extraction and storage of property tax information from the Travis Central Appraisal District (TCAD) website (travis.prodigycad.com), with a target of 400,000+ property records.

### Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7.1, TypeScript, CSS Modules |
| **Backend** | Express 4.18, TypeScript, Prisma ORM |
| **Database** | PostgreSQL 15+ (via Tailscale VPN) |
| **Queue** | BullMQ 5.62, Redis 7 |
| **Scraping** | Playwright 1.41+, Cheerio |
| **AI Search** | Anthropic Claude API |
| **Monitoring** | Sentry, Prometheus, Bull Board |
| **Testing** | Vitest, Jest, Playwright Test |
| **Process Manager** | PM2 (production) |
| **Secrets** | Doppler |

### Architecture Pattern
**Layered Architecture with Message Queue**
- Controllers → Services → Repositories pattern
- Distributed job processing via BullMQ
- Dual scraping methods (API-first, browser fallback)

---

## 2. Detailed Directory Structure Analysis

```
tcad-scraper/
├── src/                          # React Frontend Application
│   ├── components/               # UI Components (features, layout, ui)
│   ├── hooks/                    # Custom React hooks (analytics)
│   ├── lib/                      # Frontend utilities (analytics, API)
│   ├── types/                    # TypeScript type definitions
│   └── services/                 # API service layer
│
├── server/                       # Express Backend Application
│   ├── src/
│   │   ├── index.ts              # Express server entry point
│   │   ├── controllers/          # Request handlers
│   │   ├── routes/               # API route definitions
│   │   ├── services/             # Business logic services
│   │   ├── queues/               # BullMQ queue configuration
│   │   ├── lib/                  # Core libraries (scraper, Claude, Prisma)
│   │   ├── middleware/           # Express middleware
│   │   ├── schedulers/           # Cron job schedulers
│   │   ├── scripts/              # CLI and batch scripts
│   │   ├── cli/                  # Database/queue management tools
│   │   ├── config/               # Configuration (Swagger, etc.)
│   │   ├── types/                # Backend TypeScript types
│   │   ├── utils/                # Utility functions
│   │   └── __tests__/            # Backend test files
│   ├── prisma/                   # Database schema and migrations
│   ├── fallbackBrowserSearch/    # Legacy browser scraper
│   ├── one-off-enqueues/         # One-time batch scripts
│   └── dist/                     # Compiled JavaScript output
│
├── config/                       # Docker and monitoring configuration
│   ├── docker-compose.*.yml      # Docker Compose variants
│   └── monitoring/               # Prometheus/Grafana configs
│
├── bullmq-exporter/              # Custom Prometheus metrics exporter
├── scripts/                      # Build and utility scripts
├── docs/                         # Project documentation
├── .claude/                      # Claude Code agent configuration
├── dev/                          # Active development docs
└── dist/                         # Frontend build output
```

### Key Directory Details

#### `/src` - React Frontend
**Purpose:** Single-page application for property search and data visualization

| Subdirectory | Purpose |
|--------------|---------|
| `components/features/PropertySearch/` | Main search UI with expandable property cards |
| `components/layout/` | Page structure (Footer, HeaderBadge, AttributionCard) |
| `components/ui/` | Reusable UI primitives (Button, Card, Input, Badge, Icon) |
| `hooks/useAnalytics.ts` | GA4 and Meta Pixel tracking hook |
| `lib/analytics.ts` | Analytics implementation (201 lines) |
| `services/` | API client services |

#### `/server/src` - Express Backend
**Purpose:** REST API, job orchestration, and scraping coordination

| Subdirectory | Key Files | Purpose |
|--------------|-----------|---------|
| `lib/` | `tcad-scraper.ts`, `claude.service.ts`, `prisma.ts` | Core scraping, AI search, DB client |
| `queues/` | `scraper.queue.ts` | BullMQ job processor with database tracking |
| `services/` | `token-refresh.service.ts`, `search-term-optimizer.js` | Token management, search optimization |
| `controllers/` | `property.controller.ts`, `api-usage.controller.ts` | Request handlers |
| `routes/` | `property.routes.ts`, `app.routes.ts` | API endpoint definitions |
| `middleware/` | `auth.ts`, `error.middleware.ts`, `validation.middleware.ts` | Express middleware |
| `scripts/` | `continuous-batch-scraper.ts`, `worker.ts` | Background job scripts |
| `cli/` | `db-stats.ts`, `queue-analyzer.ts`, `queue-manager.ts` | Management CLI tools |

#### `/server/prisma` - Database Layer
**Purpose:** PostgreSQL schema and migrations

| File | Purpose |
|------|---------|
| `schema.prisma` | Database models (Property, ScrapeJob, MonitoredSearch, ApiUsageLog) |
| `migrations/` | Schema version history |

#### `/config` - Infrastructure
**Purpose:** Docker Compose and monitoring configuration

| File | Environment |
|------|-------------|
| `docker-compose.base.yml` | Base service definitions |
| `docker-compose.dev.yml` | Development overrides |
| `docker-compose.prod.yml` | Production settings |
| `docker-compose.monitoring.yml` | Prometheus/Grafana stack |

---

## 3. File-by-File Breakdown

### Core Application Files

#### Frontend Entry Points
| File | Purpose |
|------|---------|
| `src/main.tsx` | React application bootstrap |
| `src/App.tsx` | Root component with routing |
| `index.html` | HTML template with analytics scripts |
| `vite.config.js` | Vite build configuration |

#### Backend Entry Points
| File | Purpose |
|------|---------|
| `server/src/index.ts` | Express server initialization with Sentry, Bull Board, CORS |
| `server/src/routes/app.routes.ts` | Route aggregation |
| `server/src/routes/property.routes.ts` | Property API endpoints |

#### Core Business Logic
| File | Lines | Purpose |
|------|-------|---------|
| `server/src/lib/tcad-scraper.ts` | ~600 | Dual-method scraping (API + Playwright) |
| `server/src/queues/scraper.queue.ts` | ~200 | BullMQ job processor with `RETURNING (xmax = 0)` for INSERT tracking |
| `server/src/lib/claude.service.ts` | ~150 | Natural language search with JSON validation |
| `server/src/services/token-refresh.service.ts` | ~260 | 4-layer token capture strategy |

### Configuration Files

#### Build & Development
| File | Purpose |
|------|---------|
| `package.json` | Root dependencies (React, Vite, Puppeteer) |
| `server/package.json` | Backend dependencies (Express, Prisma, BullMQ) |
| `tsconfig.json` | TypeScript project references |
| `tsconfig.app.json` | Frontend TypeScript config |
| `server/tsconfig.json` | Backend TypeScript config |
| `biome.json` | Biome formatter/linter config |

#### Environment & Secrets
| File | Purpose |
|------|---------|
| `.env.example` | Environment variable template |
| `.env.docker.example` | Docker environment template |
| `.env.monitoring.example` | Monitoring stack variables |
| `doppler.yaml` | Doppler secrets configuration |

### Data Layer

#### Prisma Schema (`server/prisma/schema.prisma`)
```prisma
model Property {
  id              String   @id @default(uuid())
  propertyId      String   @unique @map("property_id")
  name            String
  propType        String   @map("prop_type")
  city            String?
  propertyAddress String   @map("property_address")
  assessedValue   Float?   @map("assessed_value")
  appraisedValue  Float    @map("appraised_value")
  geoId           String?  @map("geo_id")
  description     String?  @db.Text
  searchTerm      String?  @map("search_term")
  scrapedAt       DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("properties")
}

model ScrapeJob {
  id          String    @id @default(uuid())
  searchTerm  String    @map("search_term")
  status      String
  resultCount Int?      @map("result_count")
  error       String?   @db.Text
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  @@map("scrape_jobs")
}

model MonitoredSearch {
  id         String   @id @default(uuid())
  searchTerm String   @unique @map("search_term")
  active     Boolean  @default(true)
  frequency  String   @default("daily")
  lastRun    DateTime?
  @@map("monitored_searches")
}

model ApiUsageLog {
  id            String   @id @default(uuid())
  timestamp     DateTime @default(now())
  endpoint      String
  inputTokens   Int      @map("input_tokens")
  outputTokens  Int      @map("output_tokens")
  totalTokens   Int      @map("total_tokens")
  costUsd       Float    @map("cost_usd")
  model         String
  @@map("api_usage_logs")
}
```

#### Migrations
| Migration | Purpose |
|-----------|---------|
| `20251028203525_init` | Initial schema |
| `20251107200405_add_search_term_analytics` | Search analytics tracking |
| `20251117170058_add_uuid_defaults` | UUID auto-generation |
| `20251126000000_add_api_usage_logs` | Claude API cost tracking |
| `20251213193258_add_composite_indexes` | Performance optimization |

### Frontend Components

#### Feature Components (`src/components/features/PropertySearch/`)
| Component | Purpose |
|-----------|---------|
| `PropertySearchContainer.tsx` | Main search orchestration |
| `SearchBox.tsx` | Search input with suggestions |
| `AnswerBox.tsx` | AI explanation display |
| `SearchResults.tsx` | Results list container |
| `PropertyCard.tsx` | Expandable property display |
| `PropertyDetails/` | Expanded property sections |

#### UI Components (`src/components/ui/`)
| Component | Purpose |
|-----------|---------|
| `Button/` | Styled button variants |
| `Card/` | Container component |
| `Input/` | Form input styling |
| `Badge/` | Status indicators |
| `Icon/` | SVG icon system |
| `LoadingSkeleton/` | Loading states |

### Testing Files

#### Test Organization
| Location | Framework | Type |
|----------|-----------|------|
| `server/src/__tests__/` | Vitest | Unit tests |
| `server/src/**/__tests__/` | Vitest | Co-located tests |
| `src/components/__tests__/` | Vitest | Frontend component tests |
| `server/jest_test/` | Jest | Legacy integration tests |

#### Key Test Files
| File | Coverage |
|------|----------|
| `server/src/queues/__tests__/scraper.queue.database-tracking.test.ts` | Database write tracking |
| `server/src/__tests__/auth.test.ts` | Authentication middleware |
| `server/src/middleware/__tests__/` | Middleware unit tests |

### DevOps Files

#### Docker Configuration
| File | Purpose |
|------|---------|
| `Dockerfile` | Frontend container build |
| `server/Dockerfile` | Backend container build |
| `bullmq-exporter/Dockerfile` | Metrics exporter container |

#### CI/CD (`.github/workflows/`)
| Workflow | Purpose |
|----------|---------|
| `ci.yml` | Lint, type-check, unit tests |
| `pr-checks.yml` | Pull request validation |
| `integration-tests.yml` | Integration test suite |
| `deploy.yml` | Production deployment |
| `security.yml` | Security scanning |

---

## 4. API Endpoints Analysis

### Property Endpoints (`/api/properties`)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/properties` | List properties with pagination | Optional |
| GET | `/api/properties/:id` | Get single property | Optional |
| POST | `/api/properties/search` | AI-powered natural language search | Optional |
| GET | `/api/properties/search/test` | Test Claude API connection | Optional |
| POST | `/api/properties/scrape/:propertyId` | Trigger single property scrape | Rate-limited |
| POST | `/api/properties/scrape/batch` | Queue batch scrape jobs | Rate-limited |

### Health & Monitoring Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Application health check |
| GET | `/health/queue` | Queue system status |
| GET | `/metrics` | Prometheus metrics |
| GET | `/admin/queues` | Bull Board dashboard |
| GET | `/api-docs` | Swagger documentation |

### API Usage Endpoints (`/api/api-usage`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/api-usage/stats` | Aggregate usage statistics |
| GET | `/api/api-usage/recent` | Recent API calls |

### Authentication Patterns
- **JWT Bearer Token:** `Authorization: Bearer <token>`
- **API Key:** `X-API-Key: <key>`
- **Optional Auth:** Most endpoints work without auth in development

### Request/Response Formats

#### Property Search Request
```json
{
  "query": "residential properties in Austin worth over 500k",
  "limit": 100,
  "offset": 0
}
```

#### Property Search Response
```json
{
  "data": [
    {
      "id": "uuid",
      "propertyId": "R123456",
      "name": "SMITH JOHN",
      "propType": "Real",
      "city": "Austin",
      "propertyAddress": "123 Main St",
      "assessedValue": 450000,
      "appraisedValue": 500000,
      "geoId": "0123456789",
      "description": "LOT 1 BLK A SUBDIVISION",
      "searchTerm": "Smith",
      "scrapedAt": "2025-12-13T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 1234,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  },
  "query": {
    "original": "residential properties in Austin worth over 500k",
    "explanation": "Searching for residential properties in Austin with appraised value over $500,000"
  }
}
```

---

## 5. Architecture Deep Dive

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TCAD Scraper System                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         ┌──────────────┐ │
│  │   React SPA      │  HTTP   │   Express API    │  TCP    │  PostgreSQL  │ │
│  │   (Port 5174)    │────────>│   (Port 3000)    │────────>│  (Tailscale) │ │
│  │                  │         │                  │         │              │ │
│  │  ┌────────────┐  │         │  ┌────────────┐  │         │  ┌────────┐  │ │
│  │  │ Search UI  │  │         │  │ Controllers│  │         │  │Property│  │ │
│  │  │ PropertyCard│  │         │  │ Routes     │  │         │  │ScrapeJob│  │ │
│  │  │ Analytics  │  │         │  │ Middleware │  │         │  │Monitored│  │ │
│  │  └────────────┘  │         │  └────────────┘  │         │  └────────┘  │ │
│  └──────────────────┘         └────────┬─────────┘         └──────────────┘ │
│                                        │                                     │
│                                        │ BullMQ                              │
│                                        ▼                                     │
│  ┌──────────────────┐         ┌──────────────────┐         ┌──────────────┐ │
│  │  Prometheus      │<────────│   Redis Queue    │         │ TCAD Website │ │
│  │  (Port 9090)     │ metrics │   (Port 6379)    │         │ (prodigycad) │ │
│  │                  │         │                  │         │              │ │
│  │  ┌────────────┐  │         │  ┌────────────┐  │         │  ┌────────┐  │ │
│  │  │BullMQ      │  │         │  │ Job Queue  │  │  HTTP   │  │ API    │  │ │
│  │  │Exporter    │  │         │  │ (scraper)  │────────────>│ Browser│  │ │
│  │  └────────────┘  │         │  └────────────┘  │         │  └────────┘  │ │
│  └──────────────────┘         └────────┬─────────┘         └──────────────┘ │
│                                        │                                     │
│                                        ▼                                     │
│                               ┌──────────────────┐                          │
│                               │  Scraper Workers │                          │
│                               │  (Playwright)    │                          │
│                               │                  │                          │
│                               │  ┌────────────┐  │                          │
│                               │  │ API Method │  │ Primary (1000+ results)  │
│                               │  │ Browser    │  │ Fallback (20 results)    │
│                               │  └────────────┘  │                          │
│                               └──────────────────┘                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Request Lifecycle

```
User Query
    │
    ▼
┌─────────────────┐
│ React Frontend  │ 1. User submits search query
│ SearchBox.tsx   │
└────────┬────────┘
         │ POST /api/properties/search
         ▼
┌─────────────────┐
│ Express Router  │ 2. Route matched
│ property.routes │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auth Middleware │ 3. Optional JWT/API key validation
│ auth.ts         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Controller      │ 4. Request handling
│ property.ctrl   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Claude Service  │ 5. NL query → Prisma filters
│ claude.service  │    with JSON validation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Prisma ORM      │ 6. Database query execution
│ prisma.ts       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PostgreSQL      │ 7. Return property records
│ (via Tailscale) │
└─────────────────┘
```

### Scraping Job Flow

```
Continuous Scraper
    │
    ▼ (generates search terms)
┌─────────────────┐
│ Search Term     │ Weighted distribution:
│ Generator       │ - Entity terms (Trust, LLC, Corp)
│                 │ - Last names (4+ chars)
│                 │ - Street addresses
└────────┬────────┘
         │ enqueue
         ▼
┌─────────────────┐
│ BullMQ Queue    │ Priority 1-10 jobs
│ scraper-queue   │ Concurrency: 2 workers
└────────┬────────┘
         │ process
         ▼
┌─────────────────┐
│ Scraper Worker  │
│ scraper.queue   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌───────┐
│ API   │  │Browser│
│Method │  │Method │
│(1000+)│  │ (20)  │
└───┬───┘  └───┬───┘
    │          │
    └────┬─────┘
         │
         ▼
┌─────────────────┐
│ Database Upsert │ RETURNING (xmax = 0) AS inserted
│ with tracking   │ Distinguishes INSERT vs UPDATE
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ScrapeJob Log   │ Status: completed/failed
│ with metrics    │ Result count, timing
└─────────────────┘
```

### Key Design Patterns

| Pattern | Implementation |
|---------|----------------|
| **Repository Pattern** | Prisma client abstraction in `lib/prisma.ts` |
| **Service Layer** | Business logic in `/services/` |
| **Controller Pattern** | Request handling in `/controllers/` |
| **Queue-based Processing** | BullMQ for async job execution |
| **Retry with Backoff** | Exponential backoff in queue configuration |
| **Circuit Breaker** | Token refresh with multi-source fallback |
| **Progressive Disclosure** | Expandable PropertyCard UI |
| **Feature-based Organization** | Components grouped by feature |

---

## 6. Environment & Setup Analysis

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/tcad_scraper"

# Redis
REDIS_HOST="localhost"        # "hobbes" for production
REDIS_PORT="6379"

# Authentication (optional)
JWT_SECRET="your-secure-random-secret"
API_KEY="your-api-key"

# AI Search
ANTHROPIC_API_KEY="sk-ant-api03-xxxxx"

# Frontend
FRONTEND_URL="http://localhost:5174"
FRONTEND_PORT="5174"

# Server
PORT="3000"
HOST="localhost"
NODE_ENV="development"
LOG_LEVEL="info"

# Queue
QUEUE_CONCURRENCY="2"
```

### Installation Process

```bash
# 1. Clone repository
git clone git@github.com:aledlie/tcad-scraper.git
cd tcad-scraper

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd server
npm install
npx playwright install chromium
npx playwright install-deps chromium

# 4. Configure Doppler (recommended)
doppler login
doppler setup --project integrity-studio --config dev

# 5. Start infrastructure
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml up -d

# 6. Initialize database (requires Tailscale)
doppler run -- npx prisma migrate dev

# 7. Start development servers
# Terminal 1 - Backend
cd server && doppler run -- npm run dev

# Terminal 2 - Frontend
npm run dev
```

### Development Workflow

1. **Code Changes:** Edit TypeScript files in `src/` or `server/src/`
2. **Type Checking:** `npx tsc --noEmit`
3. **Linting:** `npx biome check .`
4. **Testing:** `npm test` (unit) or `npm run test:integration`
5. **Build:** `npm run build` (frontend) or `cd server && npm run build`

### Production Deployment (Hobbes)

```bash
# Deploy via git (if TypeScript compiles)
ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper && git pull origin linux-env"
ssh aledlie@hobbes "cd /home/aledlie/tcad-scraper/server && npm run build && pm2 restart tcad-api"

# Direct file copy (if build fails)
scp dist/queues/scraper.queue.js aledlie@hobbes:/home/aledlie/tcad-scraper/server/dist/queues/
ssh aledlie@hobbes "pm2 restart tcad-api"

# Verify deployment
curl -s "https://api.alephatx.info/health" | jq
```

---

## 7. Technology Stack Breakdown

### Runtime Environment
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| TypeScript | 5.9.3 | Type-safe JavaScript |
| PM2 | Latest | Production process manager |

### Frontend Frameworks
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2 | UI component library |
| Vite | 7.1.11 | Build tool and dev server |
| CSS Modules | - | Scoped component styling |

### Backend Frameworks
| Technology | Version | Purpose |
|------------|---------|---------|
| Express | 4.18 | HTTP server framework |
| Prisma | 5.8+ | Type-safe ORM |
| BullMQ | 5.62 | Distributed job queue |
| Zod | Latest | Runtime type validation |

### Database Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 15+ | Primary data store |
| Redis | 7 | Queue and cache storage |

### Scraping Tools
| Technology | Version | Purpose |
|------------|---------|---------|
| Playwright | 1.56+ | Browser automation |
| Puppeteer | 24.27 | Alternative browser automation |
| Cheerio | 1.1 | HTML parsing |

### AI & Analytics
| Technology | Purpose |
|------------|---------|
| Anthropic Claude | Natural language search parsing |
| Google Analytics 4 | User behavior tracking |
| Meta Pixel | Marketing analytics |
| Mixpanel | Product analytics |

### Monitoring & Observability
| Technology | Purpose |
|------------|---------|
| Sentry | Error tracking and performance |
| Prometheus | Metrics collection |
| Bull Board | Queue monitoring dashboard |
| Pino | Structured logging |

### Testing Frameworks
| Technology | Purpose |
|------------|---------|
| Vitest | Primary test runner |
| Jest | Legacy integration tests |
| Playwright Test | E2E testing |
| Testing Library | Component testing |

### Build & Development
| Technology | Purpose |
|------------|---------|
| Biome | Linting and formatting |
| tsx | TypeScript execution |
| Docker Compose | Container orchestration |

---

## 8. Visual Architecture Diagram

### System Context Diagram

```
                              ┌─────────────────────┐
                              │    External Users   │
                              │    (Web Browsers)   │
                              └──────────┬──────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            TCAD Scraper System                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Frontend Layer                               │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │   │
│  │  │  SearchBox   │  │  AnswerBox   │  │    PropertyCard          │   │   │
│  │  │  Component   │  │  (AI Answer) │  │    (Expandable)          │   │   │
│  │  └──────┬───────┘  └──────────────┘  │  ┌────────────────────┐  │   │   │
│  │         │                            │  │ PropertyDetails    │  │   │   │
│  │         │                            │  │ - FinancialSection │  │   │   │
│  │         │                            │  │ - IdentifiersSection│  │   │   │
│  │         │                            │  │ - DescriptionSection│  │   │   │
│  │         │                            │  │ - MetadataSection  │  │   │   │
│  │         │                            │  └────────────────────┘  │   │   │
│  │         │                            └──────────────────────────┘   │   │
│  └─────────┼───────────────────────────────────────────────────────────┘   │
│            │                                                                │
│            │ HTTP/REST                                                      │
│            ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API Layer                                    │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │   Routes     │  │  Controllers │  │  Middleware  │               │   │
│  │  │ /properties  │──│  property    │──│  auth        │               │   │
│  │  │ /api-usage   │  │  api-usage   │  │  error       │               │   │
│  │  │ /health      │  │              │  │  validation  │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Service Layer                                  │   │
│  │                                                                      │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │   │
│  │  │ Claude Service │  │ Token Refresh  │  │ Search Term    │         │   │
│  │  │ (NL → SQL)     │  │ Service        │  │ Optimizer      │         │   │
│  │  └───────┬────────┘  └───────┬────────┘  └────────────────┘         │   │
│  │          │                   │                                       │   │
│  │          │                   │                                       │   │
│  │  ┌───────┴───────────────────┴────────┐                              │   │
│  │  │          TCAD Scraper              │                              │   │
│  │  │   ┌──────────┐  ┌──────────┐       │                              │   │
│  │  │   │ API      │  │ Browser  │       │                              │   │
│  │  │   │ Method   │  │ Method   │       │                              │   │
│  │  │   │ (1000+)  │  │ (20)     │       │                              │   │
│  │  │   └──────────┘  └──────────┘       │                              │   │
│  │  └────────────────────────────────────┘                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                        ┌───────────┴───────────┐                           │
│                        ▼                       ▼                           │
│  ┌──────────────────────────┐    ┌──────────────────────────┐              │
│  │       Data Layer         │    │      Queue Layer          │              │
│  │                          │    │                           │              │
│  │  ┌────────────────────┐  │    │  ┌────────────────────┐   │              │
│  │  │    Prisma ORM      │  │    │  │   BullMQ Queue     │   │              │
│  │  │                    │  │    │  │   (scraper-queue)  │   │              │
│  │  │  ┌──────────────┐  │  │    │  │                    │   │              │
│  │  │  │ Property     │  │  │    │  │  concurrency: 2    │   │              │
│  │  │  │ ScrapeJob    │  │  │    │  │  retries: 3        │   │              │
│  │  │  │ MonitoredSearch│ │  │    │  │  backoff: exp     │   │              │
│  │  │  │ ApiUsageLog  │  │  │    │  │                    │   │              │
│  │  │  └──────────────┘  │  │    │  └────────────────────┘   │              │
│  │  └────────────────────┘  │    └──────────────────────────┘              │
│  └──────────────────────────┘                                              │
│             │                              │                                │
└─────────────┼──────────────────────────────┼────────────────────────────────┘
              │                              │
              ▼                              ▼
   ┌──────────────────┐          ┌──────────────────┐
   │   PostgreSQL     │          │      Redis       │
   │   (Tailscale)    │          │   (Docker)       │
   │                  │          │                  │
   │  418K+ properties│          │  Job state       │
   └──────────────────┘          └──────────────────┘
```

### Component Hierarchy

```
App.tsx
├── ErrorBoundary
├── HeaderBadge
├── PropertySearchContainer
│   ├── SearchBox
│   │   └── Input (ui)
│   ├── AnswerBox
│   │   └── Card (ui)
│   └── SearchResults
│       └── PropertyCard[]
│           ├── Card (ui)
│           ├── Badge (ui)
│           ├── ExpandButton
│           └── PropertyDetails (expandable)
│               ├── SectionHeader
│               ├── FinancialSection
│               │   └── ValueComparison
│               ├── IdentifiersSection
│               ├── DescriptionSection
│               │   └── TruncatedText
│               └── MetadataSection
│                   ├── TimestampList
│                   └── FreshnessIndicator
├── Footer
│   └── AttributionCard
└── Analytics (hidden)
```

### Data Flow Diagram

```
                    User Input
                        │
                        ▼
              ┌─────────────────┐
              │   SearchBox     │
              │ "properties in  │
              │  Austin > 500k" │
              └────────┬────────┘
                       │
         POST /api/properties/search
                       │
                       ▼
              ┌─────────────────┐
              │ property.routes │
              │   ↓             │
              │ auth.middleware │
              │   ↓             │
              │ property.ctrl   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Claude Service  │
              │                 │
              │ "properties in  │──────┐
              │  Austin > 500k" │      │ Anthropic API
              │       ↓         │      ▼
              │ JSON filters    │ ┌─────────────┐
              │ {               │ │   Claude    │
              │   city: Austin  │ │   claude-3  │
              │   appraisedValue│ │   -haiku    │
              │     > 500000    │ └─────────────┘
              │ }               │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Prisma ORM    │
              │                 │
              │ SELECT * FROM   │
              │ properties      │
              │ WHERE city =    │
              │   'Austin'      │
              │ AND appraised   │
              │   > 500000      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   PostgreSQL    │
              │   (Tailscale)   │
              │                 │
              │ 418K+ records   │
              │ indexed by:     │
              │ - propertyId    │
              │ - city          │
              │ - propType      │
              │ - appraisedValue│
              └────────┬────────┘
                       │
              Property[] (up to 1000)
                       │
                       ▼
              ┌─────────────────┐
              │ Response JSON   │
              │ {               │
              │   data: [...],  │
              │   pagination:{} │
              │   query: {      │
              │     original,   │
              │     explanation │
              │   }             │
              │ }               │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  SearchResults  │
              │       ↓         │
              │  PropertyCard[] │
              │  (expandable)   │
              └─────────────────┘
```

---

## 9. Key Insights & Recommendations

### Code Quality Assessment

**Strengths:**
- ✅ Strong TypeScript adoption with strict type checking
- ✅ Well-organized component structure (feature-based)
- ✅ Comprehensive error handling with Sentry integration
- ✅ Robust queue system with retry and backoff
- ✅ Good test coverage for critical paths (middleware, utils)
- ✅ Clean separation of concerns (controllers → services → repositories)

**Areas for Improvement:**
- ⚠️ 11 `any` types remain (7 in legacy scripts, 4 documented exceptions)
- ⚠️ 17 `console.*` statements in legacy scripts
- ⚠️ Some tests skipped due to Playwright mock complexity (67 tests)
- ⚠️ Test coverage at 34.55% (target: 60%)

### Security Considerations

| Area | Status | Recommendation |
|------|--------|----------------|
| **Authentication** | ✅ JWT + API key support | Enforce in production |
| **Rate Limiting** | ✅ Implemented with `express-rate-limit` | Monitor abuse patterns |
| **Input Validation** | ✅ Zod schemas | Expand coverage to all endpoints |
| **Secrets Management** | ✅ Doppler integration | Never hardcode secrets |
| **CORS** | ✅ Configured | Restrict origins in production |
| **Trust Proxy** | ✅ `app.set('trust proxy', 1)` | Required for nginx |
| **SQL Injection** | ✅ Prisma parameterized queries | Safe by default |

### Performance Optimization Opportunities

1. **Database Indexing** (Implemented 2025-12-13)
   - Added composite indexes for common query patterns
   - `@@index([city, propType, appraisedValue])`

2. **Query Optimization**
   - Consider cursor-based pagination for large result sets
   - Implement query result caching with Redis

3. **Scraping Efficiency**
   - Current: 42K properties/hour
   - Bottleneck: TCAD API rate limiting
   - Consider: Adaptive concurrency based on success rate

4. **Frontend Performance**
   - ✅ Code splitting with lazy loading (implemented)
   - Consider: Virtual scrolling for large result sets

### Maintainability Suggestions

1. **Complete Vitest Migration**
   - Remaining Jest tests in `server/jest_test/`
   - Target: 100% Vitest for consistency

2. **Documentation Updates**
   - Keep CLAUDE.md synchronized with changes
   - Add JSDoc comments to public APIs

3. **Type Safety Enforcement**
   - Upgrade `@typescript-eslint/no-explicit-any` from warning to error
   - Remove remaining `any` types in scripts

4. **Monitoring Enhancement**
   - Add Sentry AI Agent monitoring for Claude API calls
   - Implement cost alerting for API usage

### Critical Bug Fixes Applied (November 2025)

| Bug | Impact | Fix |
|-----|--------|-----|
| Database write tracking | Zero new properties despite completed jobs | Added `RETURNING (xmax = 0) AS inserted` |
| Token refresh failures | 30% success rate | Multi-source capture (4-layer strategy) |
| Claude JSON parsing | 30-40% crash rate | JSON validation, markdown stripping, try-catch fallback |

### Test Results Summary

| Category | Passing | Skipped | Coverage |
|----------|---------|---------|----------|
| Unit Tests | 282 | 67 | - |
| Integration Tests | 141 | - | - |
| Overall Coverage | - | - | 34.55% |

**Target:** 60% coverage with focus on:
- Queue job processing
- Error handling paths
- Edge cases in search parsing

---

## Appendix: Quick Reference

### Key NPM Scripts

```bash
# Frontend
npm run dev           # Start Vite dev server
npm run build         # Production build
npm run preview       # Preview production build

# Backend (from /server)
npm run dev           # Start Express with tsx watch
npm run build         # Compile TypeScript
npm start            # Run compiled JS

# Testing
npm test              # Unit tests (Vitest)
npm run test:integration  # Integration tests
npm run test:coverage     # Coverage report

# Database
npx prisma generate   # Generate Prisma client
npx prisma migrate dev  # Run migrations
npx prisma studio     # Open database UI

# Queue Management
npm run queue:status  # Check queue health
npm run analyze:overview  # Queue analytics
```

### Access Points

| Environment | URL |
|-------------|-----|
| Frontend (dev) | http://localhost:5174 |
| Backend (dev) | http://localhost:3000 |
| Bull Dashboard | http://localhost:3000/admin/queues |
| API Docs | http://localhost:3000/api-docs |
| Prisma Studio | http://localhost:5555 |
| Frontend (prod) | https://alephatx.github.io/tcad-scraper/ |
| API (prod) | https://api.alephatx.info |

### Key File Locations

| Purpose | Path |
|---------|------|
| Frontend entry | `src/main.tsx` |
| Backend entry | `server/src/index.ts` |
| Database schema | `server/prisma/schema.prisma` |
| Queue processor | `server/src/queues/scraper.queue.ts` |
| Scraper logic | `server/src/lib/tcad-scraper.ts` |
| Claude integration | `server/src/lib/claude.service.ts` |
| Token refresh | `server/src/services/token-refresh.service.ts` |
| Project config | `CLAUDE.md` |

---

*Generated by Claude Code Codebase Analyzer*
*Last Updated: December 13, 2025*
