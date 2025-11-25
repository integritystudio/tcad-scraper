# Docker Quick Reference

Quick command reference for TCAD Scraper Docker operations.

## 🚀 Common Commands

### Development

```bash
# Start development environment
./scripts/docker-dev.sh start

# Stop development environment
./scripts/docker-dev.sh stop

# View logs (all services)
./scripts/docker-dev.sh logs

# View logs (specific service)
./scripts/docker-dev.sh logs backend
./scripts/docker-dev.sh logs frontend

# Restart everything
./scripts/docker-dev.sh restart

# Open shell in container
./scripts/docker-dev.sh shell backend
./scripts/docker-dev.sh shell postgres

# Run database migrations
./scripts/docker-dev.sh migrate

# Check service status
./scripts/docker-dev.sh status

# Rebuild after Dockerfile changes
./scripts/docker-dev.sh rebuild

# Clean up (removes all data!)
./scripts/docker-dev.sh clean
```

### Production

```bash
# Start production environment
./scripts/docker-prod.sh start

# Stop production environment
./scripts/docker-prod.sh stop

# View logs
./scripts/docker-prod.sh logs backend

# Backup databases
./scripts/docker-prod.sh backup

# Restore database
./scripts/docker-prod.sh restore ./backups/20240101_120000/postgres.sql

# Run migrations
./scripts/docker-prod.sh migrate

# Check status & resource usage
./scripts/docker-prod.sh status

# Scale service
./scripts/docker-prod.sh scale backend 3
```

### Building Images

```bash
# Build all images
./scripts/docker-build.sh all

# Build development images
./scripts/docker-build.sh dev

# Build production images
./scripts/docker-build.sh prod

# Build specific service
./scripts/docker-build.sh frontend prod
./scripts/docker-build.sh backend dev

# Show image sizes
./scripts/docker-build.sh sizes

# Clean up dangling images
./scripts/docker-build.sh clean

# Push to registry
./scripts/docker-build.sh push registry.example.com
```

## 📋 Service URLs

### Development
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- BullMQ Metrics: http://localhost:4000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

### Production
- All services internal except frontend (port 80)
- Access via reverse proxy or direct container IP

## 🔧 Troubleshooting

```bash
# Check if Docker is running
docker info

# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# View container resource usage
docker stats

# View detailed container info
docker inspect <container-name>

# Restart specific service
docker-compose -f docker-compose.base.yml -f docker-compose.dev.yml restart backend

# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune
```

## 🗄️ Database Operations

```bash
# Access PostgreSQL CLI
docker-compose -f docker-compose.base.yml -f docker-compose.dev.yml exec postgres psql -U postgres tcad_scraper

# Run SQL file
cat backup.sql | docker-compose -f docker-compose.base.yml -f docker-compose.dev.yml exec -T postgres psql -U postgres tcad_scraper

# Create backup
docker-compose -f docker-compose.base.yml -f docker-compose.dev.yml exec postgres pg_dump -U postgres tcad_scraper > backup.sql

# Prisma Studio (Database GUI)
docker-compose -f docker-compose.base.yml -f docker-compose.dev.yml exec backend npx prisma studio
# Opens on http://localhost:5555
```

## 🔍 Debugging

```bash
# Follow logs in real-time
./scripts/docker-dev.sh logs backend | grep ERROR

# Get last 100 lines
docker logs --tail 100 tcad-backend-dev

# Export logs to file
docker logs tcad-backend-dev > backend.log 2>&1

# Check container health
docker inspect --format='{{.State.Health.Status}}' tcad-backend-dev

# View environment variables
docker exec tcad-backend-dev env
```

## 📦 Environment Setup

```bash
# Copy environment template
cp .env.docker.example .env

# Required variables for development:
TCAD_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
JWT_SECRET=random_32_char_string

# Required additional for production:
POSTGRES_PASSWORD=strong_password
REDIS_PASSWORD=strong_password
GRAFANA_ADMIN_PASSWORD=strong_password
```

## 🏗️ Project Structure

```
├── Dockerfile                    # Frontend multi-stage build
├── server/Dockerfile            # Backend multi-stage build
├── bullmq-exporter/Dockerfile   # Metrics exporter
├── docker-compose.base.yml      # Base configuration
├── docker-compose.dev.yml       # Development overrides
├── docker-compose.prod.yml      # Production overrides
├── .env                         # Your environment (create from .env.docker.example)
├── .dockerignore                # Build exclusions
└── scripts/
    ├── docker-dev.sh            # Dev environment manager
    ├── docker-prod.sh           # Prod environment manager
    └── docker-build.sh          # Build automation
```

## ⚡ Performance Tips

```bash
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Use build cache
./scripts/docker-build.sh prod

# Prune system (removes all unused data)
docker system prune -a --volumes
```

## 🔒 Security Checklist

- [ ] Change default passwords in `.env`
- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Enable Redis password in production
- [ ] Use SSL certificates for production
- [ ] Don't commit `.env` to version control
- [ ] Regularly update base images
- [ ] Review exposed ports in production

## 📖 Full Documentation

See `docs/DOCKER_SETUP.md` for comprehensive guide.
