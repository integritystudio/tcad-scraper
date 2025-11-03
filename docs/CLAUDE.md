# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TCAD Scraper is a web application for extracting and analyzing property tax data from the Travis Central Appraisal District (TCAD) website. The project consists of two distinct parts:

1. **Legacy Puppeteer Scraper** (root directory) - Original scraping implementation
2. **React Frontend Application** (src/) - Modern web UI with analytics and data visualization

The application recently transitioned from Supabase to PostgreSQL with MCP server integration.

## Common Commands

```bash
# Development
npm run dev        # Start Vite dev server on http://localhost:5173

# Build
npm run build      # Compile TypeScript and build production bundle

# Preview
npm run preview    # Preview the production build locally
```

## Architecture

### Frontend Application (src/)

The React application is structured with the following component hierarchy:

- **App.tsx** - Main application component
  - Currently uses mock data (mockProperties array) instead of live database
  - Manages property state and filtering
  - Coordinates all child components

- **PropertyTable.tsx** - Sortable, paginated property data table
  - Client-side sorting and pagination
  - Configurable page sizes (10, 25, 50, 100)
  - Currency and date formatting utilities

- **Analytics.tsx** - Statistical summaries and metrics
- **Charts.tsx** - Data visualizations
- **Filters.tsx** - Property filtering controls

### Data Model

The core `Property` interface (src/types/index.ts) represents property records:

```typescript
interface Property {
  id: string;
  property_id: string;        // TCAD property ID
  name: string;               // Owner name
  prop_type: string;          // Property type (Single Family, Condo, etc.)
  city: string | null;
  property_address: string;
  assessed_value: number;
  appraised_value: number;
  geo_id: string | null;
  description: string | null; // Legal description
  search_term: string | null;
  scraped_at: string;
  created_at: string;
  updated_at: string;
}
```

### Legacy Scraper Implementation

Two standalone Puppeteer scripts exist in the root directory:

- **scraper.ts** - Main scraper targeting Travis CAD staging environment
  - Uses Cheerio for HTML parsing
  - Extracts property data from search results grid
  - Non-headless mode for debugging
  - Target URL: `https://stage.travis.prodigycad.com/property-search`

- **scraper2.ts** - Alternative/experimental implementation

**Note**: These scraper files are not currently integrated with the React application. The frontend uses mock data defined in App.tsx.

## Database Integration

### PostgreSQL Configuration

The project uses PostgreSQL via MCP server (.mcp.json):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": ["/Users/johnskelton/.mcp-servers/postgres/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://localhost:5432/testdb"
      }
    }
  }
}
```

### Database Connection Status

The application is configured to use PostgreSQL but currently uses mock data in App.tsx (lines 10-59). The `fetchProperties()` function simulates an API call with setTimeout rather than querying the database.

**To integrate live database data**: Replace the mock data implementation in App.tsx fetchProperties() with actual PostgreSQL queries using the MCP server tools.

## Technology Stack

- **Frontend**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 7.1.11
- **Styling**: CSS (component-scoped stylesheets)
- **Database**: PostgreSQL (via MCP server)
- **Scraping**: Puppeteer + Cheerio (legacy scripts)

## TypeScript Configuration

- Target: ES2020
- Module: ESNext with bundler resolution
- Strict mode enabled
- JSX: react-jsx
- No emit (handled by Vite)

## Development Notes

### Current State

- The React app is functional with mock data
- Supabase dependencies have been removed (recent migration)
- PostgreSQL MCP server is configured but not actively used by the frontend
- Legacy scraper scripts exist independently and are not integrated with the UI

### Key Files

- `src/App.tsx:10-59` - Mock data definition (replace with database queries)
- `src/App.tsx:71-85` - fetchProperties function (currently simulated)
- `src/types/index.ts` - Property interface definition
- `.mcp.json` - PostgreSQL MCP server configuration
- `scraper.ts` - Legacy Puppeteer scraper implementation

### Potential Next Steps

1. Connect the frontend to PostgreSQL using MCP server tools
2. Integrate the Puppeteer scraper with the database to populate property data
3. Create a backend API or service layer to coordinate scraping and data management
4. Add environment variable configuration for database URLs
