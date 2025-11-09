# Monitoring Stack Deployment Guide

**Last Updated:** November 8, 2025

This guide provides step-by-step instructions for deploying the complete Prometheus/Grafana monitoring stack for the TCAD Scraper application.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [Code Complexity Monitoring](#code-complexity-monitoring)
- [Dashboards](#dashboards)
- [Alerting](#alerting)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

## Overview

The monitoring stack includes:

- **Prometheus** - Time-series database for metrics collection
- **Grafana** - Visualization and dashboarding
- **Node Exporter** - System-level metrics
- **cAdvisor** - Container-level metrics
- **Code Complexity Analyzer** - Automated codebase quality tracking

### Architecture

```
┌─────────────────┐
│  TCAD Scraper   │
│   Application   │──┐
└─────────────────┘  │
                     │ /metrics
┌─────────────────┐  │
│  Node Exporter  │──┼──► ┌──────────────┐     ┌──────────────┐
└─────────────────┘  │    │  Prometheus  │────►│   Grafana    │
                     │    └──────────────┘     └──────────────┘
┌─────────────────┐  │           │                     │
│    cAdvisor     │──┘           │              Dashboards &
└─────────────────┘              │                 Alerts
                           Alerting Rules
```

## Prerequisites

- Docker and Docker Compose installed
- TCAD Scraper application running
- At least 2GB free disk space for metrics storage
- Network access between containers

## Quick Start

### 1. Start the Monitoring Stack

```bash
# From the project root
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2. Verify Services

```bash
# Check container status
docker-compose -f docker-compose.monitoring.yml ps

# Expected output:
# NAME                   STATUS
# tcad-prometheus        Up
# tcad-grafana           Up
# tcad-node-exporter     Up
# tcad-cadvisor          Up
```

### 3. Access Interfaces

- **Prometheus UI**: http://localhost:9090
- **Grafana**: http://localhost:3000 (default: admin/admin)
- **TCAD Scraper Metrics**: http://localhost:3002/metrics

### 4. Configure Prometheus Target

Edit `monitoring/prometheus/prometheus.yml` and update the scraper target:

```yaml
scrape_configs:
  - job_name: 'tcad-scraper-app'
    static_configs:
      - targets:
          # Choose the appropriate option for your setup:
          - 'host.docker.internal:3002'  # macOS/Windows Docker Desktop
          # - 'tcad-scraper:3002'          # If app is in same Docker network
          # - 'localhost:3002'             # If running outside Docker
```

Reload Prometheus configuration:

```bash
docker exec tcad-prometheus kill -HUP 1
```

### 5. Verify Metrics Collection

Visit Prometheus UI (http://localhost:9090) and navigate to:
- **Status → Targets** - All targets should show "UP"
- **Graph** - Run query: `tcad_scraper_http_requests_total`

## Detailed Setup

### Directory Structure

```
monitoring/
├── prometheus/
│   ├── prometheus.yml          # Main Prometheus configuration
│   └── prometheus.rules.yml    # Alerting rules
└── grafana/
    ├── provisioning/
    │   ├── datasources/        # Auto-configured data sources
    │   │   └── prometheus.yml
    │   └── dashboards/         # Dashboard provisioning config
    │       └── dashboard-provider.yml
    └── dashboards/             # Pre-built dashboard JSONs
        ├── tcad-overview.json
        └── code-complexity.json
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Grafana Admin Credentials (CHANGE IN PRODUCTION!)
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your-secure-password

# Grafana URL (for external access)
GRAFANA_ROOT_URL=http://your-domain.com:3000
```

### Network Configuration

The monitoring stack creates a dedicated Docker network:

```yaml
networks:
  monitoring:
    driver: bridge
    name: tcad-monitoring
```

To connect your TCAD Scraper application to this network:

```bash
docker network connect tcad-monitoring tcad-scraper
```

Or in your `docker-compose.yml`:

```yaml
networks:
  - tcad-monitoring

networks:
  tcad-monitoring:
    external: true
```

## Configuration

### Prometheus Configuration

**File**: `monitoring/prometheus/prometheus.yml`

Key sections:

#### Global Settings

```yaml
global:
  scrape_interval: 15s      # How often to scrape targets
  evaluation_interval: 15s  # How often to evaluate rules
```

#### Scrape Configs

Configure what endpoints Prometheus scrapes:

```yaml
scrape_configs:
  - job_name: 'tcad-scraper-app'
    scrape_interval: 10s       # Override global interval
    metrics_path: '/metrics'   # Endpoint path
    static_configs:
      - targets: ['host.docker.internal:3002']
```

#### Data Retention

Adjust retention period via Docker Compose:

```yaml
command:
  - '--storage.tsdb.retention.time=30d'  # Keep data for 30 days
```

### Grafana Configuration

**Auto-provisioned on startup:**

1. **Prometheus Datasource** - `monitoring/grafana/provisioning/datasources/prometheus.yml`
2. **Dashboards** - `monitoring/grafana/provisioning/dashboards/dashboard-provider.yml`

**Manual configuration:**

1. Login to Grafana: http://localhost:3000
2. Change default password (admin/admin)
3. Go to Configuration → Data Sources
4. Verify "Prometheus" datasource is connected

## Code Complexity Monitoring

The TCAD Scraper includes automated code complexity analysis that runs every hour.

### Metrics Collected

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `tcad_scraper_code_complexity_cyclomatic` | Average cyclomatic complexity | > 20 (warning) |
| `tcad_scraper_code_complexity_max_cyclomatic` | Highest complexity in codebase | > 30 (critical) |
| `tcad_scraper_code_complexity_total_lines` | Total lines of code | Trending |
| `tcad_scraper_code_complexity_maintainability_index` | Maintainability score (0-100) | < 50 (warning) |
| `tcad_scraper_code_complexity_technical_debt_ratio` | Technical debt percentage | > 50% (warning) |

### Configuration

Edit `server/src/index.ts` to adjust analysis frequency:

```typescript
startPeriodicAnalysis({
  updateIntervalMs: 3600000, // 1 hour (default)
  // updateIntervalMs: 86400000, // Daily for production
});
```

### Viewing Code Complexity

1. Open Grafana: http://localhost:3000
2. Navigate to: **Dashboards → TCAD Scraper → Code Complexity**
3. View metrics:
   - Average and max cyclomatic complexity
   - Code growth trends
   - Largest files
   - Maintainability index

## Dashboards

### Overview Dashboard

**URL**: http://localhost:3000/d/tcad-overview

**Panels:**
- HTTP requests per minute
- HTTP success rate
- Response time percentiles (p50, p95, p99)
- Scrape job rates
- Queue status
- Cache hit rate
- TCAD token age
- Node.js heap usage
- Event loop lag

### Code Complexity Dashboard

**URL**: http://localhost:3000/d/tcad-code-complexity

**Panels:**
- Average cyclomatic complexity gauge
- Total lines of code
- Total files count
- Largest function size
- Code growth over time
- Complexity trends
- Codebase structure (files, functions, classes)
- Top 10 largest files

### Creating Custom Dashboards

1. In Grafana, click **+ → Create Dashboard**
2. Add Panel
3. Select Prometheus data source
4. Enter PromQL query (examples below)
5. Configure visualization
6. Save dashboard

**Example PromQL Queries:**

```promql
# HTTP request rate
rate(tcad_scraper_http_requests_total[5m])

# Average response time
rate(tcad_scraper_http_request_duration_seconds_sum[5m])
  / rate(tcad_scraper_http_request_duration_seconds_count[5m])

# Error rate percentage
(sum(rate(tcad_scraper_http_requests_total{status_code=~"5.."}[5m]))
  / sum(rate(tcad_scraper_http_requests_total[5m]))) * 100

# Code complexity trend
tcad_scraper_code_complexity_cyclomatic
```

## Alerting

### Alert Rules

**File**: `monitoring/prometheus/prometheus.rules.yml`

**Critical Alerts:**
- High server error rate (> 5%)
- High scrape job failure rate (> 20%)
- Queue critically backed up (> 500 jobs)
- Token refresh failures
- High database error rate (> 5%)

**Warning Alerts:**
- Slow HTTP responses (p95 > 3s)
- Queue backing up (> 100 jobs)
- Low cache hit rate (< 50%)
- High memory usage (> 90%)
- High event loop lag (> 1s)
- High cyclomatic complexity (> 20)

### Alert Configuration

To enable alerting:

1. **Install Alertmanager** (optional):

```yaml
# Add to docker-compose.monitoring.yml
alertmanager:
  image: prom/alertmanager:latest
  ports:
    - "9093:9093"
  volumes:
    - ./monitoring/alertmanager/config.yml:/etc/alertmanager/config.yml
```

2. **Configure Alert Destinations**:

Create `monitoring/alertmanager/config.yml`:

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  receiver: 'email'

receivers:
  - name: 'email'
    email_configs:
      - to: 'your-email@example.com'
        from: 'alertmanager@example.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'your-email@example.com'
        auth_password: 'your-app-password'
```

3. **Update Prometheus Config**:

```yaml
# In prometheus.yml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

### Viewing Alerts

- **Prometheus Alerts**: http://localhost:9090/alerts
- **Alertmanager**: http://localhost:9093 (if configured)

## Troubleshooting

### Metrics Not Appearing

**Problem**: No metrics showing in Prometheus

**Solutions**:
1. Check TCAD Scraper is running: `curl http://localhost:3002/health`
2. Check metrics endpoint: `curl http://localhost:3002/metrics`
3. Verify Prometheus targets: http://localhost:9090/targets
4. Check Prometheus logs: `docker logs tcad-prometheus`
5. Verify network connectivity: `docker network inspect tcad-monitoring`

### Prometheus Can't Reach Application

**Problem**: Target shows as "DOWN" in Prometheus

**Solutions**:
1. **For Docker Desktop (macOS/Windows)**: Use `host.docker.internal:3002`
2. **For Linux Docker**: Use host IP or join same network
3. **For Docker Compose**: Ensure same network and use service name

Example network configuration:

```bash
# Connect TCAD Scraper to monitoring network
docker network connect tcad-monitoring <your-app-container>
```

### Grafana Dashboards Not Loading

**Problem**: Dashboards show "No data"

**Solutions**:
1. Check Prometheus datasource: Configuration → Data Sources
2. Test datasource connection (should show "Data source is working")
3. Verify time range (top-right corner)
4. Check query in panel settings

### High Memory Usage

**Problem**: Prometheus using too much memory

**Solutions**:
1. Reduce retention time:
   ```yaml
   command:
     - '--storage.tsdb.retention.time=7d'  # Instead of 30d
   ```
2. Reduce scrape frequency in `prometheus.yml`
3. Use recording rules for expensive queries

### Code Complexity Metrics Missing

**Problem**: Code complexity metrics not showing

**Solutions**:
1. Check TCAD Scraper logs for analysis errors
2. Verify `code-complexity.service.ts` is running
3. Wait for first analysis cycle (runs hourly)
4. Manually trigger: Call `analyzeCodebase()` in code

## Production Deployment

### Security Hardening

1. **Change Default Passwords**:
   ```bash
   # Set in .env file
   GRAFANA_ADMIN_PASSWORD=strong-random-password
   ```

2. **Enable Authentication**:
   ```yaml
   # In prometheus.yml
   basic_auth:
     username: 'prometheus'
     password: 'secure-password'
   ```

3. **Use HTTPS**:
   - Deploy behind reverse proxy (nginx, Traefik)
   - Configure SSL/TLS certificates
   - Enable HTTPS in Grafana

4. **Network Security**:
   ```yaml
   # Restrict port exposure
   ports:
     - "127.0.0.1:9090:9090"  # Only localhost
   ```

### Scalability

1. **Horizontal Scaling**:
   - Run multiple Prometheus instances
   - Use Prometheus federation
   - Configure Thanos for long-term storage

2. **Resource Limits**:
   ```yaml
   # In docker-compose.monitoring.yml
   prometheus:
     deploy:
       resources:
         limits:
           cpus: '2'
           memory: 4G
   ```

3. **Persistent Storage**:
   ```yaml
   volumes:
     prometheus-data:
       driver: local
       driver_opts:
         type: none
         o: bind
         device: /mnt/prometheus-data
   ```

### Backup and Recovery

1. **Prometheus Data**:
   ```bash
   # Backup
   docker cp tcad-prometheus:/prometheus ./prometheus-backup

   # Restore
   docker cp ./prometheus-backup tcad-prometheus:/prometheus
   ```

2. **Grafana Dashboards**:
   - Dashboards are version-controlled in `monitoring/grafana/dashboards/`
   - Provisioning ensures consistency across deployments

### Monitoring the Monitors

Set up external monitoring:

1. **Uptime monitoring** (e.g., UptimeRobot)
2. **Prometheus self-monitoring**:
   ```promql
   up{job="prometheus"}
   prometheus_engine_query_duration_seconds
   ```
3. **Grafana health checks**:
   ```bash
   curl http://localhost:3000/api/health
   ```

## Best Practices

1. **Regular Review**: Check dashboards weekly for trends
2. **Alert Tuning**: Adjust thresholds to reduce noise
3. **Documentation**: Keep runbooks for common alerts
4. **Capacity Planning**: Monitor growth trends
5. **Code Quality**: Act on complexity warnings early
6. **Data Retention**: Balance storage vs. history needs
7. **Testing**: Test alert rules in non-production

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Alerting Best Practices](https://prometheus.io/docs/practices/alerting/)
- [TCAD Scraper Architecture](./ARCHITECTURE.md)
- [Prometheus Setup Guide](./server/PROMETHEUS_SETUP.md)

## Support

For issues or questions:
- GitHub Issues: https://github.com/aledlie/tcad-scraper/issues
- Documentation: [README.md](./README.md)

---

**Version**: 1.0
**Last Updated**: November 8, 2025
**Maintainer**: @aledlie
