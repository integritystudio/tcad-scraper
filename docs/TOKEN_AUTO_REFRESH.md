# TCAD Token Auto-Refresh System

## Overview

The TCAD Token Auto-Refresh system automatically captures and refreshes the TCAD API authentication token every 4-5 minutes, ensuring your scraper always has a valid token without manual intervention.

---

## Features

✅ **Automatic Token Refresh**
- Runs in the background on a configurable schedule
- Default: Every 4.5 minutes
- Customizable via interval or cron schedule

✅ **Zero Manual Intervention**
- No need to manually capture tokens
- No need to update .env file
- Works seamlessly with existing scraper

✅ **Resilient & Reliable**
- Keeps existing token if refresh fails
- Tracks success/failure rates
- Continues operating even after failures

✅ **Monitoring & Health Checks**
- Real-time statistics
- Health check endpoint
- Detailed logging

---

## How It Works

### Architecture

```
Server Startup
    ↓
Initialize Token Refresh Service
    ↓
Start Auto-Refresh Schedule (every 4.5 min)
    ↓
    ├─→ Launch Browser (headless)
    ├─→ Navigate to TCAD search page
    ├─→ Perform test search
    ├─→ Capture Authorization header
    ├─→ Update in-memory token
    └─→ Close browser context
    ↓
Scraper Uses Refreshed Token
    ↓
Repeat Every 4.5 Minutes
```

### Token Priority

When a scrape job runs, it checks for tokens in this order:

1. **Auto-Refresh Service** (if enabled) ← Highest priority
2. **Environment Variable** (`TCAD_API_KEY`)
3. **Browser Capture** (fallback)

---

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Enable auto-refresh (default: true)
TCAD_AUTO_REFRESH_TOKEN=true

# Refresh interval in milliseconds (default: 270000 = 4.5 minutes)
TCAD_TOKEN_REFRESH_INTERVAL=270000

# OR use cron schedule (takes precedence over interval if set)
# Examples:
#   */4 * * * *  = Every 4 minutes
#   */5 * * * *  = Every 5 minutes
#   0 */1 * * *  = Every hour at minute 0
TCAD_TOKEN_REFRESH_CRON=*/4 * * * *
```

### Default Settings

If you don't add these variables, the system uses these defaults:

- **Auto-Refresh**: `true` (enabled)
- **Interval**: `270000ms` (4.5 minutes)
- **Cron**: Not set (uses interval instead)

---

## Usage

### Starting the Server

The token refresh service starts automatically when you launch the server:

```bash
npm run dev
# or
npm start
```

You'll see in the logs:

```
Starting TCAD token auto-refresh service...
Token refresh scheduled every 4.5 minutes
Starting token refresh...
Token refreshed successfully in 3245ms (refresh #1)
```

### Monitoring Token Refresh

#### Check Logs

Watch for refresh messages:

```bash
# Follow logs in real-time
pm2 logs

# Look for these messages:
# ✅ "Token refreshed successfully in 3245ms"
# ⚠️ "Token refresh failed after 5432ms"
```

#### Health Check Endpoint

```bash
curl http://localhost:5050/health/token
```

Response:

```json
{
  "status": "healthy",
  "tokenRefresh": {
    "healthy": true,
    "hasToken": true,
    "lastRefresh": "2025-11-06T12:34:56.789Z",
    "timeSinceLastRefresh": 123456,
    "refreshCount": 42,
    "failureCount": 0,
    "failureRate": "0%",
    "isRefreshing": false,
    "isAutoRefreshRunning": true,
    "currentToken": "Bearer_ey..."
  }
}
```

#### Test Manually

```bash
npm run test:token-refresh
```

This will:
1. Check initial configuration
2. Perform a manual token refresh
3. Display statistics
4. Run auto-refresh for 30 seconds (demo)
5. Show health metrics

---

## API Integration

### In Your Scraper Code

The scraper automatically uses tokens from the refresh service:

```typescript
// src/lib/tcad-scraper.ts

// Priority 1: Check auto-refresh service
if (appConfig.scraper.autoRefreshToken) {
  authToken = tokenRefreshService.getCurrentToken();
  if (authToken) {
    logger.info('Using token from auto-refresh service');
  }
}

// Priority 2: Fall back to config
if (!authToken) {
  authToken = appConfig.scraper.tcadApiKey || null;
}

// Priority 3: Browser capture (last resort)
if (!authToken) {
  // Capture from browser...
}
```

### Programmatic Access

You can also access the service directly:

```typescript
import { tokenRefreshService } from './services/token-refresh.service';

// Get current token
const token = tokenRefreshService.getCurrentToken();

// Manual refresh
const newToken = await tokenRefreshService.refreshToken();

// Get statistics
const stats = tokenRefreshService.getStats();

// Get health status
const health = tokenRefreshService.getHealth();
```

---

## Monitoring & Troubleshooting

### Success Indicators

✅ **Healthy System:**

```
Token refresh service initialized
Token refresh scheduled every 4.5 minutes
Token refreshed successfully in 3245ms (refresh #1)
Token refreshed successfully in 2987ms (refresh #2)
Token refreshed successfully in 3123ms (refresh #3)
```

### Warning Signs

⚠️ **Potential Issues:**

```
Token refresh failed after 15234ms (failure #1)
Keeping existing token after refresh failure
```

### Common Issues

#### Issue: "Browser not found"

**Cause:** Playwright browser not installed

**Solution:**
```bash
npx playwright install chromium
```

#### Issue: "Failed to capture authorization token"

**Cause:** TCAD website structure changed or is temporarily unavailable

**Solution:**
- Check if https://travis.prodigycad.com is accessible
- Verify the search functionality works manually
- The system will keep using the old token until next refresh succeeds

#### Issue: "Token refresh taking too long"

**Cause:** Slow network or TCAD server response

**Solution:**
- Check network connectivity
- Increase `SCRAPER_TIMEOUT` in config
- Service will continue with existing token

---

## Performance Impact

### Resource Usage

**Per Refresh Cycle (every 4.5 minutes):**
- Browser Init: ~1-2 seconds
- Page Load: ~2-3 seconds
- Token Capture: ~1 second
- **Total:** ~4-6 seconds of activity
- **Idle Time:** ~264 seconds (4.4 minutes)

**Memory:**
- Browser: ~100-200MB during refresh
- Service: ~5-10MB when idle

**CPU:**
- Spike during refresh (~10-20% for 5 seconds)
- Idle between refreshes (~0%)

### Optimization

The service is optimized for minimal impact:
- Browser only runs during refresh (5-6 seconds)
- Context closes immediately after token capture
- Randomized delays prevent detection patterns
- Shared browser instance across refreshes

---

## Advanced Configuration

### Custom Cron Schedule

Use cron syntax for precise scheduling:

```bash
# Every 4 minutes
TCAD_TOKEN_REFRESH_CRON=*/4 * * * *

# Every 5 minutes
TCAD_TOKEN_REFRESH_CRON=*/5 * * * *

# Every 10 minutes
TCAD_TOKEN_REFRESH_CRON=*/10 * * * *

# At minute 0 and 30 of every hour
TCAD_TOKEN_REFRESH_CRON=0,30 * * * *

# Every 3 minutes on weekdays only
TCAD_TOKEN_REFRESH_CRON=*/3 * * * 1-5
```

### Disable Auto-Refresh

To disable auto-refresh and use manual tokens:

```bash
TCAD_AUTO_REFRESH_TOKEN=false
TCAD_API_KEY=Bearer_your_manual_token
```

### Custom Interval

```bash
# Every 3 minutes (180000ms)
TCAD_TOKEN_REFRESH_INTERVAL=180000

# Every 10 minutes (600000ms)
TCAD_TOKEN_REFRESH_INTERVAL=600000
```

---

## Testing

### Run Full Test Suite

```bash
npm run test:token-refresh
```

**Output:**
```
=== TCAD Token Auto-Refresh Service Test ===

Test 1: Initial State
---------------------
Current Token: None
Last Refresh: Never
Refresh Count: 0
Failure Count: 0
Is Running: false

Test 2: Manual Token Refresh
-----------------------------
⏳ Refreshing token (this may take 5-10 seconds)...

✅ Token refreshed successfully in 3245ms
Token preview: Bearer_ey...

Test 3: Statistics After Refresh
---------------------------------
Current Token: Bearer_ey...
Last Refresh: 2025-11-06T12:34:56.789Z
Refresh Count: 1
Failure Count: 0

...
```

### Quick Health Check

```bash
# Check if service is running
curl http://localhost:5050/health/token | jq

# Monitor logs
pm2 logs | grep "Token refresh"

# Check configuration
npm run test:token-config
```

---

## Production Deployment

### Checklist

- [ ] Environment variables configured
- [ ] Browser dependencies installed (`npx playwright install chromium`)
- [ ] Server restarted to load new config
- [ ] Health endpoint responding
- [ ] First token refresh successful
- [ ] Logs showing regular refreshes

### Monitoring

Set up alerts for:
- Failure rate > 20%
- No successful refresh in 30 minutes
- Health endpoint returning unhealthy

### Log Examples

**Successful Deployment:**
```
[2025-11-06 12:00:00] Starting TCAD token auto-refresh service...
[2025-11-06 12:00:00] Token refresh scheduled every 4.5 minutes
[2025-11-06 12:00:03] Token refreshed successfully in 3245ms (refresh #1)
[2025-11-06 12:04:33] Token refreshed successfully in 2987ms (refresh #2)
[2025-11-06 12:09:03] Token refreshed successfully in 3123ms (refresh #3)
```

---

## Comparison: Before vs. After

### Without Auto-Refresh

```
User Action Required:
  1. Open browser
  2. Navigate to TCAD
  3. Open DevTools
  4. Perform search
  5. Find API request
  6. Copy token
  7. Update .env file
  8. Restart server

Frequency: Every time token expires (unknown interval)
Manual Effort: 5-10 minutes per refresh
```

### With Auto-Refresh

```
User Action Required:
  1. Enable TCAD_AUTO_REFRESH_TOKEN=true
  2. Start server

Frequency: Automatic every 4.5 minutes
Manual Effort: 0 minutes
```

---

## FAQ

**Q: Will this interfere with my scraping jobs?**
A: No. The refresh service runs in a separate browser instance and doesn't conflict with scraping operations.

**Q: What happens if token refresh fails?**
A: The service keeps using the existing token and tries again on the next cycle. Scraping continues normally.

**Q: Can I disable auto-refresh?**
A: Yes, set `TCAD_AUTO_REFRESH_TOKEN=false` in your .env file.

**Q: How do I know if it's working?**
A: Check logs for "Token refreshed successfully" or visit `/health/token` endpoint.

**Q: Does this increase TCAD server load?**
A: Minimal. One lightweight page load every 4.5 minutes, much less than continuous scraping.

**Q: Can I use a different refresh interval?**
A: Yes, set `TCAD_TOKEN_REFRESH_INTERVAL` in milliseconds or use `TCAD_TOKEN_REFRESH_CRON` for cron syntax.

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/services/token-refresh.service.ts` | Core refresh logic |
| `src/config/index.ts` | Configuration settings |
| `src/lib/tcad-scraper.ts` | Token consumption |
| `src/index.ts` | Service initialization |
| `src/scripts/test-token-refresh.ts` | Testing script |

---

## Related Documentation

- [API Token Setup](./TCAD_API_TOKEN_SETUP.md) - Manual token configuration
- [API Token Verification](./API_TOKEN_VERIFICATION.md) - Token system details
- [Configuration Reference](../server/src/config/index.ts) - All config options

---

**Status:** ✅ Production Ready
**Version:** 1.0.0
**Last Updated:** 2025-11-06
