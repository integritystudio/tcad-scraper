# Docker Setup Guide

Complete guide for running TCAD Scraper in Docker containers for both development and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Development Environment](#development-environment)
- [Production Environment](#production-environment)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Migration from Local Development](#migration-from-local-development)

---

## Prerequisites

### Required Software

- **Docker Desktop** 4.20+ or **Docker Engine** 24+
- **Docker Compose** 2.20+ (included with Docker Desktop)
- **Git** (for cloning the repository)

### System Requirements

**Development:**
- RAM: 8GB minimum, 16GB recommended
- Disk: 20GB free space
- CPU: 2+ cores

**Production:**
- RAM: 16GB minimum, 32GB recommended
- Disk: 50GB+ free space
- CPU: 4+ cores

### Verify Installation

```bash
docker --version
# Docker version 24.0.0+

docker-compose --version
# Docker Compose version 2.20.0+
```

---

## Quick Start

### Development Environment (30 seconds)

```bash
# 1. Clone repository (if you haven't already)
git clone <repository-url>
cd tcad-scraper

# 2. Copy environment template
cp .env.docker.example .env

# 3. Edit .env and add required secrets:
#    - TCAD_API_KEY
#    - ANTHROPIC_API_KEY
#    - JWT_SECRET

# 4. Start development environment
./scripts/docker-dev.sh start

# 5. Access services
# Frontend:  http://localhost:5173
# Backend:   http://localhost:3000
# Grafana:   http://localhost:3001 (admin/admin)
```

---

## Architecture Overview

### Docker Services

The application is composed of multiple containerized services:

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network: tcad-network              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Frontend │  │ Backend  │  │PostgreSQL│  │  Redis   │   │
│  │  Nginx/  │  │  Express │  │          │  │ BullMQ   │   │
│  │  Vite    │  │  API     │  │          │  │          │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┴──────────────┴─────────────┘          │
│                          │                                   │
│       ┌──────────────────┴────────────────┐                 │
│       │                                    │                 │
│  ┌────▼────────┐  ┌──────────┐  ┌────────▼─────┐           │
│  │  BullMQ     │  │Prometheus│  │   Grafana    │           │
│  │  Metrics    │  │          │  │  Dashboard   │           │
│  └─────────────┘  └──────────┘  └──────────────┘           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Stage Dockerfiles

All images use multi-stage builds for optimization:

**Frontend Dockerfile:**
- **Stage 1 (dependencies):** Install dependencies
- **Stage 2 (builder):** Build React/Vite app
- **Stage 3 (production):** Nginx serving static files
- **Stage 4 (development):** Vite dev server with HMR

**Backend Dockerfile:**
- **Stage 1 (dependencies):** Production dependencies only
- **Stage 2 (builder):** Build TypeScript, generate Prisma client
- **Stage 3 (production):** Optimized runtime
- **Stage 4 (development):** Development with tsx watch

### Compose File Structure

```
config/
├── docker-compose.base.yml      # Shared service definitions
├── docker-compose.dev.yml       # Development overrides
├── docker-compose.prod.yml      # Production overrides
├── docker-compose.monitoring.yml # Legacy monitoring (kept for compatibility)
└── monitoring/                  # Monitoring configuration files
    ├── prometheus/
    │   ├── prometheus.yml
    │   └── prometheus.rules.yml
    └── grafana/
        └── provisioning/
```

---

## Development Environment

### Starting Development

```bash
./scripts/docker-dev.sh start
```

This command:
1. Pulls/builds all required images
2. Starts all services with development configurations
3. Enables hot reloading for frontend and backend
4. Mounts source code as volumes for live updates

### Available Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React app with Vite HMR |
| Backend | http://localhost:3000 | Express API server |
| PostgreSQL | localhost:5432 | Database (tcad_scraper) |
| Redis | localhost:6379 | Queue backend |
| BullMQ Metrics | http://localhost:4000 | Queue metrics exporter |
| Prometheus | http://localhost:9090 | Metrics collection |
| Grafana | http://localhost:3001 | Monitoring dashboards |

### Development Workflow

**Hot Reloading:**
- Frontend: Edit files in `src/` - changes auto-reload
- Backend: Edit files in `server/src/` - server auto-restarts
- No rebuild needed for code changes

**Database Migrations:**
```bash
# Run migrations
./scripts/docker-dev.sh migrate

# Or manually
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml exec backend npx prisma migrate dev
```

**Viewing Logs:**
```bash
# All services
./scripts/docker-dev.sh logs

# Specific service
./scripts/docker-dev.sh logs backend
./scripts/docker-dev.sh logs frontend
```

**Shell Access:**
```bash
# Backend container
./scripts/docker-dev.sh shell backend

# Frontend container
./scripts/docker-dev.sh shell frontend

# Database
./scripts/docker-dev.sh shell postgres
```

**Service Status:**
```bash
./scripts/docker-dev.sh status
```

**Stopping:**
```bash
./scripts/docker-dev.sh stop
```

**Rebuilding (after Dockerfile changes):**
```bash
./scripts/docker-dev.sh rebuild
```

**Complete Cleanup:**
```bash
# WARNING: Removes all data including databases
./scripts/docker-dev.sh clean
```

---

## Production Environment

### Prerequisites for Production

1. **Environment Variables:** Copy and configure production settings
   ```bash
   cp .env.docker.example .env
   ```

2. **Required Secrets:** Set these in `.env`:
   - `POSTGRES_PASSWORD` - Strong database password
   - `REDIS_PASSWORD` - Redis authentication password
   - `JWT_SECRET` - 32+ character random string
   - `TCAD_API_KEY` - TCAD API token
   - `ANTHROPIC_API_KEY` - Claude AI API key
   - `GRAFANA_ADMIN_PASSWORD` - Grafana admin password

3. **SSL Certificates (optional):** Place in `./ssl/`
   ```
   ssl/
   ├── certificate.crt
   └── private.key
   ```

### Starting Production

```bash
./scripts/docker-prod.sh start
```

### Production Features

**Security:**
- Non-root users in all containers
- Health checks on all services
- No exposed ports (internal network only, except frontend)
- Resource limits enforced
- Redis authentication required

**Resource Management:**
- CPU/Memory limits configured
- Automatic restart policies
- Graceful shutdown handling

**Monitoring:**
- Prometheus metrics collection
- Grafana dashboards
- BullMQ queue monitoring
- Application health checks

### Production Operations

**Viewing Logs:**
```bash
./scripts/docker-prod.sh logs [service]
```

**Service Status & Resource Usage:**
```bash
./scripts/docker-prod.sh status
```

**Database Backup:**
```bash
./scripts/docker-prod.sh backup
# Saves to ./backups/YYYYMMDD_HHMMSS/
```

**Database Restore:**
```bash
./scripts/docker-prod.sh restore ./backups/20240101_120000/postgres.sql
```

**Migrations:**
```bash
./scripts/docker-prod.sh migrate
```

**Scaling Services:**
```bash
# Scale backend to 3 replicas
./scripts/docker-prod.sh scale backend 3
```

**Stopping:**
```bash
./scripts/docker-prod.sh stop
```

**Rebuilding:**
```bash
./scripts/docker-prod.sh rebuild
```

---

## Environment Variables

### Development vs Production

Create `.env` from `.env.docker.example` and customize:

**Development defaults:**
```env
NODE_ENV=development
POSTGRES_PASSWORD=postgres
LOG_LEVEL=debug
FRONTEND_PORT=5173
BACKEND_PORT=3000
```

**Production requirements:**
```env
NODE_ENV=production
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
JWT_SECRET=<32+-char-random-string>
LOG_LEVEL=info
FRONTEND_PORT=80
```

### Critical Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TCAD_API_KEY` | Yes | TCAD API token for scraping |
| `ANTHROPIC_API_KEY` | Yes | Claude AI API key |
| `JWT_SECRET` | Yes (prod) | JWT signing key (32+ chars) |
| `POSTGRES_PASSWORD` | Yes (prod) | Database password |
| `DATABASE_URL` | Auto | Generated from POSTGRES_* vars |

### Using Doppler (Optional)

If you prefer Doppler for secrets management:

```bash
# Install Doppler CLI
# https://docs.doppler.com/docs/install-cli

# Login
doppler login

# Setup project
doppler setup

# Run with Doppler
doppler run -- docker-compose -f config/docker-compose.base.yml -f config/docker-compose.prod.yml up -d
```

---

## Database Migrations

### Development

Migrations run automatically on first start. To create new migrations:

```bash
# Create migration
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml exec backend npx prisma migrate dev --name your_migration_name

# Apply migrations
./scripts/docker-dev.sh migrate
```

### Production

```bash
# Deploy migrations (non-interactive)
./scripts/docker-prod.sh migrate

# Or manually
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Prisma Studio (Database GUI)

```bash
# Development
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml exec backend npx prisma studio
# Access at http://localhost:5555
```

---

## Monitoring

### Accessing Dashboards

**Grafana:**
- Development: http://localhost:3001
- Production: Configure reverse proxy
- Default credentials: admin/admin (change in production)

**Prometheus:**
- Development: http://localhost:9090
- Production: Internal only

**BullMQ Metrics:**
- Development: http://localhost:4000/metrics
- Production: Internal only

### Custom Dashboards

Pre-configured dashboards are in `monitoring/grafana/dashboards/`:
- Queue Performance
- Database Metrics
- API Performance
- System Resources

Import additional dashboards in Grafana UI.

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
./scripts/docker-dev.sh logs <service>

# Check container status
docker ps -a

# Remove and recreate
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml up -d --force-recreate <service>
```

### Port Already in Use

```bash
# Find process using port
lsof -i :5173  # or :3000, :5432, etc.

# Kill process or change port in .env
FRONTEND_PORT=5174
```

### Database Connection Issues

```bash
# Check if PostgreSQL is healthy
docker ps | grep postgres

# Check logs
./scripts/docker-dev.sh logs postgres

# Reset database
./scripts/docker-dev.sh clean
./scripts/docker-dev.sh start
```

### Volume Permission Issues

```bash
# Fix permissions (MacOS/Linux)
sudo chown -R $(whoami):$(whoami) .

# Windows: Run Docker Desktop as Administrator
```

### Out of Memory

```bash
# Check Docker memory allocation
docker info | grep Memory

# Increase in Docker Desktop: Settings → Resources → Memory

# Or reduce service memory limits in docker-compose.prod.yml
```

### Redis Connection Issues

```bash
# Test Redis connection
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml exec redis redis-cli ping
# Should return: PONG

# Check if password is required
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml exec redis redis-cli auth $REDIS_PASSWORD
```

### Slow Build Times

```bash
# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Rebuild
./scripts/docker-build.sh prod
```

---

## Migration from Local Development

### Step 1: Backup Local Data

```bash
# Backup PostgreSQL
pg_dump tcad_scraper > backup_local.sql

# Backup Redis (if needed)
redis-cli SAVE
cp /var/lib/redis/dump.rdb backup_redis.rdb
```

### Step 2: Setup Docker Environment

```bash
# Copy environment
cp .env .env.local.backup
cp .env.docker.example .env

# Update .env with your local settings
```

### Step 3: Import Data

```bash
# Start Docker environment
./scripts/docker-dev.sh start

# Import PostgreSQL backup
cat backup_local.sql | docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml exec -T postgres psql -U postgres tcad_scraper

# Import Redis (if needed)
docker cp backup_redis.rdb tcad-redis:/data/dump.rdb
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml restart redis
```

### Step 4: Verify Migration

```bash
# Check database
./scripts/docker-dev.sh shell postgres
psql -U postgres tcad_scraper
\dt  # List tables
SELECT COUNT(*) FROM properties;

# Check application
curl http://localhost:3000/health
```

### Step 5: Update Development Workflow

**Before (Local):**
```bash
npm install
npm run dev
```

**After (Docker):**
```bash
./scripts/docker-dev.sh start
# Edit code - changes auto-reload
```

---

## Advanced Topics

### Custom Nginx Configuration

Create `nginx.conf` in project root for custom frontend configuration:

```nginx
# Custom Nginx config
server {
    listen 80;
    # Your custom configuration
}
```

Mount in docker-compose:
```yaml
frontend:
  volumes:
    - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
```

### Multi-Platform Builds

Build for multiple architectures:

```bash
# Setup buildx
docker buildx create --use

# Build for AMD64 and ARM64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t tcad-backend:latest \
  --push \
  ./server
```

### CI/CD Integration

Example GitHub Actions:

```yaml
name: Docker Build
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build images
        run: ./scripts/docker-build.sh prod
      - name: Run tests
        run: docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml run backend npm test
```

---

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Documentation: `docs/`
- README: `README.md`

---

## Appendix

### Docker Compose Commands Reference

```bash
# Start services
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml up -d

# Stop services
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml down

# View logs
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml logs -f

# Rebuild service
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml build <service>

# Scale service
docker-compose -f config/docker-compose.base.yml -f config/docker-compose.dev.yml up -d --scale backend=3
```

### Useful Docker Commands

```bash
# List running containers
docker ps

# List all containers
docker ps -a

# Remove all stopped containers
docker container prune

# Remove all unused images
docker image prune -a

# View container logs
docker logs <container-name>

# Execute command in container
docker exec -it <container-name> sh

# Copy file from container
docker cp <container-name>:/path/to/file ./local/path
```
