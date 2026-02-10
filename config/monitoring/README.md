# Monitoring Configuration

This directory contains configuration files for the Prometheus/Grafana monitoring stack.

## Directory Structure

```
monitoring/
├── README.md (this file)
├── prometheus/
│   ├── prometheus.yml          # Main Prometheus configuration
│   └── prometheus.rules.yml    # Alerting rules
└── grafana/
    ├── provisioning/
    │   ├── datasources/        # Auto-configured data sources
    │   │   └── prometheus.yml
    │   └── dashboards/         # Dashboard provisioning
    │       └── dashboard-provider.yml
    └── dashboards/             # Pre-built dashboards
        ├── tcad-overview.json
        └── code-complexity.json
```

## Quick Start

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Check status
docker-compose -f docker-compose.monitoring.yml ps

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f

# Stop monitoring stack
docker-compose -f docker-compose.monitoring.yml down
```

## Access Points

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **Node Exporter**: http://localhost:9100/metrics
- **cAdvisor**: http://localhost:8080

## Configuration Files

### Prometheus Configuration

**File**: `prometheus/prometheus.yml`

Defines:
- Scrape targets (what to monitor)
- Scrape intervals (how often)
- Alert rule files
- Global settings

**Modify for your environment:**

```yaml
scrape_configs:
  - job_name: 'tcad-scraper-app'
    static_configs:
      - targets:
          # Update based on your setup:
          - 'host.docker.internal:3002'  # macOS/Windows
          # - 'tcad-scraper:3002'        # Docker network
          # - '192.168.1.100:3002'       # Host IP
```

### Alert Rules

**File**: `prometheus/prometheus.rules.yml`

Defines alert conditions for:
- HTTP errors (5xx, 4xx)
- Slow responses
- Scrape failures
- Queue backlog
- Database performance
- Cache health
- Token refresh issues
- Code complexity warnings
- System resources

**Customize thresholds:**

```yaml
- alert: HighServerErrorRate
  expr: |
    (sum(rate(tcad_scraper_http_requests_total{status_code=~"5.."}[5m]))
     / sum(rate(tcad_scraper_http_requests_total[5m]))) > 0.05  # 5%
  for: 5m
```

### Grafana Datasources

**File**: `grafana/provisioning/datasources/prometheus.yml`

Auto-configures Prometheus as a datasource on Grafana startup.

### Grafana Dashboards

**Directory**: `grafana/dashboards/`

Pre-built dashboards:

1. **tcad-overview.json** - Application overview
   - HTTP metrics
   - Scraper performance
   - Queue status
   - System health

2. **code-complexity.json** - Code quality metrics
   - Cyclomatic complexity
   - Lines of code
   - File and function counts
   - Maintainability index

**Importing additional dashboards:**

1. Visit Grafana
2. Click **+ → Import**
3. Upload JSON file or paste JSON
4. Select Prometheus datasource

## Customization

### Adding New Metrics

1. **In application code**:
   ```typescript
   import { Gauge } from 'prom-client';

   const myMetric = new Gauge({
     name: 'my_custom_metric',
     help: 'Description of metric',
     registers: [register],
   });

   myMetric.set(42);
   ```

2. **In Prometheus** - metrics are auto-discovered

3. **In Grafana** - create panel with query:
   ```promql
   my_custom_metric
   ```

### Adding New Alerts

Edit `prometheus/prometheus.rules.yml`:

```yaml
- alert: MyCustomAlert
  expr: my_metric > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Custom alert triggered"
    description: "Value is {{ $value }}"
```

Reload Prometheus:
```bash
docker exec tcad-prometheus kill -HUP 1
```

### Creating New Dashboards

1. **In Grafana UI**:
   - Create and configure dashboard
   - Click **Share → Export**
   - Save JSON to `grafana/dashboards/`

2. **Provisioning** (auto-load):
   - Place JSON in `grafana/dashboards/`
   - Restart Grafana: `docker restart tcad-grafana`

## Data Retention

Prometheus retains metrics for 30 days by default.

**To change retention**:

Edit `docker-compose.monitoring.yml`:

```yaml
prometheus:
  command:
    - '--storage.tsdb.retention.time=90d'  # 90 days
```

**Storage requirements**:
- ~5GB per month for TCAD Scraper metrics
- Scale proportionally with data retention

## Troubleshooting

### No metrics showing

```bash
# Check if Prometheus can scrape metrics
curl http://localhost:3002/metrics

# Check Prometheus targets
open http://localhost:9090/targets

# View Prometheus logs
docker logs tcad-prometheus
```

### Grafana shows "No data"

1. Check datasource: Configuration → Data Sources
2. Test connection: Click "Save & Test"
3. Verify time range in dashboard
4. Check query syntax

### Alerts not firing

```bash
# Check alert rules are loaded
open http://localhost:9090/rules

# Check alert evaluation
open http://localhost:9090/alerts

# View Prometheus logs
docker logs tcad-prometheus | grep -i alert
```

## Security Notes

**For production deployments:**

1. **Change default passwords**:
   ```bash
   # Set in .env
   GRAFANA_ADMIN_PASSWORD=strong-password
   ```

2. **Enable authentication**:
   - Prometheus: Use reverse proxy with auth
   - Grafana: Enable OAuth/LDAP

3. **Restrict access**:
   ```yaml
   # Bind to localhost only
   ports:
     - "127.0.0.1:9090:9090"
   ```

4. **Use HTTPS**:
   - Deploy behind nginx/Traefik
   - Configure SSL certificates

## Backup

**Prometheus data**:
```bash
docker cp tcad-prometheus:/prometheus ./backup/prometheus-$(date +%Y%m%d)
```

**Grafana dashboards**:
- Already version-controlled in this directory
- Export from UI: Dashboard Settings → JSON Model

## Support

See main documentation:
- [MONITORING_DEPLOYMENT.md](../MONITORING_DEPLOYMENT.md) - Complete deployment guide
- [PROMETHEUS_SETUP.md](../server/PROMETHEUS_SETUP.md) - Metrics setup
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture

---

**Version**: 1.0
**Last Updated**: November 8, 2025
