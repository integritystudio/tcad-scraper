# TCAD Token Management

TCAD API tokens expire every ~5 minutes. The auto-refresh service handles this automatically.

## How It Works

```
Server Start → Token Refresh Service (every 4.5 min)
                    ↓
              HTTP POST → Cloudflare Worker (TOKEN_WORKER_URL)
                    ↓
              Worker returns { token, expiresIn } → Stored in memory
                    ↓
              Scraper uses refreshed token via tcad-api-client.ts
```

**Token priority** (highest first):
1. Auto-refresh service (`tokenRefreshService.getCurrentToken()`)
2. Environment variable (`TCAD_API_KEY` via Doppler)

## Key Files

| File | Purpose |
|------|---------|
| `src/services/token-refresh.service.ts` | Core auto-refresh logic |
| `src/lib/tcad-api-client.ts` | Token consumption in scraper |
| `src/config/index.ts` | `tcadApiKey`, refresh interval config |
| `src/index.ts` | Service initialization on server start |

## Configuration (via Doppler)

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKEN_WORKER_URL` | required | Cloudflare Worker endpoint URL |
| `TOKEN_WORKER_SECRET` | required | Bearer secret for Worker auth |
| `TCAD_AUTO_REFRESH_TOKEN` | `true` | Enable auto-refresh |
| `TCAD_TOKEN_REFRESH_INTERVAL` | `270000` (4.5 min) | Refresh interval in ms |
| `TCAD_API_KEY` | unset | Manual token fallback |

## Monitoring

```bash
# Production logs
# Check Render service logs in dashboard

# Health endpoint
curl -s https://api.alephatx.info/health | jq '.tokenRefresh'
```

**Healthy**: `Token refreshed successfully in 3245ms (refresh #42)`
**Failing**: `Token refresh failed after 15234ms` (keeps existing token, retries next cycle)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `No TCAD_API_KEY found` | Auto-refresh disabled or failed | Check `TCAD_AUTO_REFRESH_TOKEN=true` in Doppler |
| 401 auth errors | Token expired between refreshes | Reduce `TCAD_TOKEN_REFRESH_INTERVAL` |
| `Token refresh failed` | Worker unreachable or secret mismatch | Check `TOKEN_WORKER_URL` and `TOKEN_WORKER_SECRET` in Doppler |
| Refresh taking >10s | Slow network or Worker down | Check Cloudflare Worker logs in dashboard |
