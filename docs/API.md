# API Reference

REST API for the TCAD Scraper backend. Base URL: `http://localhost:3000` (dev) / `https://api.alephatx.info` (prod).

## Authentication

| Method | Header | Use Case |
|--------|--------|----------|
| JWT | `Authorization: Bearer <token>` | Production API access |
| API Key | `X-API-Key: <key>` | Service-to-service |
| None | -- | Development (`NODE_ENV=development`) |

---

## Core Endpoints

### Health Check

| | |
|-|-|
| `GET /health` | Returns `{ status: "healthy", timestamp }` |

### Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET /api/properties` | Query properties with filters (cached 5 min) |
| `GET /api/properties/stats` | Aggregate statistics (cached 10 min) |

**GET /api/properties** query params:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `city` | string | -- | Filter by city |
| `propType` | string | -- | Filter by property type |
| `minValue` | number | -- | Minimum appraised value |
| `maxValue` | number | -- | Maximum appraised value |
| `searchTerm` | string | -- | Filter by original search term |
| `limit` | integer | 20 | Results per page (1-1000) |
| `offset` | integer | 0 | Results to skip |

Response: `{ data: Property[], pagination: { total, limit, offset, hasMore } }`

**GET /api/properties/stats** response: `{ totalProperties, totalJobs, jobsByStatus, propertiesByCity, propertiesByType, averageValue }`

---

### Scraping

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST /api/properties/scrape` | Queue a new scrape job |
| `GET /api/properties/jobs/:jobId` | Get job status |
| `GET /api/properties/history` | Paginated job history |

**POST /api/properties/scrape** body:

```json
{ "searchTerm": "Smith", "userId": "optional", "scheduled": false }
```

Response (202): `{ jobId: "12345", message: "Scrape job queued successfully" }`

**GET /api/properties/history** query params: `limit` (1-100, default 20), `offset`, `status` (pending|processing|completed|failed)

---

### Natural Language Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST /api/properties/search` | Claude AI-powered property search |
| `GET /api/properties/search/test` | Test Claude AI connectivity |

**POST /api/properties/search** body:

```json
{ "query": "Find all residential properties in Austin worth more than $500k", "limit": 20 }
```

Response: `{ data: Property[], query, parsedFilters }`

---

### Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST /api/properties/monitor` | Add a search term to scheduled monitoring |
| `GET /api/properties/monitor` | List all monitored search terms |

**POST /api/properties/monitor** body:

```json
{ "searchTerm": "Smith", "schedule": "0 0 * * *", "enabled": true }
```

---

### API Usage (Claude AI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET /api/usage/stats` | Claude API usage statistics and costs |
| `GET /api/usage/logs` | Paginated API call logs |
| `GET /api/usage/alerts` | Cost/usage threshold alerts |

**GET /api/usage/stats** query params: `days` (1-90, default 7), `environment` (development|production|staging)

**GET /api/usage/logs** query params: `limit` (1-1000, default 50), `offset`, `environment`, `success` (boolean)

**GET /api/usage/alerts** response: `{ alerts: [{ level, message }], costs: { today, month }, failures, thresholds }`

---

### Admin

| | |
|-|-|
| `GET /admin/queues` | Bull Board dashboard (BullMQ queue management UI) |

---

## Validation

All request bodies and query params are validated with Zod schemas. Invalid requests return 400 with structured error messages.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/routes/property.routes.ts` | Property, scraping, search, monitoring endpoints |
| `server/src/routes/app.routes.ts` | Frontend serving, health check |
| `server/src/routes/api-usage.routes.ts` | Claude API usage tracking |
| `server/src/controllers/property.controller.ts` | Route handler implementations |
| `server/src/controllers/api-usage.controller.ts` | Usage tracking handlers |
| `server/src/middleware/validation.middleware.ts` | Zod validation middleware |
