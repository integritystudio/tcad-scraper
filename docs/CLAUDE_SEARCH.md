# Claude AI Natural Language Search

## Overview

The TCAD Scraper includes an AI-powered natural language search feature that allows users to query property data using plain English instead of structured query parameters. This feature uses Anthropic's Claude AI to parse natural language queries and convert them into Prisma database filters.

## How It Works

### Architecture

```
User Query → Claude API → Prisma Filters → Database → Results
     ↓
"properties in Austin worth over 500k"
     ↓
Claude parses and generates:
{
  "whereClause": {
    "city": "Austin",
    "appraisedValue": { "gte": 500000 }
  },
  "orderBy": { "appraisedValue": "desc" },
  "explanation": "Searching for properties in Austin with appraised value over $500,000"
}
     ↓
Database query executed → Results returned
```

### Components

1. **Claude Search Service** (`server/src/lib/claude.service.ts`)
   - Handles communication with Anthropic's Claude API
   - Converts natural language to Prisma query filters
   - Provides fallback to simple text search if Claude API fails
   - Uses Claude 3 Haiku model for fast, cost-effective parsing

2. **API Endpoints** (`server/src/routes/property.routes.ts`)
   - `POST /api/properties/search` - Natural language search endpoint
   - `GET /api/properties/search/test` - Test Claude API connection

## Configuration

### Environment Variables

Add the following to your Doppler secrets or `.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx...
```

The service uses the `ANTHROPIC_API_KEY` environment variable to authenticate with Claude's API.

### Supported Models

The service is currently configured to use **Claude 3 Haiku** (`claude-3-haiku-20240307`):
- Fast response times (< 1 second)
- Cost-effective for high-volume queries
- Sufficient intelligence for query parsing

If you have access to more powerful models, you can update the model in `claude.service.ts`:
```typescript
model: 'claude-3-5-sonnet-20241022', // or claude-3-opus-20240229
```

## API Endpoints

### Natural Language Search

**Endpoint**: `POST /api/properties/search`

**Request Body**:
```json
{
  "query": "residential properties worth over 500k",
  "limit": 100,
  "offset": 0
}
```

**Response**:
```json
{
  "data": [...],
  "pagination": {
    "total": 1234,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  },
  "query": {
    "original": "residential properties worth over 500k",
    "explanation": "Searching for residential properties with appraised value over $500,000, sorted by appraised value (highest first)"
  }
}
```

**Example Queries**:

```bash
# Find expensive properties in Austin
curl -X POST http://localhost:3001/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "properties in Austin worth over 1 million"}'

# Find commercial properties owned by Smith
curl -X POST http://localhost:3001/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "commercial properties owned by Smith"}'

# Find properties on Congress Avenue
curl -X POST http://localhost:3001/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "properties on Congress Ave"}'

# Find properties by value range
curl -X POST http://localhost:3001/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "find properties appraised between 300k and 600k"}'
```

### Test Claude API Connection

**Endpoint**: `GET /api/properties/search/test`

**Response** (Success):
```json
{
  "success": true,
  "message": "Claude API connection successful",
  "testQuery": "properties in Austin",
  "result": {
    "whereClause": {
      "city": {
        "contains": "Austin",
        "mode": "insensitive"
      }
    },
    "explanation": "Searching for properties located in Austin"
  }
}
```

**Response** (Failure):
```json
{
  "success": false,
  "message": "Claude API connection failed",
  "error": {
    "name": "AuthenticationError",
    "message": "invalid x-api-key",
    "stack": "..."
  }
}
```

**Example**:
```bash
curl http://localhost:3001/api/properties/search/test
```

## Supported Query Types

### Location-based Searches
- "properties in Austin"
- "homes in Round Rock"
- "properties on Congress Avenue"

### Value-based Searches
- "properties worth over 500k"
- "homes under $200,000"
- "properties appraised between 300k and 600k"

### Type-based Searches
- "residential properties"
- "commercial buildings"
- "industrial properties"

### Owner-based Searches
- "properties owned by Smith"
- "homes belonging to John Doe"

### Combined Searches
- "residential properties in Austin worth over 1M"
- "commercial properties on Congress Ave under 500k"
- "homes owned by Smith in Round Rock"

## Database Fields

Claude can generate filters for these Property model fields:

| Field | Type | Description | Example Queries |
|-------|------|-------------|-----------------|
| `name` | string | Owner name | "properties owned by Smith" |
| `propType` | string | Property type | "residential properties", "commercial buildings" |
| `city` | string | City location | "properties in Austin" |
| `propertyAddress` | string | Full address | "properties on Congress Ave" |
| `assessedValue` | number | Assessed value | "assessed over 500k" |
| `appraisedValue` | number | Appraised value | "worth over 1 million" |
| `geoId` | string | Geographic ID | "geo ID 123456" |
| `description` | string | Legal description | "properties with 'subdivision' in description" |
| `searchTerm` | string | Discovery term | "found using 'Smith'" |
| `scrapedAt` | datetime | Scrape timestamp | "scraped in the last week" |

## Error Handling

### Fallback Mechanism

If the Claude API fails (due to network issues, rate limits, or invalid API key), the service automatically falls back to a simple text search:

```typescript
{
  whereClause: {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { propertyAddress: { contains: query, mode: 'insensitive' } },
      { city: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ],
  },
  explanation: `Searching for "${query}" across property names, addresses, cities, and descriptions`,
}
```

This ensures the search endpoint **always works**, even when Claude is unavailable.

### Error Logging

Errors are logged with detailed information for debugging:

```typescript
logger.error('Error parsing natural language query with Claude:', {
  message: error.message,
  name: error.name,
  stack: error.stack,
});
```

Check logs at `server/logs/pm2-error.log` for Claude API errors.

## Testing

### Manual Testing

Test the Claude API connection:
```bash
curl http://localhost:3001/api/properties/search/test
```

Test natural language search:
```bash
curl -X POST http://localhost:3001/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "properties in Austin"}'
```

### Automated Tests

See `server/src/routes/__tests__/property.routes.test.ts` for comprehensive test coverage of:
- Claude API connection
- Natural language query parsing
- Fallback mechanism
- Error handling
- Various query types

Run tests:
```bash
cd server
npm test
```

## Troubleshooting

### Invalid API Key Error

**Error**:
```
401 authentication_error: invalid x-api-key
```

**Solution**:
1. Verify your API key in Doppler:
   ```bash
   doppler secrets get ANTHROPIC_API_KEY --project integrity-studio --config dev
   ```

2. Update the API key if needed:
   ```bash
   doppler secrets set ANTHROPIC_API_KEY="sk-ant-api03-xxxxx" --project integrity-studio --config dev
   ```

3. Restart the server:
   ```bash
   pm2 restart tcad-api
   ```

### Model Not Found Error

**Error**:
```
404 not_found_error: model: claude-3-5-sonnet-20241022
```

**Solution**:
Your API key doesn't have access to that model. Update `claude.service.ts` to use a model you have access to:

```typescript
// Check which models your key supports
// Common options:
// - claude-3-haiku-20240307 (fastest, cheapest)
// - claude-3-sonnet-20240229 (balanced)
// - claude-3-opus-20240229 (most capable)
// - claude-3-5-sonnet-20240620 (latest Sonnet)
```

### Slow Response Times

If Claude API responses are slow (>3 seconds):

1. **Switch to Haiku model** - Faster response times
2. **Implement caching** - Cache common queries
3. **Use async processing** - Queue complex queries

### Rate Limiting

If you hit Claude API rate limits:

1. **Implement request queuing** - BullMQ for search requests
2. **Add caching layer** - Redis cache for common queries
3. **Upgrade API tier** - Contact Anthropic for higher limits

## Cost Management

### Claude 3 Haiku Pricing (as of 2024)

- **Input**: $0.25 per million tokens (~$0.00025 per query)
- **Output**: $1.25 per million tokens (~$0.001 per query)

**Estimated costs**:
- 1,000 searches/day: ~$1.25/month
- 10,000 searches/day: ~$12.50/month
- 100,000 searches/day: ~$125/month

### Cost Optimization

1. **Use Haiku for simple queries** - 10x cheaper than Sonnet
2. **Cache frequent queries** - Reduce API calls
3. **Implement request batching** - Process multiple queries in one API call
4. **Use fallback first for simple queries** - Save API calls for complex queries

## Security

### API Key Storage

**Never** commit API keys to version control. Use:

1. **Doppler** (Recommended for production):
   ```bash
   doppler secrets set ANTHROPIC_API_KEY="sk-ant-xxxxx"
   ```

2. **Environment variables** (Development):
   ```bash
   # Add to ~/.env
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   ```

3. **Never** hardcode in source files

### Rate Limiting

The search endpoint inherits the global rate limiting from Express middleware. Consider adding endpoint-specific limits for production:

```typescript
// In property.routes.ts
import rateLimit from 'express-rate-limit';

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
});

router.post('/search', searchLimiter, async (req, res) => {
  // ...
});
```

## Future Enhancements

### Planned Features

1. **Query caching** - Redis cache for frequent queries
2. **Search history** - Save user search history
3. **Query suggestions** - Autocomplete based on Claude understanding
4. **Multi-language support** - Translate queries to English
5. **Advanced filters** - Date ranges, complex boolean logic
6. **Query analytics** - Track popular search patterns

### Potential Upgrades

1. **Upgrade to Claude 3.5 Sonnet** - Better understanding, more complex queries
2. **Function calling** - Use Claude's native function calling for structured outputs
3. **Streaming responses** - Real-time query parsing feedback
4. **Hybrid search** - Combine Claude with vector search (embeddings)

## Related Documentation

- [API Endpoints](../README.md#api-endpoints) - All available API endpoints
- [Database Schema](DATABASE.md) - Property model structure
- [Testing Guide](../TESTING.md) - How to run tests
- [Troubleshooting](../README.md#troubleshooting) - General troubleshooting guide

## Changelog

### November 5, 2024
- ✅ Fixed logger import (changed from named to default import)
- ✅ Added safer error serialization to prevent crashes
- ✅ Added test endpoint `GET /api/properties/search/test`
- ✅ Updated model from `claude-3-5-sonnet-20241022` to `claude-3-haiku-20240307`
- ✅ Updated `ANTHROPIC_API_KEY` in Doppler and `~/.env`
- ✅ Verified Claude API integration working correctly
- ✅ Added comprehensive documentation

---

**Built with Claude 3 Haiku** 🚀
