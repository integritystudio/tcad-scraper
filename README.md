# TCAD Scraper

A modern, full-stack web scraping and data analytics platform for extracting property tax information from the Travis Central Appraisal District (TCAD) website. Built with TypeScript, React, Express, and PostgreSQL with a distributed queue-based architecture for scalable data collection.

## Overview

TCAD Scraper is a production-ready application that automates the collection and analysis of property tax data. It features a React-based frontend for data exploration, an Express backend API, background job processing with BullMQ, and comprehensive monitoring via Prometheus and Grafana.

## Key Features

- **Full-Stack Architecture**: Modern React frontend with Express.js REST API backend
- **Background Job Processing**: BullMQ queue system with Redis for scalable scraping operations
- **Persistent Storage**: PostgreSQL database with Prisma ORM for type-safe data access
- **Real-Time Monitoring**: Prometheus metrics collection with Grafana dashboards
- **Scheduled Scraping**: Automated recurring scrapes via node-cron
- **Comprehensive Data Extraction**:
  - Owner name
  - Property type
  - City and property address
  - Assessed and appraised values
  - Property ID and Geographic ID
  - Legal descriptions
- **Web Scraping Technologies**: Puppeteer and Playwright for headless browser automation
- **API-Driven**: RESTful API with rate limiting, security middleware, and health checks
- **Containerized Deployment**: Docker Compose orchestration for all services

## Technology Stack

### Frontend
- React 19.2.0 with TypeScript
- Vite 7.1.11 for fast builds
- Custom components for tables, charts, and analytics

### Backend
- Node.js with Express.js 4.18.2
- TypeScript 5.3.3
- Prisma 5.8.0 ORM
- BullMQ 5.62.0 for job queues
- Puppeteer 24.27.0 & Playwright 1.41.0 for web scraping
- Cheerio 1.1.2 for HTML parsing

### Infrastructure
- PostgreSQL 15-alpine (primary database)
- Redis 7-alpine (message broker)
- Prometheus (metrics collection)
- Grafana (visualization)
- Docker & Docker Compose

### Security & Utilities
- Helmet 7.1.0 (HTTP security headers)
- express-rate-limit 7.1.5
- Zod 3.22.0 (validation)
- Winston 3.11.0 (logging)

## Project Structure

```
tcad-scraper/
├── src/                          # Frontend React application
│   ├── components/               # UI components
│   │   ├── PropertyTable.tsx     # Property data display
│   │   ├── Analytics.tsx         # Analytics dashboard
│   │   ├── ScrapeManager.tsx     # Job management UI
│   │   ├── Filters.tsx           # Property filtering
│   │   └── Charts.tsx            # Data visualization
│   ├── services/
│   │   └── api.service.ts        # API communication
│   ├── types/                    # TypeScript definitions
│   ├── App.tsx                   # Main React component
│   └── main.tsx                  # React entry point
├── server/                       # Express backend
│   ├── src/
│   │   ├── index.ts              # Express server setup
│   │   ├── routes/
│   │   │   └── property.routes.ts # API endpoints
│   │   ├── queues/
│   │   │   └── scraper.queue.ts  # BullMQ configuration
│   │   ├── schedulers/
│   │   │   └── scrape-scheduler.ts # Cron jobs
│   │   ├── lib/
│   │   │   ├── tcad-scraper.ts   # Scraper implementation
│   │   │   └── prisma.ts         # Prisma client
│   │   └── types/                # Type definitions
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   ├── package.json
│   └── tsconfig.json
├── bullmq-exporter/              # Metrics exporter for Bull queues
├── grafana/                      # Monitoring dashboards
│   └── provisioning/             # Pre-configured dashboards
├── docs/                         # Project documentation
│   ├── MODERNIZATION_REPORT.md
│   ├── SCRAPER_DEBUG_SESSION.md
│   └── CLAUDE.md
├── scraper.ts                    # Standalone scraper (legacy)
├── scraper2.ts                   # Alternative implementation
├── scraper-with-db.ts            # Scraper with direct DB integration
├── test-database.ts              # Database testing utilities
├── docker-compose.yml            # Service orchestration
├── docker-compose.override.yml   # Development overrides
├── Dockerfile                    # Container image
├── DATABASE.md                   # Database setup guide
├── MODERNIZATION_SETUP.md        # Architecture documentation
└── prometheus.yml                # Prometheus configuration
```

## Database Schema

The application uses PostgreSQL with three main models:

### Property
- **propertyId**: Unique TCAD identifier
- **name**: Owner name
- **propType**: Property type
- **city**: City location
- **propertyAddress**: Full address
- **assessedValue**: Tax assessed value
- **appraisedValue**: Appraised value
- **geoId**: Geographic identifier
- **description**: Legal description
- **searchTerm**: Search query that found this property
- **scrapedAt**: Timestamp of data collection

### ScrapeJob
Tracks scraping operations with status, results count, and error information.

### MonitoredSearch
Enables automated recurring scrapes with configurable frequency (daily/weekly/monthly).

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tcad-scraper
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd server
npm install
cd ..
```

4. Set up environment variables:
```bash
cp server/.env.example server/.env
# Edit server/.env with your database credentials
```

5. Start infrastructure services:
```bash
docker-compose up -d
```

6. Run database migrations:
```bash
cd server
npm run prisma:migrate
npm run prisma:generate
cd ..
```

### Development

**Start the frontend (Vite dev server):**
```bash
npm run dev
```

**Start the backend server:**
```bash
cd server
npm run dev
```

**Run standalone scraper:**
```bash
npm run scrape
```

**Run scraper with database storage:**
```bash
npm run scrape:db
```

**Query database:**
```bash
npm run db:query
```

**View database statistics:**
```bash
npm run db:stats
```

### Production Build

**Build frontend:**
```bash
npm run build
```

**Build backend:**
```bash
cd server
npm run build
npm run start
```

## API Endpoints

### Health & Monitoring
- `GET /health` - Server health check
- `GET /health/queue` - Queue status check
- `GET /admin/queues` - Bull Board dashboard (queue visualization)

### Properties API
- `GET /api/properties` - List all properties with pagination and filtering
- `GET /api/properties/:id` - Get property by ID
- `POST /api/properties/scrape` - Trigger new scraping job
- `GET /api/properties/stats` - Get database statistics

### Rate Limits
- API endpoints: 100 requests per 15 minutes
- Scrape endpoints: 5 requests per minute

## Docker Services

The application uses Docker Compose with the following services:

**Primary Services (docker-compose.yml):**
- **Redis** (port 6379) - Message broker for BullMQ
- **Prometheus** (port 9090) - Metrics collection
- **Grafana** (port 3001) - Visualization dashboards
- **BullMQ Exporter** (port 3000) - Custom metrics endpoint

**Development Services (docker-compose.override.yml):**
- **PostgreSQL** (port 5432) - Property database
- **TCAD Worker** - Containerized scraper service

## Monitoring & Observability

Access monitoring tools:
- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090
- **Bull Board**: http://localhost:3000/admin/queues
- **Metrics Endpoint**: http://localhost:3000/metrics

## Project Scripts

### Frontend
```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run scrape       # Run standalone scraper
npm run scrape:db    # Run scraper with DB storage
npm run db:query     # Execute database queries
npm run db:stats     # Show database statistics
```

### Backend (in /server directory)
```bash
npm run dev              # Start dev server (watch mode)
npm run build            # Compile TypeScript
npm run start            # Run compiled server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio GUI
```

## Architecture

### Core Workflow

1. **Frontend UI** allows users to manage scraping jobs and view property data
2. **Backend API** receives requests and validates input with Zod schemas
3. **Queue System** (BullMQ + Redis) manages background scraping jobs
4. **Scraper Service** uses Puppeteer/Playwright to:
   - Navigate TCAD website
   - Perform property searches
   - Parse HTML with Cheerio
   - Extract comprehensive property details
5. **Database** persists results via Prisma ORM
6. **Monitoring Stack** tracks performance with Prometheus/Grafana
7. **Scheduled Tasks** automatically run recurring scrapes

### Security Features

- Helmet.js for secure HTTP headers
- CORS configuration
- Rate limiting on all API endpoints
- Input validation with Zod
- Error handling middleware
- Winston logging for audit trails

## Documentation

Additional documentation is available in the following files:

- **DATABASE.md** - Database setup and configuration guide
- **MODERNIZATION_SETUP.md** - Architecture migration documentation
- **docs/MODERNIZATION_REPORT.md** - Detailed modernization report
- **docs/SCRAPER_DEBUG_SESSION.md** - Debugging and troubleshooting guide
- **docs/CLAUDE.md** - Claude AI integration notes

## Legacy Files

The following files contain earlier scraper implementations:
- `scraper.ts` - Original Puppeteer implementation for TCAD staging
- `scraper2.ts` - Alternative experimental implementation
- `scraper-with-db.ts` - Standalone scraper with PostgreSQL integration
- `test-database.ts` - Database connectivity testing

These are maintained for reference and fallback purposes.

## Contributing

This project uses:
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting (if configured)
- Conventional Commits for commit messages

## Recent Updates

- Migrated to remote Linux environment
- Added comprehensive database utilities and documentation
- Implemented modern web scraping architecture with backend API
- Integrated queue system for background processing
- Removed Supabase dependency in favor of self-managed PostgreSQL
- Added Prometheus/Grafana monitoring stack

## License

[Your License Here]

## Contact

[Your Contact Information]
