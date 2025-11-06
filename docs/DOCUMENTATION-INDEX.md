# TCAD Scraper Documentation Index

## Newly Generated Comprehensive Documentation

### 1. [CODEBASE_OVERVIEW.md](./CODEBASE_OVERVIEW.md) - PRIMARY TECHNICAL REFERENCE
**Size:** 28KB | **Sections:** 22 | **Lines:** 1,068

Complete technical breakdown of the entire system. Start here for deep understanding.

**Contents:**
- Project structure (frontend, backend, server)
- Key entry points and scripts
- Complete API endpoint documentation (10+ endpoints)
- Core scraping functionality (dual-method design)
- Job queue system (BullMQ + Redis)
- Database schema (Property, ScrapeJob, MonitoredSearch tables)
- Centralized configuration system (12 sections)
- External integrations (Claude AI, Doppler, Playwright, Redis, Prometheus)
- Environment variables (all categories)
- Middleware stack (security, auth, validation)
- Scheduled jobs (daily, weekly, monthly cron)
- Key dependencies (complete list)
- Frontend components (6 main components)
- TypeScript types (core, property-specific, frontend)
- Testing setup (Jest, Supertest)
- Build & deployment (dev, production)
- Security considerations (auth, rate limiting, CORS, CSP, validation)
- Monitoring & observability (health checks, logging, metrics)
- Known limitations
- Documentation files
- Quick start commands
- Architecture strengths

**Best For:** Technical deep dives, API implementation, troubleshooting, architecture review

---

### 2. [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) - VISUAL QUICK REFERENCE
**Size:** 16KB | **Sections:** 11 | **Lines:** 388

Visual architecture diagrams and quick reference tables. Start here for understanding the big picture.

**Contents:**
- System architecture diagram (ASCII visual)
- Data flow diagrams (3 main flows)
- Core components breakdown (5 backend services)
- Configuration system overview
- Security architecture diagram
- Performance characteristics table
- Deployment architecture (dev vs production)
- File location reference table
- Environment variable categories
- API rate limiting diagram
- Monitoring & observability summary
- Technology stack table
- Development workflow
- Quick start checklist

**Best For:** New developers, architecture presentations, quick lookups, deployment planning

---

## Existing Comprehensive Documentation

### 3. [README.md](../README.md) - PROJECT OVERVIEW
**Size:** 34KB | Main project introduction and overview

**Covers:**
- Project features
- Technology stack
- Architecture diagrams
- Project structure
- Database schema
- Setup instructions
- API endpoints
- Running instructions
- Docker services
- Known issues

**Best For:** Project introduction, feature overview, general setup

---

### 4. [CURRENT-STATE.md](./CURRENT-STATE.md) - PROJECT STATUS
Recent project state, progress, and current configuration

**Best For:** Understanding current implementation status, recent changes

---

### 5. [INTEGRATION-SUMMARY.md](./INTEGRATION-SUMMARY.md) - SYSTEM INTEGRATION DETAILS
Overview of how components integrate together

**Best For:** Understanding component relationships, data flow between systems

---

### 6. [CLAUDE_SEARCH.md](./CLAUDE_SEARCH.md) - AI SEARCH FEATURE
Documentation for Claude AI natural language search implementation

**Best For:** Understanding NL search feature, Claude API integration, query parsing

---

### 7. [DATABASE.md](./DATABASE.md) - DATABASE SCHEMA DETAILS
Detailed database schema, relationships, and design

**Best For:** Database design understanding, schema modifications, migrations

---

### 8. [XCONTROLLER-MIGRATION.md](./XCONTROLLER-MIGRATION.md) - SECURITY MIGRATION
Details of xcontroller middleware and security improvements

**Best For:** Understanding security architecture, CSP implementation, HTML serving

---

### 9. [TESTING.md](./TESTING.md) - TESTING GUIDE
Testing setup, test commands, and testing strategies

**Best For:** Writing tests, understanding test structure, running test suite

---

## Documentation Reading Paths

### For New Developers
```
1. Start: ARCHITECTURE_SUMMARY.md (15 min)
   └─ Get visual understanding of system

2. Read: CODEBASE_OVERVIEW.md sections 1-5 (30 min)
   └─ Understand structure, entry points, API basics

3. Explore: /server/src/index.ts (15 min)
   └─ See actual code entry point

4. Study: CODEBASE_OVERVIEW.md sections 6-9 (30 min)
   └─ Understand database, config, integrations

5. Deep Dive: Specific service code as needed
   └─ Use CODEBASE_OVERVIEW.md as reference

Total Time: ~90 minutes for comprehensive overview
```

### For API Integration
```
1. Quick Read: ARCHITECTURE_SUMMARY.md (10 min)
   └─ Understand system overview

2. Reference: CODEBASE_OVERVIEW.md section 3 (15 min)
   └─ All API endpoints documented

3. Example: CODEBASE_OVERVIEW.md section 13 (10 min)
   └─ Frontend API service example

4. Test: Start server and test health endpoint
   └─ GET http://localhost:5050/health

5. Integrate: Build against documented endpoints
   └─ Use API service types as guide

Total Time: ~45 minutes to basic integration
```

### For Infrastructure/DevOps
```
1. Start: ARCHITECTURE_SUMMARY.md (deployment section) (15 min)
   └─ Understand deployment architecture

2. Configure: CODEBASE_OVERVIEW.md section 7 (environment variables) (20 min)
   └─ All configuration options explained

3. Setup: CODEBASE_OVERVIEW.md section 8 (environment variables) (20 min)
   └─ All required variables with defaults

4. Database: CODEBASE_OVERVIEW.md section 6 (database schema) (15 min)
   └─ Schema details and relationships

5. Monitoring: ARCHITECTURE_SUMMARY.md (monitoring section) (10 min)
   └─ Health checks and observability

6. Docker: docker-compose.yml review
   └─ Services and networking

Total Time: ~90 minutes for complete setup understanding
```

### For Database/Backend Development
```
1. Schema: DATABASE.md + CODEBASE_OVERVIEW.md section 6 (30 min)
   └─ Complete database understanding

2. ORM: CODEBASE_OVERVIEW.md section 6 (10 min)
   └─ Prisma ORM usage patterns

3. Services: CODEBASE_OVERVIEW.md section 4 (20 min)
   └─ Core scraping functionality

4. Queue: CODEBASE_OVERVIEW.md section 5 (15 min)
   └─ Job queue system

5. Code: /server/src/lib/tcad-scraper.ts and related files
   └─ Actual implementation

Total Time: ~75 minutes for database/backend foundation
```

---

## Quick Reference Tables

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/properties/scrape` | Trigger scrape job |
| GET | `/api/properties/jobs/:jobId` | Get job status |
| GET | `/api/properties` | Query properties |
| POST | `/api/properties/search` | Claude NL search |
| GET | `/api/properties/stats` | Analytics |
| GET | `/admin/queues` | Queue dashboard |
| GET | `/health` | Server health |
| GET | `/health/queue` | Queue health |

### Technology Stack
| Layer | Tech | Version |
|-------|------|---------|
| Frontend | React | 19.2 |
| Build | Vite | 7.1 |
| Backend | Express | 4.18 |
| Scraper | Playwright | 1.56 |
| Database | PostgreSQL | 15+ |
| Queue | BullMQ | 5.62 |
| Queue Backend | Redis | 7 |
| ORM | Prisma | 5.8 |
| AI | Claude (Anthropic) | 3-haiku |
| Language | TypeScript | 5.3+ |

### Key Directories
| Directory | Purpose |
|-----------|---------|
| `/server/src/` | Backend source code |
| `/server/src/lib/` | Core services (scraper, claude, prisma) |
| `/server/src/routes/` | API route definitions |
| `/server/src/controllers/` | Business logic |
| `/server/src/queues/` | Queue configuration |
| `/server/src/config/` | Centralized configuration |
| `/src/` | React frontend source |
| `/src/components/` | React components |
| `/src/services/` | Frontend API service |
| `/server/prisma/` | Database schema and migrations |
| `/docs/` | Documentation files |

---

## Environment Variables Quick Reference

### Essential (Development)
```
DATABASE_URL=postgresql://localhost:5432/tcad_scraper
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
PORT=3001
```

### Scraper Configuration
```
TCAD_API_KEY=<bearer-token>  # Optional, auto-captured if not set
SCRAPER_HEADLESS=true
SCRAPER_TIMEOUT=30000
```

### Claude AI
```
ANTHROPIC_API_KEY=<your-key>
CLAUDE_MODEL=claude-3-haiku-20240307
```

### Security
```
JWT_SECRET=<your-secret>
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://alephatx.info
```

See CODEBASE_OVERVIEW.md section 9 for all variables.

---

## Common Tasks & Documentation Mappings

| Task | Primary Doc | Section |
|------|-------------|---------|
| Add new API endpoint | CODEBASE_OVERVIEW.md | 3 (API Routes) |
| Modify scraper | CODEBASE_OVERVIEW.md | 4 (Core Scraping) |
| Query database | CODEBASE_OVERVIEW.md | 6 (Database) |
| Change configuration | CODEBASE_OVERVIEW.md | 7 (Configuration) |
| Set environment | CODEBASE_OVERVIEW.md | 9 (Environment) |
| Add security | CODEBASE_OVERVIEW.md | 17 (Security) |
| Monitor system | ARCHITECTURE_SUMMARY.md | Monitoring section |
| Deploy to production | ARCHITECTURE_SUMMARY.md | Deployment section |
| Write tests | TESTING.md | - |
| Setup development | ARCHITECTURE_SUMMARY.md | Development Workflow |

---

## Feedback & Updates

These documentation files were generated on **November 5, 2025**.

To keep documentation current:
1. Update CODEBASE_OVERVIEW.md when adding/removing major features
2. Update ARCHITECTURE_SUMMARY.md when changing deployment architecture
3. Reference existing files (README.md, CURRENT-STATE.md) for project status
4. Add new specific documentation for new major features

---

## Document Statistics

| Document | Size | Sections | Best For |
|----------|------|----------|----------|
| CODEBASE_OVERVIEW.md | 28KB | 22 | Technical depth |
| ARCHITECTURE_SUMMARY.md | 16KB | 11 | Quick reference |
| README.md | 34KB | Multiple | Project overview |
| CURRENT-STATE.md | Varies | Varies | Current status |
| INTEGRATION-SUMMARY.md | Varies | Varies | Component integration |
| CLAUDE_SEARCH.md | Varies | Varies | AI feature |
| DATABASE.md | Varies | Varies | Schema details |
| XCONTROLLER-MIGRATION.md | Varies | Varies | Security |
| TESTING.md | Varies | Varies | Testing guide |

---

**Last Updated:** November 5, 2025
**Status:** Complete and current
**Next Review:** As code changes are made
