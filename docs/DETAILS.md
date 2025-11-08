# DETAILS.md

🔍 **Powered by [Detailer](https://detailer.ginylil.com)** - Context-aware codebase analysis



---

## 1. Project Overview

### Purpose & Domain
**tcad-scraper** is a comprehensive property data scraping and search system designed to extract, process, and serve detailed real estate property information primarily from Travis County Appraisal District (TCAD) sources. It addresses the problem of aggregating and structuring property tax and valuation data for use in analytics, search, and monitoring applications.

### Target Users & Use Cases
- **End Users:** Real estate professionals, investors, analysts, and developers seeking detailed property information.
- **Use Cases:**
  - Property search with rich filtering and sorting.
  - Automated scraping and data refresh of property tax and valuation data.
  - Monitoring and analytics of property data trends.
  - Integration with AI-powered natural language search.
  - Operational monitoring and queue management for scraping jobs.

### Core Business Logic & Domain Models
- **Property Data Model:** Includes property identifiers, owner info, addresses, valuations, exemptions, and metadata.
- **Scrape Jobs:** Background tasks representing scraping operations with statuses and results.
- **Search Terms & Monitoring:** Management of search terms, including zero-result and high-performing terms.
- **AI Integration:** Natural language query parsing via Claude AI for enhanced search capabilities.

---

## 2. Architecture and Structure

### High-Level Architecture
- **Frontend:** React-based UI with components for property search, filtering, analytics, and data presentation.
- **Backend API:** Node.js/Express server written in TypeScript, exposing RESTful endpoints for property data, scraping jobs, monitoring, and health checks.
- **Scraper:** Headless browser automation (Playwright) and fallback DOM scraping for data acquisition.
- **Queue System:** Redis-backed BullMQ queues manage scraping jobs asynchronously.
- **Scheduler:** Cron-based scheduled jobs trigger periodic scraping and cleanup.
- **Data Layer:** PostgreSQL database accessed via Prisma ORM, storing property data, scrape jobs, and monitoring info.
- **Monitoring:** Prometheus and Grafana for metrics collection and visualization.
- **Security:** JWT and API key authentication, CSP headers, and XController pattern for secure data embedding.
- **DevOps:** Dockerized deployment, Doppler for secrets management, CI/CD pipelines via GitHub Actions.

### Complete Repository Structure
```
.
├── .claude/
│   └── agents/
│       └── webscraper-research-agent.md
├── .github/
│   └── workflows/
│       ├── README.md
│       ├── ci.yml
│       ├── deploy.yml
│       ├── pr-checks.yml
│       └── security.yml
├── bullmq-exporter/
│   ├── Dockerfile
│   ├── index.js
│   └── package.json
├── dev/
│   ├── active/
│   │   ├── analytics-implementation-context.md
│   │   ├── analytics-implementation-tasks.md
│   │   ├── ci-cd-implementation-context.md
│   │   ├── ci-cd-implementation-tasks.md
│   │   ├── test-coverage-improvement-context.md
│   │   └── test-coverage-improvement-tasks.md
│   ├── HANDOFF-2025-11-08.md
│   ├── HANDOFF.md
│   ├── QUICK-START-SESSION-4.md
│   ├── README.md
│   ├── SESSION-3-SUMMARY.md
│   ├── SESSION_SUMMARY.md
│   └── repo-summary.json
├── docs/
│   ├── ANALYTICS.md
│   ├── API.md
│   ├── API_TOKEN_IMPLEMENTATION.md
│   ├── API_TOKEN_VERIFICATION.md
│   ├── BRANCH-PROTECTION.md
│   ├── CHANGELOG.md
│   ├── CI-CD.md
│   ├── CLAUDE.md
│   ├── CODEBASE_ANALYSIS.md
│   ├── ENQUEUE_FIXES_SUMMARY.md
│   └── ... (11 more files)
├── monitoring/
│   ├── grafana/
│   │   ├── dashboards/
│   │   │   ├── code-complexity.json
│   │   │   └── tcad-overview.json
│   │   └── provisioning/
│   │       ├── dashboards/
│   │       └── datasources/
│   ├── prometheus/
│   │   ├── prometheus.rules.yml
│   │   └── prometheus.yml
│   └── README.md
├── public/
│   ├── CNAME
│   └── favicon.svg
├── scripts/
│   └── setup-branch-protection.sh
├── server/
│   ├── .github/
│   │   ├── workflows/
│   │   ├── changelog-config.json
│   │   └── dependabot.yml
│   ├── data/
│   │   ├── high-performing-terms.json
│   │   ├── search-term-map.json
│   │   ├── search-term-results.csv
│   │   ├── zero-result-analysis.json
│   │   └── zero-result-terms.json
│   ├── docs/
│   │   ├── TEST-COVERAGE-SESSION-2025-11-08.md
│   │   ├── TEST-DATABASE-SETUP.md
│   │   └── TEST-SEPARATION-STRATEGY.md
│   ├── fallbackBrowserSearch/
│   │   ├── scraper-with-db.ts
│   │   ├── tcad-scraper.cjs
│   │   ├── test-manual-search.ts
│   │   └── test-search-types.ts
│   ├── one-off-enqueues/
│   │   ├── add-business-batch-3.ts
│   │   ├── add-business-terms.ts
│   │   └── add-terms-and-dedupe.ts
│   ├── .env.example
│   ├── .eslintrc.json
│   ├── BATCH_UPSERT_OPTIMIZATION.md
│   ├── Dockerfile
│   ├── ENQUEUE_SCRIPTS_README.md
│   └── ... (4 more directories, 20 more files)
├── shared/
│   └── types/
│       ├── SCHEMA-DOCUMENTATION.md
│       ├── index.ts
│       ├── json-ld.utils.ts
│       └── property.types.ts
├── src/
│   ├── components/
│   │   ├── features/
│   │   │   └── PropertySearch/
│   │   │       ├── ExampleQueries.tsx
│   │   │       ├── PropertyCard.tsx
│   │   │       ├── PropertySearchContainer.tsx
│   │   │       ├── SearchBox.tsx
│   │   │       ├── SearchResults.tsx
│   │   │       └── index.ts
│   │   ├── ui/
│   │   │   ├── Badge/
│   │   │   ├── Button/
│   │   │   ├── Card/
│   │   │   ├── Icon/
│   │   │   ├── Input/
│   │   │   └── index.ts
│   │   ├── Analytics.css
│   │   ├── Analytics.tsx
│   │   ├── Charts.css
│   │   ├── Charts.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── Filters.css
│   │   ├── Filters.tsx
│   │   ├── PropertySearch.css
│   │   ├── PropertySearch.tsx
│   │   ├── PropertyTable.css
│   │   ├── PropertyTable.tsx
│   │   ├── README.md
│   │   ├── ScrapeManager.css
│   │   └── ScrapeManager.tsx
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useAnalytics.ts
│   │   ├── useDebounce.ts
│   │   ├── useFormatting.ts
│   │   ├── usePagination.ts
│   │   └── usePropertySearch.ts
│   ├── lib/
│   │   ├── __tests__/
│   │   ├── analytics.ts
│   │   ├── api-config.ts
│   │   ├── logger.ts
│   │   └── xcontroller.client.ts
│   ├── services/
│   │   ├── README.md
│   │   └── api.service.ts
│   ├── types/
│   │   ├── README.md
│   │   └── index.ts
│   ├── utils/
│   │   ├── constants.ts
│   │   ├── formatters.ts
│   │   ├── helpers.ts
│   │   └── index.ts
│   ├── App.css
│   ├── App.tsx
│   ├── README.md
│   ├── database.ts
│   ├── main.tsx
│   ├── query-db.ts
│   ├── test-api-direct.ts
│   └── vite-env.d.ts
├── .env.example
├── .env.monitoring.example
├── .eslintrc.json
├── .gitattributes
├── .gitignore
├── .mcp.json
├── .repomixignore
├── ANALYSIS_SUMMARY.md
├── ARCHITECTURE.md
├── CNAME
├── Dockerfile
├── MONITORING_DEPLOYMENT.md
├── MONITORING_SETUP_SUMMARY.md
├── QUICK_START_MONITORING.md
├── README.md
├── SESSION_CONTEXT.md
├── batch-migrate-client.py
├── bullmq-dashboard.json
├── docker-compose.monitoring.yml
├── docker-compose.override.yml
├── docker-compose.yml
├── index.html
├── index.js
├── jest.client.config.js
├── jest.config.cjs
├── jest.setup.js
├── monitor-queue.sh
├── package-lock.json
├── package.json
├── refresh-tcad-token.sh
├── refresh-token.js
├── repomix-output.xml
├── repomix.config.json
├── search-terms-summary.sh
├── setup-tcad.sh
├── start.sh
├── tcad-cli.cjs
├── tcad.package
├── test-database.ts
├── tsconfig.app.json
├── tsconfig.json
├── view-queue-logs.sh
└── vite.config.ts
```

---

## 3. Technical Implementation Details

### Backend Server (`server/src/index.ts` and related)
- Express.js server with layered middleware:
  - Security (Helmet, CSP via XController pattern)
  - Authentication (API key, JWT)
  - Metrics collection (Prometheus)
  - Error handling
- Routes organized under `server/src/routes/`:
  - `property.routes.ts` handles property-related API endpoints.
  - `app.routes.ts` serves frontend and SPA fallback.
- Background job processing with BullMQ queues (`server/src/queues/scraper.queue.ts`).
- Scheduled jobs via `node-cron` in `server/src/schedulers/scrape-scheduler.ts`.
- Token refresh automation via `server/src/services/token-refresh.service.ts`.
- Database access via Prisma ORM (`server/src/lib/prisma.ts`).
- Fallback scraping via DOM with Playwright (`server/src/lib/fallback/dom-scraper.ts`).
- AI integration with Claude API (`server/src/lib/claude.service.ts`).

### Frontend (`src/`)
- React 18 with TypeScript.
- Feature-based component architecture under `src/components/features/PropertySearch/`.
- UI components under `src/components/ui/` (Button, Badge, Card, Icon, Input).
- Custom hooks for analytics, formatting, pagination, and property search (`src/hooks/`).
- Styling via CSS Modules.
- Analytics integration with Google Analytics 4 and Meta Pixel (`src/lib/analytics.ts`).
- API client abstraction in `src/services/api.service.ts`.
- Data models and validation schemas in `src/types/` and `shared/types/`.

### Queue & Job Management
- BullMQ queues with Redis backend.
- Job enqueueing scripts in `server/one-off-enqueues/` and `server/src/scripts/`.
- CLI tools for queue management and analysis under `server/scripts-archive/` and `server/src/cli/`.
- Deduplication and cleanup utilities in `server/src/utils/deduplication.ts`.

### Monitoring & Observability
- Prometheus metrics exposed via `/metrics`.
- Grafana dashboards configured under `monitoring/grafana/`.
- Health endpoints under `/health/*`.
- Logging with Pino and Winston.
- Sentry integration for error tracking.

---

## 4. Development Patterns and Standards

- **TypeScript Strict Typing:**  
  Strong use of interfaces and types for domain models, API contracts, and component props.
- **Test Stratification:**  
  Separate Jest configs for unit (`jest.config.js`) and integration tests (`jest.integration.config.js`).
- **Mocking & Isolation:**  
  Tests mock external dependencies (Redis, Prisma, Playwright) for deterministic behavior.
- **Middleware Pattern:**  
  Express middleware for auth, validation, error handling, and metrics.
- **Component-Based UI:**  
  React functional components with hooks and CSS Modules.
- **Command Pattern:**  
  CLI tools and scripts encapsulate discrete operational tasks.
- **Repository Pattern:**  
  Prisma ORM abstracts database access.
- **Service Pattern:**  
  Services encapsulate external API interactions and token management.
- **Scheduler Pattern:**  
  Cron jobs for periodic scraping and cleanup.
- **Security Best Practices:**  
  CSP headers, nonce generation, JWT and API key auth, XSS prevention.
- **Configuration Management:**  
  Environment variables managed via Doppler; `.env` files for local dev.
- **Error Handling:**  
  Centralized error middleware; Sentry for error reporting.
- **Logging:**  
  Structured logging with Pino and Winston.
- **Performance Optimization:**  
  Batch upsert in database; queue deduplication; caching with Redis.

---

## 5. Integration and Dependencies

### External Libraries & Services
- **Node.js ecosystem:** Express, BullMQ, Prisma, Playwright, Jest, Axios.
- **Redis:** For caching and queue backend.
- **PostgreSQL:** Primary data store.
- **Prometheus & Grafana:** Metrics and monitoring.
- **Sentry:** Error tracking.
- **Claude AI:** Natural language query parsing.
- **Doppler:** Secrets management.
- **Docker:** Containerization and orchestration.
- **GitHub Actions:** CI/CD pipelines.

### Internal Modules & Contracts
- Modular codebase with clear separation:
  - `lib/` for utilities and services.
  - `routes/` for API endpoints.
  - `queues/` for job management.
  - `schedulers/` for cron jobs.
  - `services/` for business logic.
  - `components/` and `hooks/` for frontend UI.
- Shared types in `shared/types/` and `src/types/`.
- API contracts defined via TypeScript interfaces and Zod schemas.

---

## 6. Usage and Operational Guidance

### Setup & Deployment
- Use `Dockerfile` and `docker-compose.yml` for containerized deployment.
- Secrets managed via Doppler; `.env.example` provided for local dev.
- Run `setup-tcad.sh` and `start.sh` scripts for environment setup and service startup.
- Database migrations managed via Prisma CLI (`npx prisma migrate`).
- Redis and PostgreSQL must be running and accessible.

### Running the Server
- Start backend server with `npm run dev` or `npm start` inside `server/`.
- Frontend served via Vite (`npm run dev` in root or `src/`).
- API available under `/api/` routes.
- Health endpoints under `/health/*` for monitoring.

### Queue Management
- Use CLI scripts under `server/src/cli/` or `server/one-off-enqueues/` to enqueue scraping jobs.
- Monitor queues via Bull Board dashboard and Prometheus/Grafana.
- Deduplicate and clean queues with provided utilities (`deduplication.ts`).

### Testing
- Run unit tests with `npm run test` (unit) and `npm run test:integration` (integration).
- Tests located under `server/src/__tests__`, `server/src/lib/__tests__`, and frontend test files.
- Coverage reports generated separately for unit and integration tests.

### Monitoring & Logging
- Metrics exposed at `/metrics` for Prometheus scraping.
- Grafana dashboards configured for system health, queue status, and code complexity.
- Logs managed via Pino and Winston; Sentry captures errors.
- Use `monitor-queue.sh` and `view-queue-logs.sh` for operational log inspection.

### Security & Configuration
- API key and JWT authentication enforced.
- CSP headers and nonce middleware protect against XSS.
- Environment variables control feature flags and secrets.
- Token refresh service automates API token lifecycle.

---

## Actionable Insights for Developers and AI Agents

- **To understand data flow:**  
  Follow the scraping job lifecycle from enqueueing (`server/src/queues/scraper.queue.ts`), processing (worker scripts), to data persistence (`server/src/lib/prisma.ts`).

- **To extend scraping:**  
  Modify or add scraping logic in `server/src/lib/tcad-scraper.ts` and fallback in `server/src/lib/fallback/dom-scraper.ts`.

- **To add API endpoints:**  
  Define routes in `server/src/routes/`, implement controllers in `server/src/controllers/`, and validate inputs with middleware.

- **To debug or monitor:**  
  Use Prometheus metrics, Grafana dashboards, and Bull Board UI. Logs are structured and centralized.

- **To run tests:**  
  Use Jest configs for unit and integration tests. Mock external dependencies for isolated testing.

- **To manage secrets:**  
  Use Doppler CLI and environment variables; avoid hardcoding secrets.

- **To deploy:**  
  Use Docker and docker-compose with provided configs. Ensure environment variables and secrets are set.

- **To maintain code quality:**  
  Follow ESLint rules, use provided code complexity metrics, and adhere to documented coding standards.

---

# End of DETAILS.md for tcad-scraper