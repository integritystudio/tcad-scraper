# src

## Overview

Frontend source — React 19 + Vite. Production served from GitHub Pages.

## Subdirectories

- `components/` — UI components (features, layout, ui)
- `constants/` — Generated build-time constants (`build.ts` via `scripts/generate-build-constants.ts`; gitignored)
- `hooks/` — Custom React hooks
- `lib/` — Client-side utilities (analytics, api-config, sentry, xcontroller)
- `types/` — TypeScript types
- `utils/` — Utility functions

## Root Files

- `App.tsx` — Root React component (routing + layout)
- `main.tsx` — Vite entry point
- `setupTests.ts` — Vitest global test setup
- `vite-env.d.ts` — Vite environment types

## Architecture

```
React (port 5174) → CF Workers API (api.alephatx.info) → D1 (SQLite at edge)
```

Database access is via the Workers API, not directly from the frontend.
