# Quick Start - Monitoring Stack

**5-Minute Setup Guide**

## Start Monitoring

```bash
# 1. Start the stack
docker-compose -f docker-compose.monitoring.yml up -d

# 2. Check status
docker-compose -f docker-compose.monitoring.yml ps
```

## Access Dashboards

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

## Verify It's Working

```bash
# Check Prometheus targets (should be "UP")
open http://localhost:9090/targets

# Check metrics are being collected
curl http://localhost:3002/metrics | head -20
```

## View Dashboards

1. Open Grafana: http://localhost:3000
2. Login: admin/admin (change password)
3. Go to Dashboards → Browse
4. Open:
   - **TCAD Scraper - Overview** (HTTP, scraper, queue metrics)
   - **TCAD Scraper - Code Complexity** (code quality metrics)

## Code Complexity

- Runs automatically every hour
- First analysis: Wait 1 hour after server start
- Check metrics:
  ```bash
  curl http://localhost:3002/metrics | grep complexity
  ```

## Troubleshooting

### Prometheus shows target "DOWN"

**Fix Prometheus config:**

Edit `monitoring/prometheus/prometheus.yml`:

```yaml
# For macOS/Windows Docker Desktop:
- targets: ['host.docker.internal:3002']

# For Linux:
- targets: ['172.17.0.1:3002']  # or your host IP

# For same Docker network:
- targets: ['tcad-scraper:3002']
```

Then reload:
```bash
docker exec tcad-prometheus kill -HUP 1
```

### No metrics in Grafana

1. Check datasource: Configuration → Data Sources → Prometheus
2. Click "Save & Test" (should say "Data source is working")
3. Verify time range (top right of dashboard)

## Complete Documentation

See [MONITORING_DEPLOYMENT.md](./MONITORING_DEPLOYMENT.md) for full guide.

---

**Need Help?** See [SESSION_CONTEXT.md](./SESSION_CONTEXT.md) for implementation details.
