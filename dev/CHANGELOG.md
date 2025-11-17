# Changelog

All notable changes to the TCAD Scraper project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### In Progress
- Enhanced Prometheus metrics integration
- CI/CD pipeline automation
- Docker containerization for deployment

---

## [2.1.0] - 2025-11-08

### Added - PropertyCard UI Enhancement 🎉

This release introduces a major frontend enhancement with expandable PropertyCard components using progressive disclosure patterns.

#### New Components (29 files)

**Core Expansion Components:**
- `ExpandButton` - Toggle control for card expansion
  - Size variants (sm, md, lg)
  - Animated chevron rotation (180°)
  - Full ARIA support for screen readers
  - Keyboard navigation (Tab, Enter, Space)

- `PropertyDetails` - Container for expanded content
  - Configurable section display
  - Smooth fade-in animation (300ms)
  - Conditional rendering based on expansion state
  - Support for custom section ordering

**Section Components:**
- `FinancialSection` - Financial value analysis
  - Appraised vs Assessed value comparison
  - Automatic difference calculation
  - Percentage difference display
  - Color-coded indicators:
    - 🔺 Green for positive difference (better for appreciation)
    - 🔻 Red for negative difference (tax assessment lower)
    - ➖ Gray for missing assessed value
  - Currency formatting via `useFormatting` hook

- `IdentifiersSection` - Property identifiers display
  - Property ID with monospace font (SF Mono, Monaco)
  - Geo ID with graceful null handling
  - Prepared for future copy-to-clipboard functionality

- `DescriptionSection` - Property description with truncation
  - Smart text truncation at 150 characters
  - "Show more"/"Show less" toggle
  - Smooth height animation
  - Elegant null state handling

- `MetadataSection` - Data timestamps and freshness
  - Relative time display ("2 days ago")
  - Absolute timestamp display
  - Freshness indicator integration
  - Multiple timestamp support (scraped_at, updated_at, created_at)

**Utility Components:**
- `SectionHeader` - Reusable section title
  - Icon support from Icon component library
  - Optional badge display
  - Collapsible variant support
  - Consistent typography and spacing

- `ValueComparison` - Financial value comparison display
  - Side-by-side value layout
  - Automatic difference calculation
  - Percentage calculation with formatting
  - Color-coded difference indicators
  - Null-safe operations

- `TruncatedText` - Text truncation with expansion
  - Configurable max length (default: 150 chars)
  - Toggle button for expansion/collapse
  - Smooth height transitions
  - Null text handling

- `TimestampList` - Timestamp formatting utility
  - Relative time formatting ("2 days ago", "5 minutes ago")
  - Absolute time formatting (Jan 15, 2025 at 2:15 PM)
  - Multiple timestamp display
  - Responsive layout

- `FreshnessIndicator` - Data quality indicator
  - Configurable thresholds (default: 7 days fresh, 30 days aging)
  - Color-coded status badges:
    - 🟢 Fresh (0-7 days)
    - 🟡 Aging (7-30 days)
    - 🔴 Stale (30+ days)
  - Two display variants: dot and badge
  - Automatic status calculation from timestamp

#### Updated Components (2 files)

- `PropertyCard.tsx`
  - Added expansion state management
  - Integrated ExpandButton component
  - Integrated PropertyDetails container
  - Maintained analytics tracking on mount
  - Preserved existing Card, Badge, and Icon usage

- `PropertyCard.module.css`
  - Added expansion button container styles
  - Added responsive breakpoints (640px, 1024px)
  - Mobile-optimized layouts
  - Smooth transition animations

#### Features

**Progressive Disclosure Pattern:**
- Information hierarchy with collapsed/expanded states
- Reduces cognitive load by showing essentials first
- One-click access to detailed information
- Maintains grid layout consistency

**Financial Analysis:**
- Visual value comparison
- Automatic difference calculation (appraised - assessed)
- Percentage difference with sign (+/-)
- Color-coded visual indicators
- Currency formatting with locale support
- Graceful handling of null assessed values

**Data Quality Indicators:**
- Freshness badges showing data age
- Color-coded status (Fresh/Aging/Stale)
- Relative and absolute timestamps
- Visual feedback on data currency

**Responsive Design:**
- Mobile-first approach
- Breakpoints at 640px (mobile/tablet) and 1024px (tablet/desktop)
- Touch-friendly targets (44px minimum on mobile)
- Optimized layouts per device size:
  - Mobile: Stacked vertical layout, full-width buttons
  - Tablet: Two-column section layout
  - Desktop: Multi-column grid, hover effects

**Accessibility (WCAG AA Compliant):**
- Full keyboard navigation support (Tab, Enter, Space, Escape)
- Screen reader compatibility with proper ARIA attributes
  - `aria-expanded` for expansion state
  - `aria-label` for button descriptions
  - `aria-controls` linking buttons to content
  - `aria-hidden` for decorative icons
- Focus indicators (2px solid outline, 2px offset)
- Color contrast ratios exceeding 4.5:1 for all text
- Semantic HTML structure
- Visible focus states

**Smooth Animations:**
- 300ms expand/collapse transitions
- Fade-in animation for PropertyDetails
- Chevron rotation animation (0° → 180°)
- CSS-based transitions (hardware accelerated)
- `ease` and `ease-in-out` timing functions

**Null Value Handling:**
- Graceful fallbacks for missing data
- "Not available" text for null fields
- Conditional section rendering
- Empty state messaging

#### Documentation

**New Documentation Files:**
- `src/components/features/PropertySearch/README.md` - Comprehensive component guide (450+ lines)
  - Component architecture
  - Usage examples
  - Accessibility features
  - Responsive design guide
  - Extension guide
  - Testing examples

- `COMPONENT_IMPLEMENTATION_GUIDE.md` - Implementation templates and code examples
  - Quick start reference
  - File structure guide
  - Component templates
  - Implementation checklist
  - Testing guide
  - Performance tips

- `VISUAL_DESIGN_PLAN.md` - Complete visual design system (1,590 lines)
  - Visual hierarchy
  - Layout options analysis
  - Component architecture
  - Design tokens
  - Animation specifications
  - Implementation phases

- `VISUAL_WIREFRAMES.md` - ASCII wireframes and interaction diagrams (1,193 lines)
  - Before/after comparisons
  - Detailed section wireframes
  - Interaction states
  - Responsive layouts
  - Component structure diagrams
  - Animation timelines

**Updated Documentation:**
- `README.md` - Added PropertyCard UI enhancement section
  - Updated frontend features list
  - Added Recent Updates section with release highlights
  - Added Frontend Documentation section
  - References to new documentation files

- `ARCHITECTURE.md` - Updated frontend architecture section
  - Added Frontend Components section
  - Detailed PropertyCard expansion components
  - Component patterns documentation
  - Styling architecture details

#### Technical Details

**Component Patterns:**
- Progressive disclosure for information hierarchy
- Graceful degradation for missing data
- Mobile-first responsive design
- Compound component pattern (PropertyDetails + Sections)
- Presentational/container component separation

**Styling:**
- CSS Modules for scoped styles
- Design tokens for consistency
- Responsive breakpoints (640px, 1024px)
- Animation timing (300ms standard)
- Color system with semantic naming

**State Management:**
- Local component state (useState)
- Per-card expansion state
- No global state dependencies
- Optional localStorage persistence (future)

**Performance:**
- Conditional rendering (details only when expanded)
- CSS-based animations (GPU accelerated)
- Memoization candidates identified
- Lazy loading ready (future enhancement)

**Dependencies:**
- React 19.2
- TypeScript 5.x
- Existing hooks: `useFormatting`, `useAnalytics`
- Existing UI components: Card, Badge, Icon

### Changed

- Updated frontend technology stack to React 19.2 and Vite 7.1
- Enhanced PropertyCard component from static to expandable
- Improved mobile user experience with touch-optimized controls
- Increased component modularity with reusable utilities

### Technical Debt Addressed

- Separated concerns with dedicated section components
- Improved code organization with clear folder structure
- Enhanced type safety with comprehensive TypeScript interfaces
- Better accessibility with ARIA attributes and keyboard support

---

## [2.0.0] - 2025-01-15

### Added
- AI-powered natural language search using Claude AI
- Google Analytics 4 (GA4) integration
- Meta Pixel tracking
- Comprehensive analytics dashboard
- Search term optimization
- Error boundary with analytics tracking

### Changed
- Migration to React 19.2
- Updated to Vite 7.1
- Enhanced error handling

### Documentation
- Added ANALYTICS.md (1,052 lines)
- Updated README with analytics section

---

## [1.5.0] - 2024-12-01

### Added
- Swagger/OpenAPI documentation
- Interactive API documentation at `/api-docs`
- Prometheus metrics endpoint
- Enhanced monitoring capabilities

### Documentation
- Added PROMETHEUS_SETUP.md
- Created ARCHITECTURE.md with system diagrams

---

## [1.4.0] - 2024-11-15

### Added
- API token auto-refresh system
- Cron job for token management
- Bull Dashboard for queue monitoring
- Enhanced scraper performance

### Changed
- Improved token refresh reliability
- Updated scraper to handle API rate limits

### Documentation
- Added TOKEN_AUTO_REFRESH.md
- Added API_TOKEN_IMPLEMENTATION.md

---

## [1.3.0] - 2024-10-01

### Added
- BullMQ job queue system
- Redis integration
- Continuous batch scraping
- Search term analytics

### Changed
- Migration from synchronous to asynchronous scraping
- Enhanced data collection efficiency

---

## [1.2.0] - 2024-09-01

### Added
- JWT authentication support
- API key authentication
- Rate limiting (100 req/15 min)
- CORS configuration

### Security
- Helmet security headers
- Input validation with Zod
- Environment variable protection

---

## [1.1.0] - 2024-08-01

### Added
- React frontend with Vite
- Property search interface
- Basic property card display
- CSS styling

### Changed
- Separated frontend from backend

---

## [1.0.0] - 2024-07-01

### Added - Initial Release
- Express.js backend server
- Playwright web scraper for TCAD
- PostgreSQL database with Prisma ORM
- Property data model
- Basic API endpoints
- Docker Compose setup
- Doppler secrets management

### Features
- Property scraping from travis.prodigycad.com
- REST API for property data access
- Database storage with automated timestamps
- Health check endpoints

---

## Version History Summary

- **v2.1.0** (2025-11-08): PropertyCard UI Enhancement - Expandable cards with progressive disclosure
- **v2.0.0** (2025-01-15): AI Search & Analytics - Claude AI integration and comprehensive tracking
- **v1.5.0** (2024-12-01): API Documentation - Swagger/OpenAPI and Prometheus metrics
- **v1.4.0** (2024-11-15): Token Management - Auto-refresh system and Bull Dashboard
- **v1.3.0** (2024-10-01): Queue System - BullMQ integration and continuous scraping
- **v1.2.0** (2024-09-01): Authentication - JWT, API keys, and security enhancements
- **v1.1.0** (2024-08-01): Frontend - React UI with Vite
- **v1.0.0** (2024-07-01): Initial Release - Core scraping and API functionality

---

## Links

- [README](./README.md) - Project overview and setup
- [ARCHITECTURE](./ARCHITECTURE.md) - System architecture and design
- [PropertySearch Component Guide](./src/components/features/PropertySearch/README.md) - Component documentation
- [Component Implementation Guide](./COMPONENT_IMPLEMENTATION_GUIDE.md) - Implementation templates
- [Visual Design Plan](./VISUAL_DESIGN_PLAN.md) - Design system
- [Visual Wireframes](./VISUAL_WIREFRAMES.md) - UI wireframes

---

**Maintained by:** The TCAD Scraper Team
**License:** Proprietary - All rights reserved
**Built with ❤️ for Karen, by John, Micah, and Alyshia**
