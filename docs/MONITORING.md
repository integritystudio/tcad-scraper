# Monitoring

Prometheus + Grafana stack for metrics collection and visualization.

## Architecture

```
TCAD API (prom-client) → /metrics endpoint
                              ↓
                         Prometheus (scrape every 10-15s)
                              ↓
                         Grafana (dashboards + alerts)

Additional exporters: Node Exporter (system), cAdvisor (containers), BullMQ Exporter (queue)
```

## Quick Start

```bash
docker-compose -f config/docker-compose.monitoring.yml up -d
```

| Service | URL | Credentials |
|---------|-----|-------------|
| Prometheus | http://localhost:9090 | -- |
| Grafana | http://localhost:3001 | admin/admin |
| App Metrics | http://localhost:3000/metrics | -- |
| BullMQ Metrics | http://localhost:4000/metrics | -- |

## Metrics Collected

**Application** (via `prom-client` in `server/src/lib/metrics.service.ts`):
- HTTP requests (rate, duration, status codes)
- Scraper jobs (success/failure, duration, properties scraped)
- Queue status (depth, processing rate, active jobs)
- Database performance (query duration, connection pool)
- Cache performance (hit rate)
- Token refresh (success/failure, age)
- Code complexity (cyclomatic, LOC, maintainability index)

**System**: Node Exporter (CPU, memory, disk), cAdvisor (container metrics)

## Pre-built Dashboards

- **TCAD Overview** (`config/monitoring/grafana/dashboards/tcad-overview.json`) - HTTP, scraper, queue, cache, token, heap, event loop
- **Code Complexity** (`config/monitoring/grafana/dashboards/code-complexity.json`) - Cyclomatic complexity, LOC trends, top files

## Alert Rules

Defined in `config/monitoring/prometheus/prometheus.rules.yml`:

| Alert | Threshold |
|-------|-----------|
| High error rate | > 5% server errors |
| Scrape failures | > 20% failure rate |
| Queue backlog | > 500 waiting jobs |
| Token refresh failures | Consecutive failures |
| Slow responses | p95 > 3s |
| High memory | > 90% usage |
| High complexity | Cyclomatic > 20 |

## Key Files

| File | Purpose |
|------|---------|
| `config/docker-compose.monitoring.yml` | Stack definition |
| `config/monitoring/prometheus/prometheus.yml` | Scrape config |
| `config/monitoring/prometheus/prometheus.rules.yml` | Alert rules |
| `config/monitoring/grafana/provisioning/` | Auto-configured datasources + dashboards |
| `server/src/lib/metrics.service.ts` | Application metrics registration |
| `server/src/services/code-complexity.service.ts` | Hourly codebase analysis |

## PromQL Examples

```promql
rate(tcad_scraper_http_requests_total[5m])                    # Request rate
rate(tcad_scraper_http_request_duration_seconds_sum[5m])
  / rate(tcad_scraper_http_request_duration_seconds_count[5m]) # Avg response time
tcad_scraper_code_complexity_cyclomatic                        # Code complexity
```
