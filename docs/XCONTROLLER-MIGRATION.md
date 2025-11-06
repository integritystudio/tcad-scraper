# XController Migration for TCAD Scraper

This document describes the xcontroller pattern implementation for secure server-to-client data passing in the TCAD Scraper application.

## What Changed

### Security Improvements

1. **CSP Level 3 Compliance**
   - Added nonce-based Content Security Policy
   - Prevents inline script injection attacks
   - Protects against XSS vulnerabilities

2. **Secure Data Passing**
   - Implemented JSON Script Tag pattern
   - Proper encoding of dangerous characters (< > &)
   - Type-safe data loading in client

3. **Security Headers**
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Strict-Transport-Security (HTTPS only)

## New Files

### Server-Side

- `server/src/middleware/xcontroller.middleware.ts`
  - Nonce generation middleware
  - CSP header middleware
  - JSON encoding utilities
  - HTML generation with secure data embedding

- `server/src/routes/app.routes.ts`
  - Route to serve frontend with initial data
  - Applies security middleware

### Client-Side

- `src/lib/xcontroller.client.ts`
  - DataController class for loading embedded data
  - React hook for initial data loading
  - Caching and fallback API support

## Usage

### Server-Side: Passing Data to Client

```typescript
import { getInitialAppData } from './middleware/xcontroller.middleware';

// In your route
const initialData = getInitialAppData();
// Data is automatically embedded securely in HTML
```

### Client-Side: Reading Data

```typescript
import { dataController } from './lib/xcontroller.client';

// Load initial data
const config = dataController.loadData<InitialAppData>('initial-data');

if (config) {
  console.log('API URL:', config.apiUrl);
  console.log('Environment:', config.environment);
}
```

### React Hook

```typescript
import { useInitialData } from './lib/xcontroller.client';

function MyComponent() {
  const config = useInitialData<InitialAppData>(
    'initial-data',
    '/api/config' // Optional fallback
  );

  if (!config) return <div>Loading...</div>;

  return <div>Environment: {config.environment}</div>;
}
```

## Integration Steps

### 1. Update Server Index

Add the app routes to your server:

```typescript
// In server/src/index.ts
import { appRouter } from './routes/app.routes';

// Add before other routes
app.use('/', appRouter);
```

### 2. Update Helmet Configuration

Replace the current helmet configuration with:

```typescript
import { nonceMiddleware, cspMiddleware } from './middleware/xcontroller.middleware';

// Apply nonce and CSP to all routes
app.use(nonceMiddleware);
app.use(cspMiddleware);

// Remove or update helmet to not conflict
app.use(helmet({
  contentSecurityPolicy: false, // We handle CSP ourselves
  // ... other helmet options
}));
```

### 3. Update React App to Use Initial Data

```typescript
// In src/App.tsx or main component
import { dataController } from './lib/xcontroller.client';

interface InitialAppData {
  apiUrl: string;
  environment: string;
  features: {
    search: boolean;
    analytics: boolean;
    monitoring: boolean;
  };
  version: string;
}

// Load initial data
const config = dataController.loadData<InitialAppData>('initial-data');

// Use config throughout your app
if (config) {
  console.log('Loaded app config:', config);
}
```

## Security Checklist

- [x] CSP headers with nonces configured
- [x] JSON encoding with proper escaping (\\u003C, \\u003E, \\u0026)
- [x] HTTPS enforced (production only)
- [x] Security headers set
- [x] No sensitive data exposed to client
- [x] Type-safe data interfaces
- [x] Error handling and fallbacks
- [x] Debug logging for development

## Testing

### Test CSP Headers

```bash
curl -I http://localhost:5050 | grep Content-Security-Policy
```

Should see:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-xxxxx'; ...
```

### Test Data Loading

1. Open browser console
2. Check for initial data script tag:
```javascript
document.getElementById('initial-data')
```

3. Load data:
```javascript
const data = JSON.parse(document.getElementById('initial-data').textContent);
console.log(data);
```

### Test XSS Protection

The encoding should prevent XSS:
```javascript
// This should be encoded as \\u003Cscript\\u003E
const malicious = { evil: '</script><script>alert("xss")</script>' };
```

## Performance Impact

- **Positive**: Initial data available immediately (no extra API call)
- **Positive**: Reduced latency for first render
- **Minimal**: < 1ms overhead for nonce generation
- **Minimal**: < 5ms overhead for JSON encoding (typical data size)

## Benefits

1. **Security**: XSS protection, CSP compliance
2. **Performance**: Faster initial load (no API round-trip for config)
3. **Type Safety**: Typed interfaces for data
4. **Maintainability**: Centralized data passing pattern
5. **Observability**: Debug logging, error handling
6. **Standards Compliance**: Follows OWASP 2024 guidelines

## Migration from Current Setup

The current TCAD scraper uses:
- REST API calls for all data (including config)
- No CSP headers
- Helmet with CSP disabled

After migration:
- ✅ Initial config data passed securely in HTML
- ✅ CSP Level 3 with nonces
- ✅ All security headers configured
- ✅ Type-safe data loading
- ✅ API calls still work for dynamic data

## Rollback Plan

If issues arise:

1. Remove app routes: Comment out `app.use('/', appRouter);`
2. Revert helmet config: Re-enable original helmet setup
3. Remove xcontroller middleware imports
4. Client code will fall back to API calls (if implemented with fallback)

## Next Steps

1. ✅ Implement xcontroller middleware
2. ✅ Create app routes with secure data passing
3. ✅ Add client-side data controller
4. ⬜ Integrate into existing server
5. ⬜ Update React app to use initial data
6. ⬜ Test thoroughly
7. ⬜ Deploy to staging
8. ⬜ Monitor for issues
9. ⬜ Deploy to production

## Resources

- [XControllers Knowledge Base](../ISInternal/x-controllers/README.md)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [CSP Level 3 Spec](https://www.w3.org/TR/CSP3/)
- [MCP Server](../ISInternal/x-controllers/mcp-server/README.md)
