# Docker

Docker is used for **local development services only** (Redis). Production runs on Render.

## Current Architecture

```
Local Dev:  Redis (Docker) + PostgreSQL (Render) + Node.js (native)
Production: Render (Web Service + Redis + PostgreSQL)
```

**PostgreSQL is on Render** -- there is no local DB container.

## Dev Quick Start

```bash
# Start Redis only
doppler run -- docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml up -d

# Or just Redis standalone
docker run -d --name tcad-redis -p 6379:6379 redis:7-alpine
```

## Compose Files

| File | Purpose |
|------|---------|
| `config/docker-compose.base.yml` | Shared service definitions (Redis, backend, frontend, BullMQ exporter) |
| `config/docker-compose.dev.yml` | Dev overrides (volume mounts, debug ports, Prometheus/Grafana) |
| `config/docker-compose.prod.yml` | Production overrides (resource limits, health checks) |
| `config/docker-compose.monitoring.yml` | Prometheus + Grafana + Node Exporter + cAdvisor |

## Dockerfiles

| File | Description |
|------|-------------|
| `Dockerfile` | Frontend: multi-stage (Vite dev + Nginx prod), Node 20 Alpine |
| `server/Dockerfile` | Backend: multi-stage (tsx dev + compiled prod), includes Playwright/Chromium |
| `bullmq-exporter/Dockerfile` | BullMQ metrics exporter, Node 20 Alpine |

## Management Scripts

```bash
./scripts/docker-dev.sh start|stop|restart|logs|rebuild|clean|migrate|shell|status
./scripts/docker-prod.sh start|stop|restart|logs|rebuild|backup|restore|migrate|status|scale
./scripts/docker-build.sh dev|prod|all
```

## Notes

- All secrets via Doppler: `doppler run -- docker-compose ...`
- Production runs on **Render** (Web Service + managed Redis with TLS + PostgreSQL). Docker is not used in production
- The full Docker stack (frontend + backend + monitoring) exists but is not the primary dev workflow
