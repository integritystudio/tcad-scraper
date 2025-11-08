# Prometheus Monitoring Setup

This guide explains how to set up Prometheus monitoring for the TCAD Scraper application.

## Overview

The TCAD Scraper exposes comprehensive metrics at the `/metrics` endpoint in Prometheus format. These metrics include:

- **HTTP Metrics**: Request counts, response times, status codes
- **Scraper Metrics**: Job counts, durations, properties scraped
- **Queue Metrics**: Queue depth, processing rates
- **Database Metrics**: Query performance, connection pool
- **Cache Metrics**: Hit rates, operation counts
- **External Service Metrics**: TCAD API calls, Claude AI requests
- **Token Refresh Metrics**: Success rates, token age
- **Error Metrics**: Application errors by type and source
- **System Metrics**: Node.js memory, CPU, event loop

## Metrics Endpoint

Access metrics at: `http://localhost:3002/metrics`

Example output:
```
# HELP tcad_scraper_http_requests_total Total number of HTTP requests
# TYPE tcad_scraper_http_requests_total counter
tcad_scraper_http_requests_total{method="GET",route="/api/properties",status_code="200"} 42

# HELP tcad_scraper_http_request_duration_seconds HTTP request duration in seconds
# TYPE tcad_scraper_http_request_duration_seconds histogram
tcad_scraper_http_request_duration_seconds_bucket{method="GET",route="/api/properties",status_code="200",le="0.1"} 35
tcad_scraper_http_request_duration_seconds_bucket{method="GET",route="/api/properties",status_code="200",le="0.3"} 40
...
```

## Installing Prometheus

### macOS (Homebrew)
```bash
brew install prometheus
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install prometheus
```

### Docker
```bash
docker pull prom/prometheus
```

## Configuration

### 1. Create Prometheus Configuration

Create a `prometheus.yml` file:

```yaml
global:
  scrape_interval: 15s     # Scrape targets every 15 seconds
  evaluation_interval: 15s # Evaluate rules every 15 seconds

scrape_configs:
  - job_name: 'tcad-scraper'
    static_configs:
      - targets: ['localhost:3002']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

### 2. Start Prometheus

#### Using Homebrew
```bash
prometheus --config.file=prometheus.yml
```

#### Using Docker
```bash
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

### 3. Verify Setup

1. Start the TCAD Scraper server:
   ```bash
   npm run dev
   ```

2. Visit Prometheus UI: http://localhost:9090

3. Check targets at: http://localhost:9090/targets
   - The `tcad-scraper` target should show as "UP"

4. Query metrics in the Prometheus UI:
   - `tcad_scraper_http_requests_total`
   - `rate(tcad_scraper_http_requests_total[5m])`
   - `tcad_scraper_queue_size`

## Useful Queries

### HTTP Performance
```promql
# Average response time by route (last 5 minutes)
rate(tcad_scraper_http_request_duration_seconds_sum[5m])
  / rate(tcad_scraper_http_request_duration_seconds_count[5m])

# Request rate per second
rate(tcad_scraper_http_requests_total[5m])

# Error rate (4xx and 5xx responses)
rate(tcad_scraper_http_requests_total{status_code=~"4..|5.."}[5m])
```

### Scraper Performance
```promql
# Scrape job success rate
rate(tcad_scraper_jobs_total{status="completed"}[5m])
  / rate(tcad_scraper_jobs_total[5m])

# Average scrape job duration
rate(tcad_scraper_job_duration_seconds_sum[5m])
  / rate(tcad_scraper_job_duration_seconds_count[5m])

# Properties scraped per minute
rate(tcad_scraper_properties_scraped_total[1m]) * 60
```

### Queue Health
```promql
# Current queue depth
tcad_scraper_queue_size

# Queue processing rate
rate(tcad_scraper_queue_processed_total[5m])

# Active scrape jobs
tcad_scraper_active_jobs
```

### Database Performance
```promql
# Database query duration (p95)
histogram_quantile(0.95,
  rate(tcad_scraper_db_query_duration_seconds_bucket[5m]))

# Database query rate
rate(tcad_scraper_db_queries_total[5m])

# Database error rate
rate(tcad_scraper_db_queries_total{status="error"}[5m])
```

### Cache Performance
```promql
# Cache hit rate
tcad_scraper_cache_hit_rate

# Cache operations rate
rate(tcad_scraper_cache_operations_total[5m])

# Cache miss rate
rate(tcad_scraper_cache_operations_total{status="miss"}[5m])
  / rate(tcad_scraper_cache_operations_total{operation="get"}[5m])
```

### System Health
```promql
# Node.js heap usage
nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes

# Event loop lag
nodejs_eventloop_lag_seconds

# Active handles
nodejs_active_handles_total
```

## Grafana Integration

For better visualization, integrate with Grafana:

### 1. Install Grafana

#### macOS
```bash
brew install grafana
brew services start grafana
```

#### Docker
```bash
docker run -d \
  --name grafana \
  -p 3000:3000 \
  grafana/grafana
```

### 2. Configure Data Source

1. Visit Grafana: http://localhost:3000 (default login: admin/admin)
2. Go to Configuration → Data Sources
3. Add Prometheus data source:
   - URL: http://localhost:9090
   - Click "Save & Test"

### 3. Import Dashboard

Create a new dashboard with panels for:

1. **HTTP Performance**
   - Request rate
   - Response time (p50, p95, p99)
   - Error rate

2. **Scraper Metrics**
   - Job success rate
   - Active jobs
   - Properties scraped per hour

3. **Queue Status**
   - Queue depth by status
   - Processing rate
   - Wait times

4. **Database Performance**
   - Query rate
   - Query duration
   - Connection pool usage

5. **Cache Performance**
   - Hit rate
   - Operations per second

6. **System Resources**
   - Memory usage
   - CPU usage
   - Event loop lag

## Alerting

Set up Prometheus alerts in `prometheus.rules.yml`:

```yaml
groups:
  - name: tcad_scraper_alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(tcad_scraper_http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      # Queue backing up
      - alert: QueueBackup
        expr: tcad_scraper_queue_size{status="waiting"} > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Queue is backing up"
          description: "{{ $value }} jobs waiting in queue"

      # Scrape job failures
      - alert: HighScrapeFailureRate
        expr: |
          rate(tcad_scraper_jobs_total{status="failed"}[5m])
          / rate(tcad_scraper_jobs_total[5m]) > 0.2
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High scrape job failure rate"
          description: "Failure rate is {{ $value | humanizePercentage }}"

      # Cache unhealthy
      - alert: LowCacheHitRate
        expr: tcad_scraper_cache_hit_rate < 50
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value }}%"

      # Token refresh failures
      - alert: TokenRefreshFailures
        expr: rate(tcad_scraper_token_refresh_total{status="failure"}[5m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Token refresh failures detected"
          description: "Token refresh is failing"

      # Database slow queries
      - alert: SlowDatabaseQueries
        expr: |
          histogram_quantile(0.95,
            rate(tcad_scraper_db_query_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow database queries detected"
          description: "95th percentile query time is {{ $value }}s"
```

Update `prometheus.yml`:
```yaml
rule_files:
  - "prometheus.rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']
```

## Best Practices

1. **Scrape Interval**: Keep between 10-30 seconds for balance between accuracy and overhead

2. **Data Retention**: Configure based on storage capacity
   ```bash
   prometheus --storage.tsdb.retention.time=30d
   ```

3. **High Cardinality**: Avoid using unbounded label values (like user IDs)

4. **Recording Rules**: Pre-calculate expensive queries
   ```yaml
   - record: tcad:http:request_rate
     expr: rate(tcad_scraper_http_requests_total[5m])
   ```

5. **Dashboard Organization**: Group related metrics together

6. **Alert Tuning**: Adjust thresholds to avoid alert fatigue

## Troubleshooting

### Metrics Not Appearing

1. Check if server is running: `curl http://localhost:3002/health`
2. Check metrics endpoint: `curl http://localhost:3002/metrics`
3. Verify Prometheus is scraping: http://localhost:9090/targets
4. Check Prometheus logs for errors

### High Cardinality Issues

If you see "cardinality is too high" warnings:

1. Review label usage in metrics
2. Avoid using unbounded values in labels
3. Use recording rules to pre-aggregate data

### Performance Impact

To minimize impact:

1. Adjust scrape interval in `prometheus.yml`
2. Disable unnecessary default metrics
3. Use sampling for high-volume metrics

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
- [Node.js Metrics Best Practices](https://github.com/siimon/prom-client#default-metrics)

## Support

For issues or questions:
- GitHub Issues: https://github.com/aledlie/tcad-scraper/issues
- Documentation: See [README.md](../README.md)
