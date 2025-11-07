# TCAD Scraper API Documentation

Production-ready REST API for scraping and querying Travis Central Appraisal District (TCAD) property data.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.production.example.com`

## Interactive Documentation

Swagger/OpenAPI documentation is available at `/api-docs` for interactive testing and detailed schemas.

## Authentication

Most endpoints support **optional authentication** via:

- **API Key**: Include `X-API-Key` header
- **JWT Token**: Include `Authorization: Bearer <token>` header

In development mode, authentication can be skipped.

## Rate Limiting

- **API endpoints**: 100 requests per 15 minutes
- **Scraping endpoints**: 5 requests per minute

## Caching

- **Property queries**: Cached for 5 minutes
- **Statistics**: Cached for 10 minutes
- Cache is automatically invalidated when new properties are scraped

---

## Table of Contents

- [Health Check Endpoints](#health-check-endpoints)
- [Scraping Endpoints](#scraping-endpoints)
- [Property Query Endpoints](#property-query-endpoints)
- [Search Endpoints](#search-endpoints)
- [Statistics & Analytics](#statistics--analytics)
- [Monitoring Endpoints](#monitoring-endpoints)
- [Dashboard](#dashboard)
- [Error Handling](#error-handling)

---

## Health Check Endpoints

### GET /health

Basic server health check.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2025-01-07T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

---

### GET /health/queue

BullMQ job queue health status.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "queue": {
    "name": "scraper-queue",
    "waiting": 5,
    "active": 2,
    "completed": 1234,
    "failed": 10
  }
}
```

**Response** (500 Internal Server Error):
```json
{
  "status": "unhealthy",
  "error": "Failed to get queue status"
}
```

---

### GET /health/token

TCAD authentication token health status.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "tokenRefresh": {
    "healthy": true,
    "hasToken": true,
    "lastRefresh": "2025-01-07T00:00:00.000Z",
    "totalRefreshes": 42,
    "failedRefreshes": 1,
    "successRate": "97.62%"
  }
}
```

---

### GET /health/cache

Redis cache health status.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "cache": {
    "connected": true,
    "isConnected": true,
    "hits": 1234,
    "misses": 567,
    "hitRate": "68.50%"
  }
}
```

---

### GET /health/sentry

Sentry error tracking health status.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "sentry": {
    "enabled": true,
    "dsn": "https://...@sentry.io/...",
    "environment": "production"
  }
}
```

---

## Scraping Endpoints

### POST /api/properties/scrape

Trigger a new web scraping job to collect property data for the given search term.

**Authentication**: Optional
**Rate Limit**: 5 requests/minute

**Request Body**:
```json
{
  "searchTerm": "Smith",
  "userId": "user-123",
  "scheduled": false
}
```

**Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| searchTerm | string | Yes | Search term to query TCAD website |
| userId | string | No | User ID for tracking purposes |
| scheduled | boolean | No | Whether this is a scheduled job (default: false) |

**Response** (202 Accepted):
```json
{
  "jobId": "12345",
  "message": "Scrape job queued successfully"
}
```

**Response** (429 Too Many Requests):
```json
{
  "error": "Rate limit exceeded. Please wait before scraping the same search term again."
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Validation error",
  "details": ["searchTerm is required"]
}
```

---

### GET /api/properties/jobs/:jobId

Get the status of a specific scrape job.

**Authentication**: Optional

**URL Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| jobId | string | Job ID returned from scrape endpoint |

**Response** (200 OK):
```json
{
  "id": "12345",
  "status": "completed",
  "progress": 100,
  "resultCount": 42,
  "error": null,
  "createdAt": "2025-01-07T00:00:00.000Z",
  "completedAt": "2025-01-07T00:05:00.000Z"
}
```

**Job Status Values**:
- `waiting` - Job is queued
- `active` - Job is currently processing
- `completed` - Job finished successfully
- `failed` - Job encountered an error
- `delayed` - Job is scheduled for later

**Response** (404 Not Found):
```json
{
  "error": "Job not found"
}
```

---

### GET /api/properties/history

Get scrape job history with pagination.

**Authentication**: Optional

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | integer | 20 | Number of results per page (max 1000) |
| offset | integer | 0 | Number of results to skip |

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "searchTerm": "Smith",
      "status": "completed",
      "resultCount": 42,
      "error": null,
      "startedAt": "2025-01-07T00:00:00.000Z",
      "completedAt": "2025-01-07T00:05:00.000Z"
    }
  ],
  "pagination": {
    "total": 1234,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Property Query Endpoints

### GET /api/properties

Query properties from the database with optional filters. Results are cached for 5 minutes per unique filter combination.

**Authentication**: Optional

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| city | string | - | Filter by city name |
| propType | string | - | Filter by property type |
| minValue | number | - | Minimum appraised value |
| maxValue | number | - | Maximum appraised value |
| searchTerm | string | - | Search in name, address, or original search term |
| limit | integer | 20 | Results per page (min: 1, max: 1000) |
| offset | integer | 0 | Results to skip |

**Example Request**:
```
GET /api/properties?city=Austin&minValue=100000&maxValue=500000&limit=50
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "propertyId": "12345678",
      "name": "SMITH JOHN & MARY",
      "propType": "Residential",
      "city": "Austin",
      "propertyAddress": "123 MAIN ST",
      "assessedValue": 250000,
      "appraisedValue": 300000,
      "geoId": "12345",
      "description": "LOT 1 BLOCK A",
      "searchTerm": "Smith",
      "scrapedAt": "2025-01-07T00:00:00.000Z",
      "createdAt": "2025-01-06T00:00:00.000Z",
      "updatedAt": "2025-01-07T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1234,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Search Endpoints

### POST /api/properties/search

AI-powered natural language search using Claude AI to parse queries into database filters.

**Authentication**: Optional

**Request Body**:
```json
{
  "query": "properties in Austin with value over 500k",
  "limit": 100,
  "offset": 0
}
```

**Parameters**:
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| query | string | Yes | - | Natural language search query |
| limit | integer | No | 100 | Results per page (max 1000) |
| offset | integer | No | 0 | Results to skip |

**Example Queries**:
- "properties in Austin"
- "residential properties with value over 500k"
- "commercial properties owned by Smith"
- "expensive properties in downtown Austin"

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "propertyId": "12345678",
      "name": "SMITH JOHN & MARY",
      "propType": "Residential",
      "city": "Austin",
      "propertyAddress": "123 MAIN ST",
      "appraisedValue": 550000,
      ...
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  },
  "query": {
    "original": "properties in Austin with value over 500k",
    "explanation": "Filtered by city='Austin' and appraisedValue >= 500000"
  }
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Query is required and must be a string"
}
```

---

### GET /api/properties/search/test

Test endpoint for Claude AI API connection.

**Authentication**: Optional

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Claude API connection successful",
  "testQuery": "properties in Austin",
  "result": {
    "whereClause": { "city": "Austin" },
    "orderBy": { "scrapedAt": "desc" },
    "explanation": "Filtered by city='Austin'"
  }
}
```

---

## Statistics & Analytics

### GET /api/properties/stats

Get aggregate statistics about properties and scrape jobs. Results are cached for 10 minutes.

**Authentication**: Optional

**Response** (200 OK):
```json
{
  "totalProperties": 12345,
  "totalJobs": 567,
  "recentJobs": 23,
  "cityDistribution": [
    {
      "city": "Austin",
      "_count": 8000
    },
    {
      "city": "Round Rock",
      "_count": 2000
    }
  ],
  "propertyTypeDistribution": [
    {
      "propType": "Residential",
      "_count": 10000,
      "_avg": {
        "appraisedValue": 350000
      }
    },
    {
      "propType": "Commercial",
      "_count": 2000,
      "_avg": {
        "appraisedValue": 750000
      }
    }
  ]
}
```

**Fields**:
- `totalProperties`: Total number of properties in database
- `totalJobs`: Total number of scrape jobs ever run
- `recentJobs`: Number of jobs run in last 24 hours
- `cityDistribution`: Top 10 cities by property count
- `propertyTypeDistribution`: Property types with counts and average values

---

## Monitoring Endpoints

### POST /api/properties/monitor

Add a search term to the monitored list for scheduled scraping.

**Authentication**: Optional

**Request Body**:
```json
{
  "searchTerm": "Smith",
  "frequency": "daily"
}
```

**Parameters**:
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| searchTerm | string | Yes | - | Search term to monitor |
| frequency | string | No | "daily" | Monitoring frequency |

**Frequency Values**:
- `hourly` - Check every hour
- `daily` - Check once per day
- `weekly` - Check once per week
- `monthly` - Check once per month

**Response** (200 OK):
```json
{
  "message": "Search term added to monitoring",
  "data": {
    "id": "uuid",
    "searchTerm": "Smith",
    "frequency": "daily",
    "active": true,
    "createdAt": "2025-01-07T00:00:00.000Z",
    "updatedAt": "2025-01-07T00:00:00.000Z"
  }
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Search term is required"
}
```

---

### GET /api/properties/monitor

Get all active monitored search terms.

**Authentication**: Optional

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "searchTerm": "Smith",
      "frequency": "daily",
      "active": true,
      "lastRun": "2025-01-07T00:00:00.000Z",
      "nextRun": "2025-01-08T00:00:00.000Z",
      "createdAt": "2025-01-06T00:00:00.000Z",
      "updatedAt": "2025-01-07T00:00:00.000Z"
    }
  ]
}
```

---

## Dashboard

### Bull Board Dashboard

Interactive dashboard for monitoring BullMQ job queue.

**URL**: `/admin/queues` (default)
**Note**: This endpoint is excluded from CSP restrictions for proper functionality.

**Features**:
- Real-time job monitoring
- Job status (waiting, active, completed, failed)
- Retry failed jobs
- View job data and results
- Clear completed jobs

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "message": "Detailed error message (development only)"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 202 | Accepted (job queued) |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

### Common Error Scenarios

**Validation Error** (400):
```json
{
  "error": "Validation error",
  "details": ["searchTerm is required", "limit must be between 1 and 1000"]
}
```

**CORS Error** (403):
```json
{
  "error": "Not allowed by CORS"
}
```

**Rate Limit** (429):
```json
{
  "error": "Too many requests. Please try again later."
}
```

---

## Data Models

### Property Schema

```typescript
{
  id: string;              // UUID
  propertyId: string;      // TCAD property ID
  name: string;            // Owner name
  propType: string;        // Property type
  city: string | null;     // City name
  propertyAddress: string; // Property address
  assessedValue: number | null;  // Assessed value (USD)
  appraisedValue: number;  // Appraised value (USD)
  geoId: string | null;    // Geographic ID
  description: string | null;  // Legal description
  searchTerm: string | null;   // Original search term
  scrapedAt: Date;        // Last scrape timestamp
  createdAt: Date;        // Created timestamp
  updatedAt: Date;        // Updated timestamp
}
```

### Scrape Job Schema

```typescript
{
  id: string;              // UUID
  searchTerm: string;      // Search term
  status: string;          // pending|processing|completed|failed
  resultCount: number | null;  // Number of properties found
  error: string | null;    // Error message if failed
  startedAt: Date;         // Job start time
  completedAt: Date | null;  // Job completion time
}
```

### Monitored Search Schema

```typescript
{
  id: string;              // UUID
  searchTerm: string;      // Search term
  frequency: string;       // hourly|daily|weekly|monthly
  active: boolean;         // Is monitoring active
  lastRun: Date | null;    // Last run timestamp
  nextRun: Date | null;    // Next scheduled run
  createdAt: Date;         // Created timestamp
  updatedAt: Date;         // Updated timestamp
}
```

---

## Examples

### Complete Workflow Example

1. **Trigger a scrape**:
```bash
curl -X POST http://localhost:3000/api/properties/scrape \
  -H "Content-Type: application/json" \
  -d '{"searchTerm": "Smith"}'
```

2. **Check job status**:
```bash
curl http://localhost:3000/api/properties/jobs/12345
```

3. **Query properties**:
```bash
curl http://localhost:3000/api/properties?searchTerm=Smith&limit=10
```

4. **Natural language search**:
```bash
curl -X POST http://localhost:3000/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "expensive residential properties in Austin"}'
```

5. **Get statistics**:
```bash
curl http://localhost:3000/api/properties/stats
```

---

## Configuration

Key configuration options (set via environment variables or Doppler):

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development|production)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `CLAUDE_API_KEY`: Claude AI API key
- `RATE_LIMIT_MAX`: API rate limit max requests
- `RATE_LIMIT_WINDOW_MS`: API rate limit window
- `SCRAPER_RATE_LIMIT_MAX`: Scraper rate limit max requests
- `SCRAPER_RATE_LIMIT_WINDOW_MS`: Scraper rate limit window

See `.env.example` for complete configuration options.

---

## Performance Notes

- **Caching**: Redis caching significantly improves response times for repeated queries
- **Read Replicas**: Uses separate read-only database connection for queries
- **Connection Pooling**: Configured for optimal database connection management
- **Rate Limiting**: Protects against abuse and ensures fair usage
- **Async Processing**: BullMQ handles background jobs for efficient scraping

---

## Security

- **Helmet**: HTTP security headers
- **CORS**: Configurable origin restrictions
- **CSP**: Content Security Policy with nonce-based script execution
- **Rate Limiting**: Per-endpoint rate limits
- **Input Validation**: Zod schema validation on all inputs
- **Error Tracking**: Sentry integration for production monitoring
- **Optional Auth**: API key and JWT token support

---

## Support

- **GitHub**: [tcad-scraper repository](https://github.com/aledlie/tcad-scraper)
- **Issues**: Report bugs via GitHub Issues
- **Documentation**: See `/docs` directory for additional guides

---

*Last Updated: 2025-01-07*
