# TCAD Token Management

TCAD API tokens expire every ~5 minutes. The auto-refresh service handles this automatically.

## How It Works

```
Server Start → Token Refresh Service (every 4.5 min)
                    ↓
              Launch headless browser → TCAD search page → Capture Authorization header
                    ↓
              Update in-memory token → Scraper uses refreshed token
```

**Token priority** (highest first):
1. Auto-refresh service (`tokenRefreshService.getCurrentToken()`)
2. Environment variable (`TCAD_API_KEY` via Doppler)
3. Browser capture (fallback, ~7-11s vs 2-4s with token)

## Key Files

| File | Purpose |
|------|---------|
| `src/services/token-refresh.service.ts` | Core auto-refresh logic |
| `src/lib/tcad-scraper.ts` | Token consumption in scraper |
| `src/config/index.ts` | `tcadApiKey`, refresh interval config |
| `src/index.ts` | Service initialization on server start |

## Configuration (via Doppler)

| Variable | Default | Description |
|----------|---------|-------------|
| `TCAD_AUTO_REFRESH_TOKEN` | `true` | Enable auto-refresh |
| `TCAD_TOKEN_REFRESH_INTERVAL` | `270000` (4.5 min) | Refresh interval in ms |
| `TCAD_TOKEN_REFRESH_CRON` | unset | Cron schedule (overrides interval) |
| `TCAD_API_KEY` | unset | Manual token fallback |

## Monitoring

```bash
# Production logs
ssh aledlie@hobbes "pm2 logs tcad-api | grep 'Token refresh'"

# Health endpoint
curl -s https://api.alephatx.info/health | jq '.tokenRefresh'
```

**Healthy**: `Token refreshed successfully in 3245ms (refresh #42)`
**Failing**: `Token refresh failed after 15234ms` (keeps existing token, retries next cycle)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `No TCAD_API_KEY found, capturing...` | Auto-refresh disabled or failed | Check `TCAD_AUTO_REFRESH_TOKEN=true` |
| 401 auth errors | Token expired between refreshes | Reduce `TCAD_TOKEN_REFRESH_INTERVAL` |
| `Browser not found` | Playwright not installed | `npx playwright install chromium` |
| Refresh taking >10s | Slow network or TCAD down | Check https://travis.prodigycad.com accessibility |
