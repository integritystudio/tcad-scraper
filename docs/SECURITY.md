# Security

CSP, authentication, and security headers for the TCAD Scraper API.

## Content Security Policy (XController Pattern)

Nonce-based CSP Level 3 implementation for secure server-to-client data passing.

### How It Works

1. Server generates a unique nonce per request (`xcontroller.middleware.ts`)
2. Nonce is injected into CSP header and script tags
3. Client reads embedded data via `DataController` class (`xcontroller.client.ts`)
4. Only scripts with the correct nonce execute

### Key Files

| File | Purpose |
|------|---------|
| `server/src/middleware/xcontroller.middleware.ts` | Nonce generation, CSP headers, JSON encoding |
| `server/src/routes/app.routes.ts` | Serves frontend with embedded initial data |
| `src/lib/xcontroller.client.ts` | Client-side `DataController` + React hook |

### Client Usage

```typescript
import { dataController } from './lib/xcontroller.client';
const config = dataController.loadData<InitialAppData>('initial-data');
```

## Security Headers

Set via Helmet in `server/src/index.ts`:

- `Content-Security-Policy` - Nonce-based CSP (managed by xcontroller middleware)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HTTPS only)

## Authentication

| Method | Header | Use Case |
|--------|--------|----------|
| JWT | `Authorization: Bearer <token>` | Production API access |
| API Key | `X-API-Key: <key>` | Service-to-service |
| None | -- | Development (`NODE_ENV=development`) |

Secrets managed via Doppler (`JWT_SECRET`, `API_KEY`).

## Rate Limiting

- `app.set('trust proxy', 1)` required for Render reverse proxy
- Rate limiter uses `X-Forwarded-For` from Cloudflare Tunnel
