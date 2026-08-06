# components

## Overview

UI components for the TCAD Scraper frontend (React 19).

## Structure

```
components/
├── features/
│   └── PropertySearch/   — Natural language search UI (main feature)
├── layout/
│   ├── AttributionCard/  — Footer attribution
│   ├── Footer/
│   └── HeaderBadge/
├── ui/                   — Reusable primitives (Badge, Button, Card, Icon, Input, LoadingSkeleton)
└── ErrorBoundary.tsx     — React error boundary
```

## Notes

- All styling via CSS Modules (no inline styles)
- `ScrapeManager.tsx` was removed with the BullMQ → Workers queue migration (March 2026)
