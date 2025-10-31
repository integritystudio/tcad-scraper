# PostgreSQL Database Setup & Usage Guide

## Overview

This TCAD scraper now includes PostgreSQL integration for persistent storage of property data. The setup includes:

- Local PostgreSQL database named `tcad_scraper`
- MCP (Model Context Protocol) server for Claude Code integration
- TypeScript database modules for easy data management
- CLI tools for querying and analyzing stored data

## Database Configuration

**Connection String:** `postgresql:///tcad_scraper?host=/var/run/postgresql&port=5433`

**Note:** PostgreSQL is running on port **5433** (not the default 5432) using Unix socket authentication.

The database connection is configured in:
- `.mcp.json` - MCP server configuration for Claude Code
- `src/database.ts` - TypeScript database module

## Database Schema

### Properties Table

```sql
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    property_id VARCHAR(255) UNIQUE NOT NULL,
    owner_name VARCHAR(500) NOT NULL,
    property_type VARCHAR(100),
    city VARCHAR(255),
    property_address TEXT NOT NULL,
    assessed_value VARCHAR(50),
    appraised_value VARCHAR(50),
    geo_id VARCHAR(255),
    legal_description TEXT,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `property_id` (unique)
- `owner_name`
- `city`
- `scraped_at`

## Usage

### 1. Running the Scraper with Database Storage

```bash
# Run scraper and save to database
npm run scrape:db
```

This will:
1. Scrape property data from TCAD
2. Store all valid properties in PostgreSQL
3. Update existing properties if found (based on `property_id`)

### 2. Querying the Database

#### Quick Stats
```bash
npm run db:stats
```

#### Interactive Query Tool
```bash
# Show statistics
npm run db:query stats

# Show properties by city
npm run db:query cities

# Show recent properties (default: 10)
npm run db:query recent

# Show specific number of recent properties
npm run db:query recent 25

# Search by owner name, address, or city
npm run db:query search "Austin"
npm run db:query search "Smith"

# Run custom SQL query
npm run db:query query "SELECT * FROM properties WHERE appraised_value > '500000' LIMIT 10"
```

### 3. Direct PostgreSQL Access

```bash
# Connect to database
psql tcad_scraper

# Example queries:
SELECT COUNT(*) FROM properties;
SELECT * FROM properties WHERE city = 'Austin';
SELECT city, COUNT(*) FROM properties GROUP BY city;
```

## Using PostgreSQL MCP with Claude Code

The PostgreSQL MCP server allows Claude Code to interact with your database directly. You can ask Claude to:

### Query Examples:
- "Show me all properties in Austin"
- "How many properties are in the database?"
- "Find properties with appraised value over $1,000,000"
- "What's the average property value by city?"

### Data Management:
- "Insert these new properties into the database"
- "Update property values for ID 12345"
- "Delete duplicate entries"

### Schema Operations:
- "Create a new table for storing scrape logs"
- "Add an index on the owner_name column"
- "Show me the current table structure"

## TypeScript API

### Import the Database Module

```typescript
import {
  insertProperty,
  insertProperties,
  getPropertiesByCity,
  getPropertyCount,
  Property
} from './src/database.js';
```

### Insert Single Property

```typescript
const property: Property = {
  name: "John Doe",
  propType: "Residential",
  city: "Austin",
  propertyAddress: "123 Main St",
  assessedValue: "$250,000",
  propertyID: "12345",
  appraisedValue: "$275,000",
  geoID: "ABCD123",
  description: "Lot 1, Block A"
};

await insertProperty(property);
```

### Insert Multiple Properties

```typescript
await insertProperties(propertiesArray);
```

### Query Properties

```typescript
// Get properties by city
const austinProperties = await getPropertiesByCity("Austin");

// Get total count
const count = await getPropertyCount();
```

## Maintenance

### Backup Database

```bash
pg_dump tcad_scraper > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
psql tcad_scraper < backup_20231028.sql
```

### Clear All Data

```bash
psql tcad_scraper -c "TRUNCATE TABLE properties RESTART IDENTITY;"
```

### Stop PostgreSQL

```bash
brew services stop postgresql@14
```

### Start PostgreSQL

```bash
brew services start postgresql@14
```

## Troubleshooting

### MCP Server Not Working

1. Check if PostgreSQL is running:
   ```bash
   pg_isready -p 5433
   ```

2. Verify MCP server path in `.mcp.json` (should be):
   ```
   /home/aledlie/.mcp-servers/postgres/node_modules/@modelcontextprotocol/server-postgres/dist/index.js
   ```

3. Verify the connection string in `.mcp.json`:
   ```
   postgresql:///tcad_scraper?host=/var/run/postgresql&port=5433
   ```

4. Restart Claude Code to reconnect to MCP servers

**Note:** The MCP server package `@modelcontextprotocol/server-postgres` is deprecated but still functional for read-only database access.

### Connection Errors

1. Verify database exists:
   ```bash
   psql postgres -c "\l" | grep tcad_scraper
   ```

2. Check connection string in `src/database.ts`

3. Ensure PostgreSQL is accepting connections on port 5432

### Permission Issues

If you get permission errors, you may need to grant access:
```bash
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE tcad_scraper TO $USER;"
```

## Advanced Usage

### Custom Queries with MCP

Through Claude Code, you can execute complex queries:

```
"Run a query to find the top 10 most valuable properties in each city"
"Calculate the total assessed value of all properties"
"Show me properties that were scraped in the last 24 hours"
"Create a materialized view for city statistics"
```

### Integration with Other Tools

The PostgreSQL database can be accessed by:
- pgAdmin (GUI tool)
- DBeaver (Multi-platform database tool)
- Any PostgreSQL-compatible client
- Your custom applications via the `pg` npm package

## Next Steps

1. **Add More Tables**: Create tables for scrape logs, search history, etc.
2. **Add Analytics**: Build views and functions for property analysis
3. **Create APIs**: Build REST APIs to serve the data
4. **Add Monitoring**: Set up alerts for data quality issues
5. **Implement Caching**: Use Redis for frequently accessed data

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [node-postgres (pg) Documentation](https://node-postgres.com/)
- [MCP Documentation](https://modelcontextprotocol.io/)
- [Claude Code Documentation](https://docs.claude.com/claude-code)
