# TCAD Scraper Architecture

**Last Updated:** November 8, 2025

## System Overview

The TCAD Scraper is a production-ready web scraping and property data management system built with a modern microservices architecture. It provides automated data collection from the Travis Central Appraisal District (TCAD) website with AI-powered search capabilities.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        WebUI[Web UI<br/>React + Vite]
        API_Client[API Clients<br/>External Apps]
    end

    subgraph "API Gateway Layer"
        Express[Express Server<br/>:3002]
        Auth[Optional Auth<br/>JWT/API Key]
        RateLimit[Rate Limiter<br/>100req/15min]
        Swagger[Swagger UI<br/>/api-docs]
    end

    subgraph "Application Layer"
        Routes[API Routes]
        Controllers[Controllers]
        Services[Services]
        Middleware[Middleware]
    end

    subgraph "Core Services"
        Scraper[Scraper Service<br/>Playwright]
        ClaudeAI[Claude AI Service<br/>Natural Language]
        TokenRefresh[Token Refresh<br/>Auto-Refresh]
        SearchOpt[Search Optimizer<br/>Analytics]
    end

    subgraph "Queue System"
        BullMQ[BullMQ Queue]
        Worker[Queue Worker]
        Dashboard[Bull Dashboard<br/>/admin/queues]
    end

    subgraph "Data Layer"
        Postgres[(PostgreSQL<br/>Database)]
        Redis[(Redis Cache<br/>5-10min TTL)]
        Prisma[Prisma ORM]
    end

    subgraph "Monitoring & Logging"
        Sentry[Sentry<br/>Error Tracking]
        Pino[Pino Logger<br/>Structured Logs]
        Prometheus[Prometheus<br/>Metrics]
    end

    subgraph "Scheduled Jobs"
        Cron[Cron Scheduler]
        Monitor[Monitored Searches]
    end

    subgraph "External Services"
        TCAD[TCAD Website<br/>tcad.org]
        Anthropic[Anthropic API<br/>Claude AI]
    end

    %% Client connections
    WebUI -->|HTTPS| Express
    API_Client -->|HTTPS| Express

    %% API Gateway flow
    Express --> Auth
    Auth --> RateLimit
    RateLimit --> Routes
    Express --> Swagger

    %% Application flow
    Routes --> Controllers
    Controllers --> Services
    Services --> Middleware

    %% Service connections
    Services --> Scraper
    Services --> ClaudeAI
    Services --> TokenRefresh
    Services --> SearchOpt
    Services --> BullMQ

    %% Queue system
    BullMQ --> Worker
    Worker --> Scraper
    BullMQ --> Dashboard

    %% Data access
    Services --> Prisma
    Prisma --> Postgres
    Services --> Redis

    %% Monitoring
    Services --> Sentry
    Services --> Pino
    Services --> Prometheus

    %% Scheduled jobs
    Cron --> Monitor
    Monitor --> BullMQ

    %% External services
    Scraper -->|Web Scraping| TCAD
    ClaudeAI -->|API Calls| Anthropic
    TokenRefresh -->|Auto-Refresh| TCAD

    %% Styling
    classDef clientStyle fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    classDef gatewayStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef appStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef serviceStyle fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef dataStyle fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    classDef monitorStyle fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef externalStyle fill:#e0e0e0,stroke:#616161,stroke-width:2px

    class WebUI,API_Client clientStyle
    class Express,Auth,RateLimit,Swagger gatewayStyle
    class Routes,Controllers,Services,Middleware appStyle
    class Scraper,ClaudeAI,TokenRefresh,SearchOpt,BullMQ,Worker,Dashboard serviceStyle
    class Postgres,Redis,Prisma dataStyle
    class Sentry,Pino,Prometheus,Cron,Monitor monitorStyle
    class TCAD,Anthropic externalStyle
```

## Component Details

### 1. Client Layer

#### Web UI (React + Vite)
- **Technology:** React 19.2, TypeScript, Vite 7.1
- **Features:**
  - Real-time search interface with natural language queries (Claude AI)
  - **Expandable PropertyCard Component** (Progressive Disclosure Pattern)
    - Financial analysis with value comparison
    - Property identifiers display
    - Description with smart truncation
    - Data freshness indicators (color-coded)
  - Property data visualization with responsive design
  - Job status monitoring via analytics integration
  - Mobile-first responsive layouts (640px, 1024px breakpoints)
  - WCAG AA accessibility compliance
- **Components:** 29 new frontend components for PropertyCard expansion
- **Styling:** CSS Modules for scoped component styles
- **Security:** Content Security Policy (CSP) with nonces

#### API Clients
- External applications consuming the REST API
- Authentication via JWT tokens or API keys
- Rate-limited access

### 2. API Gateway Layer

#### Express Server
- **Port:** 3002 (configurable)
- **Features:**
  - RESTful API endpoints
  - Health check endpoints
  - CORS configuration
  - Helmet security middleware

#### Authentication & Authorization
- **Optional Auth:** Development mode allows unauthenticated access
- **JWT Tokens:** Stateless authentication
- **API Keys:** Header-based authentication (`X-API-Key`)

#### Rate Limiting
- **API Endpoints:** 100 requests per 15 minutes
- **Scraping Endpoints:** 5 requests per minute
- **Protection:** DDoS prevention, resource management

### 3. Application Layer

#### Routes (`/api/properties`)
- `POST /scrape` - Queue new scrape job
- `GET /jobs/:jobId` - Get job status
- `GET /history` - Scrape job history
- `GET /` - Query properties
- `POST /search` - AI-powered search
- `GET /stats` - Aggregate statistics
- `POST /monitor` - Add monitored search
- `GET /monitor` - List monitored searches

#### Controllers
- **PropertyController:** Handles all property-related operations
- **Responsibilities:**
  - Request validation
  - Business logic orchestration
  - Response formatting
  - Error handling

#### Services
- **PropertyService:** Property data management
- **ScraperService:** Web scraping orchestration
- **ClaudeService:** AI query processing
- **TokenRefreshService:** TCAD token management
- **SearchOptimizerService:** Search term analytics

### 4. Core Services

#### Scraper Service (Playwright)
- **Technology:** Playwright (headless browser)
- **Features:**
  - JavaScript rendering
  - Anti-bot detection bypass
  - Screenshot capture (debug)
  - Cookie management
- **Process:**
  1. Authenticate with TCAD
  2. Search by term
  3. Extract property data
  4. Parse and normalize
  5. Store in database

#### Claude AI Service
- **Provider:** Anthropic Claude 3.5 Sonnet
- **Use Cases:**
  - Natural language to SQL query translation
  - Intelligent search filtering
  - Query optimization suggestions
- **Rate Limiting:** Built-in retry logic

#### Token Refresh Service
- **Purpose:** Keep TCAD authentication tokens fresh
- **Schedule:** Cron-based or interval-based
- **Monitoring:** Health checks, success/failure tracking
- **Auto-Recovery:** Automatic retry on failure

#### Search Optimizer
- **Analytics Tracking:**
  - Search term performance
  - Result counts
  - Success rates
  - Timing metrics
- **Optimization:** Suggests better search terms

### 5. Queue System (BullMQ)

#### Queue Architecture
- **Technology:** BullMQ (Redis-backed)
- **Benefits:**
  - Async job processing
  - Retry logic
  - Job prioritization
  - Progress tracking

#### Worker Process
- Processes scraping jobs from queue
- Configurable concurrency
- Graceful shutdown
- Error recovery

#### Bull Dashboard
- **URL:** `/admin/queues`
- **Features:**
  - Real-time job monitoring
  - Manual job management
  - Queue statistics
  - Failed job retry

### 6. Data Layer

#### PostgreSQL Database
- **ORM:** Prisma
- **Schema:**
  - `Property` - Property records
  - `ScrapeJob` - Job tracking
  - `MonitoredSearch` - Scheduled searches
  - `SearchTermAnalytics` - Analytics data

#### Redis Cache
- **Purpose:** Performance optimization
- **TTL Settings:**
  - Property queries: 5 minutes
  - Statistics: 10 minutes
  - Cache invalidation on new data
- **Metrics:** Hit rate, miss rate tracking

#### Prisma ORM
- Type-safe database access
- Migration management
- Query optimization
- Connection pooling

### 7. Monitoring & Logging

#### Sentry Error Tracking
- **Features:**
  - Real-time error reporting
  - Performance monitoring
  - Release tracking
  - User context
- **Integration:** Express middleware

#### Pino Logger
- **Format:** Structured JSON logging
- **Levels:** debug, info, warn, error
- **Features:**
  - Pretty printing (dev)
  - Log rotation
  - High performance
- **Migration:** All 1,444+ console.log migrated

#### Prometheus Metrics
- Queue depth
- Job success/failure rates
- Response times
- Cache hit rates

### 8. Scheduled Jobs

#### Cron Scheduler
- **Library:** node-cron
- **Jobs:**
  - Monitored search execution
  - Token refresh
  - Database cleanup
  - Analytics updates

#### Monitored Searches
- User-configured search terms
- Automatic periodic scraping
- Email notifications (planned)
- Result comparison

### 9. Frontend Components (React)

#### PropertySearch Feature
- **Location:** `src/components/features/PropertySearch/`
- **Components:** 31 files (29 new + 2 updated)

##### Core Components
- **PropertySearchContainer** - Main search interface container
- **SearchBox** - Input field with AI-powered search
- **ExampleQueries** - Pre-defined query suggestions
- **SearchResults** - Grid display of PropertyCard components
- **PropertyCard** - Individual property display (updated with expansion)

##### PropertyCard Expansion Components (New)
- **ExpandButton** - Toggle control for card expansion
  - Size variants: sm, md, lg
  - Animated chevron rotation (180°)
  - ARIA-compliant

- **PropertyDetails** - Container for expanded content
  - Configurable sections
  - Fade-in animation (300ms)
  - Conditional rendering

##### Section Components (New)
- **FinancialSection**
  - Appraised vs Assessed value comparison
  - Automatic difference calculation
  - Percentage display
  - Color-coded indicators (🔺🔻➖)

- **IdentifiersSection**
  - Property ID display (monospace font)
  - Geo ID display with null handling
  - Future: Copy-to-clipboard functionality

- **DescriptionSection**
  - Smart text truncation (150 chars)
  - "Show more"/"Show less" toggle
  - Height animation

- **MetadataSection**
  - Timestamp display (relative + absolute)
  - Data freshness indicator
  - Color-coded status badges

##### Utility Components (New)
- **SectionHeader** - Reusable section title component
  - Icon support
  - Optional badges
  - Collapsible variant

- **ValueComparison** - Financial value display
  - Currency formatting via useFormatting hook
  - Difference calculation
  - Color-coded results

- **TruncatedText** - Text truncation with expansion
  - Configurable max length
  - Smooth transitions
  - Null state handling

- **TimestampList** - Timestamp formatting
  - Relative time ("2 days ago")
  - Absolute time display
  - Multiple timestamp support

- **FreshnessIndicator** - Data quality indicator
  - Configurable thresholds (7/30 days)
  - Color-coded badges:
    - 🟢 Fresh (0-7 days)
    - 🟡 Aging (7-30 days)
    - 🔴 Stale (30+ days)
  - Variant modes: dot, badge

##### Component Patterns
- **Progressive Disclosure**: Information revealed on demand
- **Graceful Degradation**: Null value handling throughout
- **Mobile-First**: Responsive breakpoints (640px, 1024px)
- **Accessibility**: WCAG AA compliant
  - Keyboard navigation
  - Screen reader support
  - ARIA attributes
  - Focus indicators
  - Color contrast (4.5:1 minimum)

##### Styling Architecture
- **CSS Modules** - Scoped component styles
- **Design Tokens** - Consistent colors, spacing, typography
- **Animations** - 300ms transitions for smooth UX
- **Responsive Grid** - Mobile/tablet/desktop layouts

## Data Flow

### Scraping Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Controller
    participant Queue
    participant Worker
    participant Scraper
    participant TCAD
    participant Database

    Client->>API: POST /api/properties/scrape
    API->>Controller: Validate & process
    Controller->>Queue: Add job to queue
    Queue-->>Controller: Return job ID
    Controller-->>Client: 202 Accepted {jobId}

    Worker->>Queue: Poll for jobs
    Queue-->>Worker: Job data
    Worker->>Scraper: Execute scrape
    Scraper->>TCAD: Authenticate
    TCAD-->>Scraper: Session token
    Scraper->>TCAD: Search query
    TCAD-->>Scraper: Search results
    Scraper->>Scraper: Parse & normalize
    Scraper->>Database: Save properties
    Database-->>Scraper: Success
    Scraper-->>Worker: Complete
    Worker->>Queue: Update job status

    Client->>API: GET /api/properties/jobs/:jobId
    API->>Database: Query job status
    Database-->>API: Job details
    API-->>Client: Job status & results
```

### AI Search Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Controller
    participant ClaudeService
    participant Anthropic
    participant Cache
    participant Database

    Client->>API: POST /api/properties/search
    API->>Controller: {query: "Find homes in Austin > $500k"}
    Controller->>Cache: Check cache
    Cache-->>Controller: Cache miss

    Controller->>ClaudeService: Process natural language
    ClaudeService->>Anthropic: Send query + schema
    Anthropic-->>ClaudeService: Parsed filters
    ClaudeService-->>Controller: {city: "Austin", minValue: 500000}

    Controller->>Database: Query with filters
    Database-->>Controller: Property results
    Controller->>Cache: Store results (5 min TTL)
    Controller-->>API: Format response
    API-->>Client: Property list + metadata
```

## Security

### Authentication & Authorization
- **Optional in Development:** Easier local testing
- **Required in Production:** JWT or API key
- **Token Validation:** Middleware-based
- **CORS:** Configurable allowed origins

### Security Middleware
- **Helmet:** HTTP security headers
- **CORS:** Cross-origin resource sharing
- **Rate Limiting:** DDoS protection
- **CSP:** Content Security Policy with nonces
- **Input Validation:** Zod schema validation

### Data Protection
- **Sensitive Data:** Environment variables
- **Secrets Management:** `.env` file (gitignored)
- **Database:** Connection pooling, prepared statements
- **Redis:** Password-protected

## Scalability

### Horizontal Scaling
- **Stateless API:** Can run multiple instances
- **Load Balancer:** Distribute traffic
- **Queue Workers:** Independent scaling
- **Database:** Read replicas (future)

### Performance Optimizations
- **Caching:** Redis for frequent queries
- **Connection Pooling:** Database and Redis
- **Queue System:** Async processing
- **Pagination:** Limit result sizes
- **Indexes:** Database query optimization

### Resource Management
- **Queue Concurrency:** Configurable worker count
- **Rate Limiting:** Prevent resource exhaustion
- **Graceful Shutdown:** Clean connection closing
- **Memory Management:** Streaming for large datasets

## Deployment

### Environment Configuration
```env
# Server
NODE_ENV=production
PORT=3002
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:pass@host:5432/tcad

# Redis
REDIS_URL=redis://host:6379
REDIS_PASSWORD=secret

# TCAD Scraper
TCAD_AUTO_REFRESH_TOKEN=true
TCAD_TOKEN_REFRESH_CRON=0 */2 * * *

# External Services
ANTHROPIC_API_KEY=sk-ant-...
SENTRY_DSN=https://...

# Security
JWT_SECRET=secret
API_KEY=key
```

### Docker Deployment (Planned)
- Multi-stage builds
- Docker Compose for local development
- Container orchestration (Kubernetes)
- Health checks
- Auto-restart policies

### CI/CD Pipeline (Planned)
- **GitHub Actions:** Automated testing
- **Build:** TypeScript compilation
- **Test:** Unit and integration tests
- **Lint:** ESLint, Prettier
- **Deploy:** Automated deployment
- **Monitoring:** Post-deployment checks

## Monitoring & Observability

### Health Checks
- `GET /health` - Basic server health
- `GET /health/queue` - Queue status
- `GET /health/token` - Token refresh service
- `GET /health/cache` - Redis connection
- `GET /health/sentry` - Error tracking status

### Metrics
- Queue depth and processing time
- Cache hit/miss rates
- API response times
- Error rates by endpoint
- Scraper success/failure rates

### Logging
- Structured JSON logs (Pino)
- Request/response logging
- Error stack traces
- Performance metrics
- Audit trails

## Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript 5.x
- **ORM:** Prisma
- **Queue:** BullMQ
- **Scraper:** Playwright
- **Logger:** Pino

### Frontend
- **Framework:** React 19.2
- **Build Tool:** Vite 7.1
- **Language:** TypeScript 5.x
- **Styling:** CSS Modules (scoped component styles)
- **Component Library:** Custom components (Card, Badge, Icon, Button)
- **UI Pattern:** Progressive Disclosure (expandable PropertyCard)
- **Accessibility:** WCAG AA compliant
- **Responsive:** Mobile-first design (640px, 1024px breakpoints)

### Data Storage
- **Database:** PostgreSQL 14+
- **Cache:** Redis 7+
- **Queue:** Redis (BullMQ)

### External Services
- **AI:** Anthropic Claude 3.5 Sonnet
- **Monitoring:** Sentry
- **Metrics:** Prometheus (planned)

### Development Tools
- **Testing:** Jest, Playwright
- **Linting:** ESLint
- **Formatting:** Prettier
- **API Docs:** Swagger/OpenAPI 3.0

## Future Enhancements

### High Priority
1. ~~Swagger/OpenAPI documentation~~ ✅ **COMPLETED**
2. ~~Architecture diagram~~ ✅ **COMPLETED**
3. Enhanced Prometheus metrics
4. CI/CD pipeline setup

### Medium Priority
5. Docker containerization
6. Kubernetes deployment
7. Email notifications for monitored searches
8. GraphQL API option
9. Real-time WebSocket updates

### Low Priority
10. Multi-region deployment
11. Machine learning for search optimization
12. Property value prediction
13. Historical data analysis
14. Public API marketplace

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT License - See [LICENSE](./LICENSE) for details.

---

**Documentation Version:** 1.0
**Last Updated:** November 8, 2025
**Maintainer:** @aledlie
