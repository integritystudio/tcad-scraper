# Frontend Architecture Documentation

**Project:** TCAD Scraper
**Frontend Framework:** React 18 + TypeScript + Vite
**Last Updated:** 2025-11-08
**Status:** Production

---

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Type System](#type-system)
6. [Styling Approach](#styling-approach)
7. [Key Files Reference](#key-files-reference)

---

## Overview

The TCAD Scraper frontend is a modern React application that provides an intuitive interface for searching and viewing Travis County property data. It features natural language search powered by Claude AI, real-time property filtering, and comprehensive analytics tracking.

### Tech Stack

- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 5.x
- **Styling:** CSS Modules + PostCSS
- **State Management:** React Hooks (useState, useEffect, useCallback)
- **HTTP Client:** Axios + Fetch API
- **Analytics:** Google Analytics 4 + Meta Pixel
- **Error Tracking:** React Error Boundaries

### Key Features

- Natural language property search
- Real-time search results with pagination
- Property detail cards with valuations
- Example queries for quick searches
- Error boundaries for graceful error handling
- Analytics tracking for user behavior
- Responsive design

---

## File Structure

```
src/
├── components/                    # React components
│   ├── features/                  # Feature-specific components
│   │   └── PropertySearch/        # Property search feature
│   │       ├── PropertySearchContainer.tsx   # Main container (orchestrator)
│   │       ├── SearchBox.tsx                 # Search input component
│   │       ├── SearchResults.tsx             # Results display container
│   │       ├── PropertyCard.tsx              # Individual property card
│   │       ├── ExampleQueries.tsx            # Example search queries
│   │       ├── index.ts                      # Feature barrel export
│   │       ├── PropertySearchContainer.module.css
│   │       ├── SearchBox.module.css
│   │       ├── SearchResults.module.css
│   │       ├── PropertyCard.module.css
│   │       └── ExampleQueries.module.css
│   │
│   ├── ui/                        # Reusable UI components
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.module.css
│   │   │   └── index.ts
│   │   ├── Card/
│   │   │   ├── Card.tsx          # Card, CardHeader, CardBody components
│   │   │   ├── Card.module.css
│   │   │   └── index.ts
│   │   ├── Badge/
│   │   │   ├── Badge.tsx
│   │   │   ├── Badge.module.css
│   │   │   └── index.ts
│   │   ├── Input/
│   │   │   ├── Input.tsx
│   │   │   ├── Input.module.css
│   │   │   └── index.ts
│   │   ├── Icon/
│   │   │   ├── Icon.tsx
│   │   │   ├── icons.ts          # Icon definitions
│   │   │   └── index.ts
│   │   └── index.ts               # UI barrel export
│   │
│   ├── ErrorBoundary.tsx          # Error boundary component
│   ├── Analytics.tsx              # Analytics dashboard (legacy)
│   ├── Charts.tsx                 # Charts component (legacy)
│   ├── Filters.tsx                # Filters component (legacy)
│   ├── PropertySearch.tsx         # Property search (legacy)
│   ├── PropertyTable.tsx          # Table view (legacy)
│   ├── ScrapeManager.tsx          # Scrape manager (legacy)
│   └── README.md                  # Component documentation
│
├── hooks/                         # Custom React hooks
│   ├── useAnalytics.ts           # Analytics tracking hook
│   ├── usePropertySearch.ts      # Property search hook
│   ├── useFormatting.ts          # Formatting utilities hook
│   ├── usePagination.ts          # Pagination hook
│   ├── useDebounce.ts            # Debounce hook
│   └── index.ts                  # Hook barrel export
│
├── lib/                           # Libraries and utilities
│   ├── analytics.ts              # GA4 + Meta Pixel integration
│   ├── api-config.ts             # API configuration
│   ├── logger.ts                 # Frontend logging utility
│   ├── xcontroller.client.ts     # XController security client
│   └── __tests__/                # Library tests
│
├── services/                      # API service layer
│   ├── api.service.ts            # Main API client (Axios)
│   └── README.md                 # Service documentation
│
├── types/                         # TypeScript type definitions
│   ├── index.ts                  # Frontend types (Property interface)
│   └── README.md                 # Type documentation
│
├── utils/                         # Utility functions
│   ├── constants.ts              # Application constants
│   ├── formatters.ts             # Formatting functions
│   ├── helpers.ts                # Helper functions
│   └── index.ts                  # Utility barrel export
│
├── App.tsx                        # Root application component
├── App.css                        # Global application styles
├── main.tsx                       # Application entry point
└── vite-env.d.ts                 # Vite type declarations

shared/                            # Shared types (backend + frontend)
└── types/
    ├── property.types.ts         # Property type definitions (Schema.org)
    ├── json-ld.utils.ts          # JSON-LD utilities
    └── index.ts                  # Shared types barrel export

public/                            # Static assets
├── CNAME                         # GitHub Pages domain
└── favicon.svg                   # Application favicon

Root Files:
├── index.html                    # HTML entry point (includes analytics scripts)
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── tsconfig.app.json            # App-specific TypeScript config
├── package.json                 # Dependencies and scripts
└── .env.example                 # Environment variables template
```

---

## Component Architecture

### Component Hierarchy

```
App (ErrorBoundary wrapper)
└── PropertySearchContainer (orchestrator)
    ├── SearchBox (input + submit)
    ├── ExampleQueries (quick searches)
    └── SearchResults (results display)
        └── PropertyCard[] (individual cards)
            ├── Card (UI component)
            ├── Badge (UI component)
            └── Icon (UI component)
```

### Component Responsibilities

#### 1. **App.tsx** - Root Application Component
- Wraps entire app in ErrorBoundary
- Tracks initial page view with analytics
- Renders PropertySearchContainer

**Key Dependencies:**
- ErrorBoundary component
- useAnalytics hook
- PropertySearchContainer component

#### 2. **PropertySearchContainer.tsx** - Feature Orchestrator
- **Location:** `src/components/features/PropertySearch/PropertySearchContainer.tsx`
- **Responsibility:** Orchestrates the entire property search feature
- **State Management:**
  - Search query state
  - Results from usePropertySearch hook
- **Analytics Integration:**
  - Tracks search initiation
  - Tracks search results
  - Tracks errors

**Props:** None (self-contained)

**Children:**
- SearchBox
- ExampleQueries
- SearchResults

**Hooks Used:**
- `usePropertySearch()` - Handles API calls, loading, error states
- `useAnalytics()` - Tracks user interactions

#### 3. **SearchBox.tsx** - Search Input Component
- **Location:** `src/components/features/PropertySearch/SearchBox.tsx`
- **Responsibility:** Search input field with submit button
- **Features:**
  - Natural language input
  - Loading state during search
  - Enter key submission
  - Clear button

**Props:**
```typescript
interface SearchBoxProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}
```

#### 4. **SearchResults.tsx** - Results Container
- **Location:** `src/components/features/PropertySearch/SearchResults.tsx`
- **Responsibility:** Displays search results, explanations, and error states
- **Display Logic:**
  - Shows error message if error exists
  - Shows "no results" message if no results found
  - Shows explanation banner (Claude AI)
  - Renders grid of PropertyCards
  - Shows "Load More" button for pagination

**Props:**
```typescript
interface SearchResultsProps {
  results: Property[];
  totalResults: number;
  explanation?: string;
  error?: string;
  loading?: boolean;
  searchQuery?: string;
  onLoadMore?: () => void;
}
```

#### 5. **PropertyCard.tsx** - Individual Property Display
- **Location:** `src/components/features/PropertySearch/PropertyCard.tsx`
- **Responsibility:** Displays single property details
- **Analytics:** Tracks property view on render
- **Display Fields:**
  - Owner name
  - Property type badge
  - Address with icon
  - Appraised value (formatted currency)
  - Assessed value (if available, formatted currency)
  - Property ID (monospace font)

**Props:**
```typescript
interface PropertyCardProps {
  property: Property;
}
```

**Hooks Used:**
- `useFormatting()` - Currency formatting
- `useAnalytics()` - View tracking
- `useEffect()` - Tracks view on mount

**Current Issue:** Displays "$NaN" for values and blank property_id due to field name mismatch (see [Data Flow](#data-flow) section).

#### 6. **ExampleQueries.tsx** - Example Search Suggestions
- **Location:** `src/components/features/PropertySearch/ExampleQueries.tsx`
- **Responsibility:** Displays clickable example queries
- **Analytics:** Tracks which examples users click
- **Examples:**
  - "Properties in Austin over $500k"
  - "Residential properties in Lakeway"
  - "Commercial properties downtown"

**Props:**
```typescript
interface ExampleQueriesProps {
  onSelectQuery: (query: string) => void;
  disabled?: boolean;
}
```

#### 7. **ErrorBoundary.tsx** - Error Handler
- **Location:** `src/components/ErrorBoundary.tsx`
- **Responsibility:** Catches React errors and displays fallback UI
- **Analytics:** Tracks errors automatically
- **Features:**
  - Catches component rendering errors
  - Displays user-friendly error message
  - Tracks error details to analytics
  - Includes component stack trace

**Props:**
```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
}
```

### UI Component Library

#### Button Component
```typescript
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}
```

#### Card Components
```typescript
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  className?: string;
}

interface CardHeaderProps {
  children: React.ReactNode;
}

interface CardBodyProps {
  children: React.ReactNode;
}
```

#### Badge Component
```typescript
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
}
```

#### Input Component
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}
```

#### Icon Component
```typescript
interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
}

type IconName = 'search' | 'location' | 'chevronRight' | 'alertCircle' | ...;
```

---

## Data Flow

### Search Flow Diagram

```
User Input
    ↓
SearchBox.tsx (local state)
    ↓ onSearch(query)
PropertySearchContainer.tsx
    ↓ handleSearch(query)
    ├─→ logSearch(query) [Analytics]
    └─→ search(query) [usePropertySearch hook]
            ↓
        usePropertySearch.ts
            ↓ fetch POST /api/properties/search
        Backend API (Express + Prisma)
            ↓
        Prisma Query (PostgreSQL)
            ↓
        Returns: { data: Property[], pagination, query }
            ↓
        usePropertySearch.ts
            ├─→ setResults(data.data)
            ├─→ setTotalResults(data.pagination.total)
            └─→ setExplanation(data.query.explanation)
                ↓
        PropertySearchContainer.tsx
            ├─→ logSearchResults() [Analytics]
            └─→ renders SearchResults
                    ↓
                SearchResults.tsx
                    └─→ renders PropertyCard[] (map)
                            ↓
                        PropertyCard.tsx
                            ├─→ logPropertyView() [Analytics]
                            ├─→ formatCurrency(appraisedValue)
                            └─→ Displays property data
```

### Data Transformation Issue

**CRITICAL BUG IDENTIFIED:**

The backend Prisma ORM returns data in **camelCase**:
```typescript
{
  id: "uuid",
  propertyId: "12345",        // camelCase
  appraisedValue: 500000,     // camelCase
  name: "John Doe",
  // ...
}
```

But the frontend expects **snake_case**:
```typescript
// src/types/index.ts
interface Property {
  id: string;
  property_id: string;        // snake_case
  appraised_value: number;    // snake_case
  name: string;
  // ...
}
```

**Result:** PropertyCard displays:
- `property.property_id` → undefined → **blank display**
- `formatCurrency(property.appraised_value)` → formatCurrency(undefined) → **"$NaN"**

**Solution Required:** Transform backend response from camelCase to snake_case before sending to frontend, OR update frontend types to match backend camelCase.

### API Integration

#### Primary API Endpoint: Natural Language Search

**Endpoint:** `POST /api/properties/search`

**Request:**
```typescript
{
  query: string;     // Natural language query
  limit?: number;    // Max results (default: 100)
  offset?: number;   // Pagination offset (default: 0)
}
```

**Response:**
```typescript
{
  data: Property[];           // Array of properties (CURRENTLY CAMELCASE)
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  query: {
    original: string;         // Original user query
    explanation: string;      // Claude AI explanation
  };
}
```

**Frontend Hook:** `usePropertySearch()`

**Implementation:**
- Location: `src/hooks/usePropertySearch.ts`
- Uses fetch API (not Axios)
- Returns: `{ results, loading, error, totalResults, explanation, search, clearResults }`

---

## Type System

### Frontend Types (src/types/index.ts)

**Current Implementation (Snake Case):**
```typescript
export interface Property {
  id: string;
  property_id: string;           // ← Snake case
  name: string;
  prop_type: string;
  city: string | null;
  property_address: string;
  assessed_value: number;        // ← Snake case
  appraised_value: number;       // ← Snake case
  geo_id: string | null;
  description: string | null;
  search_term: string | null;
  scraped_at: string;
  created_at: string;
  updated_at: string;
}
```

### Backend Types (Prisma)

**Prisma Schema (server/prisma/schema.prisma):**
```prisma
model Property {
  id              String   @id @default(uuid())
  propertyId      String   @map("property_id") @unique
  name            String
  propType        String   @map("prop_type")
  city            String?
  propertyAddress String   @map("property_address")
  assessedValue   Float?   @map("assessed_value")
  appraisedValue  Float    @map("appraised_value")
  geoId           String?  @map("geo_id")
  description     String?  @db.Text
  searchTerm      String?  @map("search_term")
  scrapedAt       DateTime @default(now()) @map("scraped_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("properties")
}
```

**Prisma Client JavaScript Object (camelCase):**
- Database column: `property_id` → JS property: `propertyId`
- Database column: `appraised_value` → JS property: `appraisedValue`
- This is standard Prisma behavior via `@map()` directive

### Shared Types (shared/types/)

The `/shared/types/property.types.ts` file defines Schema.org-aligned types:

```typescript
// Database representation (camelCase - matches Prisma)
export interface PropertyDatabase {
  id: string;
  propertyId: string;
  appraisedValue: number;
  // ...
}

// API representation (camelCase - matches modern conventions)
export interface PropertyAPI {
  id: string;
  propertyId: string;
  owner: PropertyOwner;
  address: PropertyAddress;
  valuation: PropertyValuation;
  // ...
}
```

**Type Mismatch Summary:**
1. **Database Columns:** snake_case (PostgreSQL convention)
2. **Prisma Client Objects:** camelCase (JavaScript convention via `@map()`)
3. **Shared Types:** camelCase (modern TypeScript convention)
4. **Frontend Types:** snake_case (INCONSISTENT - causes bug)

---

## Styling Approach

### CSS Modules

All components use CSS Modules for scoped styling:

**Naming Convention:**
- Component file: `PropertyCard.tsx`
- Style file: `PropertyCard.module.css`
- Import: `import styles from './PropertyCard.module.css'`
- Usage: `<div className={styles.card}>`

**Benefits:**
- Scoped class names (no global conflicts)
- Type-safe className access
- Co-located with components
- Tree-shakable

### Global Styles

- **Location:** `src/App.css`, `index.html`
- **Purpose:** CSS variables, resets, typography
- **CSS Variables:**
  - Colors: `--color-primary`, `--color-secondary`, etc.
  - Spacing: `--spacing-sm`, `--spacing-md`, etc.
  - Typography: `--font-family-base`, `--font-size-base`, etc.

### Responsive Design

- Mobile-first approach
- Breakpoints:
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px

---

## Key Files Reference

### Entry Points

1. **index.html**
   - HTML entry point
   - Includes GA4 script (tracking ID: G-J7TL7PQH7S)
   - Includes Meta Pixel script (ID: 25629020546684786)
   - Mounts React app to `#root`

2. **src/main.tsx**
   - React application entry point
   - Renders `<App />` to DOM
   - Imports global styles

3. **src/App.tsx**
   - Root component
   - Wraps app in ErrorBoundary
   - Tracks initial page view
   - Renders PropertySearchContainer

### Configuration Files

1. **vite.config.ts**
   - Vite build configuration
   - Port: 5173 (dev), 4173 (preview)
   - API proxy configuration (if needed)

2. **tsconfig.json**
   - TypeScript compiler options
   - Strict mode enabled
   - Path aliases configured

3. **package.json**
   - Dependencies:
     - react: ^18.x
     - axios: Latest
     - typescript: Latest
   - Scripts:
     - `npm run dev` - Start dev server
     - `npm run build` - Build for production
     - `npm run preview` - Preview production build
     - `npm run type-check` - TypeScript type checking

### Custom Hooks

#### usePropertySearch Hook

**Location:** `src/hooks/usePropertySearch.ts`

**Purpose:** Handles property search API calls and state management

**Returns:**
```typescript
{
  results: Property[];           // Search results
  loading: boolean;             // Loading state
  error: string;               // Error message
  totalResults: number;        // Total count
  explanation: string;         // Claude AI explanation
  search: (query: string, limit?: number) => Promise<void>;
  clearResults: () => void;
}
```

**Implementation Details:**
- Uses fetch API for HTTP requests
- Manages loading/error states
- Parses API response
- Validates response structure

#### useAnalytics Hook

**Location:** `src/hooks/useAnalytics.ts`

**Purpose:** Wraps analytics functions for React components

**Returns:**
```typescript
{
  logPageView: (path: string, title: string) => void;
  logSearch: (query: string) => void;
  logSearchResults: (query: string, count: number, hasExplanation: boolean) => void;
  logPropertyView: (propertyId: string, address: string) => void;
  logExampleQueryClick: (query: string) => void;
  logError: (error: string, context?: string) => void;
  logEngagement: (action: string, category?: string, value?: number) => void;
}
```

**All functions are memoized with useCallback for performance.**

#### useFormatting Hook

**Location:** `src/hooks/useFormatting.ts`

**Purpose:** Provides formatting utilities

**Returns:**
```typescript
{
  formatCurrency: (value: number) => string;  // "$500,000"
  formatNumber: (value: number) => string;    // "500,000"
  formatDate: (dateString: string) => string; // "Nov 8, 2025, 10:30 AM"
  formatPropertyType: (type: string) => string;
  truncateText: (text: string, maxLength: number) => string;
}
```

**Implementation:** Uses `Intl` API for locale-aware formatting

#### useDebounce Hook

**Location:** `src/hooks/useDebounce.ts`

**Purpose:** Debounces rapid value changes

**Usage:**
```typescript
const debouncedValue = useDebounce(searchQuery, 300); // 300ms delay
```

### Analytics Integration

#### Google Analytics 4

**Tracking ID:** G-J7TL7PQH7S

**Events Tracked:**
1. `page_view` - Initial page load
2. `search` - User search initiation
3. `search_results` - Search results returned
4. `property_view` - Property card viewed
5. `example_query_click` - Example query clicked
6. `error` - React errors caught
7. `engagement` - Custom engagement events

**Implementation:** `src/lib/analytics.ts`

**Configuration:**
```javascript
// index.html
gtag('config', 'G-J7TL7PQH7S', {
  send_page_view: false  // Manual page view tracking
});
```

#### Meta Pixel

**Pixel ID:** 25629020546684786

**Events Tracked:**
- All events mirror GA4 events
- Automatic PageView on load
- Custom events via `fbq('trackCustom', ...)`

**Implementation:** `src/lib/analytics.ts`

### API Service Layer

**Location:** `src/services/api.service.ts`

**Purpose:** Centralized API client using Axios

**Exports:**
- `propertyAPI` - Property-related endpoints
- `healthAPI` - Health check endpoints

**Features:**
- Request/response interceptors
- Authentication token handling
- Error handling
- Rate limit detection
- Network error handling

**Base URL:** Configured via `VITE_API_URL` environment variable (default: `http://localhost:3001/api`)

---

## Environment Variables

**File:** `.env` (create from `.env.example`)

```bash
# API Configuration
VITE_API_URL=http://localhost:3001/api

# Analytics (already in index.html, but can be managed here)
VITE_GA_TRACKING_ID=G-J7TL7PQH7S
VITE_META_PIXEL_ID=25629020546684786
```

**Note:** Vite requires `VITE_` prefix for environment variables to be exposed to the frontend.

---

## Build & Deployment

### Development

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run type-check # Type checking without building
```

### Production

```bash
npm run build      # Build for production (outputs to dist/)
npm run preview    # Preview production build (http://localhost:4173)
```

**Build Output:**
```
dist/
├── index.html           # Entry HTML with inlined scripts
├── assets/
│   ├── index-[hash].js   # Main JavaScript bundle (~65 kB gzipped)
│   ├── index-[hash].css  # Styles (~2.6 kB gzipped)
│   └── favicon.svg
└── CNAME                # GitHub Pages domain (if applicable)
```

**Production Optimizations:**
- Code splitting
- Tree shaking
- Minification
- Asset hashing
- Gzip compression

---

## Troubleshooting

### Common Issues

#### 1. "$NaN" displayed for property values

**Cause:** Field name mismatch between backend (camelCase) and frontend (snake_case)

**Fix:** See Data Flow section - transform backend response or update frontend types

#### 2. Analytics not tracking

**Check:**
1. Browser console for analytics events (dev mode only)
2. Network tab for requests to `google-analytics.com` and `facebook.com`
3. GA4 Real-Time dashboard
4. Meta Events Manager

#### 3. API connection errors

**Check:**
1. Backend server is running (port 3001)
2. `VITE_API_URL` environment variable is set correctly
3. CORS headers configured on backend
4. Network tab for failed requests

#### 4. Type errors after Prisma schema changes

**Solution:**
```bash
cd server
npx prisma generate  # Regenerate Prisma client types
```

---

## Future Improvements

1. **Fix Type Mismatch:** Align frontend types with backend camelCase
2. **Add Tests:** Unit tests for components and hooks
3. **Pagination:** Implement "Load More" functionality
4. **Filters:** Add city, price range, property type filters
5. **Sorting:** Allow sorting by different fields
6. **Map View:** Display properties on a map
7. **Property Details Page:** Full property detail view
8. **Favorites:** Save favorite properties
9. **Share:** Share property links
10. **Export:** Export search results to CSV/PDF

---

## Contact & Resources

**Documentation:**
- [Backend API Docs](./API.md)
- [Analytics Documentation](./ANALYTICS.md)
- [Testing Documentation](./TESTING.md)

**Related Files:**
- Backend: `server/src/`
- Shared Types: `shared/types/`
- Documentation: `docs/`

---

**Last Updated:** 2025-11-08
**Maintainer:** Development Team
**Version:** 1.0.0
