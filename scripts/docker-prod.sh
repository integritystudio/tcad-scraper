#!/bin/bash

# ============================================
# Docker Production Environment Manager
# ============================================
# Manages the TCAD Scraper production environment using Docker Compose
# Usage: ./scripts/docker-prod.sh [start|stop|restart|logs|rebuild|backup]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILES="-f config/docker-compose.base.yml -f config/docker-compose.prod.yml"
PROJECT_NAME="tcad-prod"

# Check if Doppler is available and configured
USE_DOPPLER=false
if command -v doppler &> /dev/null; then
    if doppler configure get project &> /dev/null; then
        USE_DOPPLER=true
        DOCKER_COMPOSE="doppler run -- docker-compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi
else
    DOCKER_COMPOSE="docker-compose"
fi

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker."
        exit 1
    fi
    log_info "Docker is running"

    if [ "$USE_DOPPLER" = true ]; then
        log_info "Using Doppler for secrets management"
    else
        log_warn "Doppler not configured. Ensure .env file has production secrets"
    fi
}

# Check environment variables
check_env() {
    if [ ! -f .env ]; then
        log_error ".env file not found. Please create one from .env.example"
        exit 1
    fi

    # Check for required variables
    REQUIRED_VARS=("POSTGRES_PASSWORD" "JWT_SECRET" "TCAD_API_KEY")
    for VAR in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^${VAR}=" .env; then
            log_error "Required environment variable $VAR not found in .env"
            exit 1
        fi
    done

    log_info "Environment variables validated"
}

# Start production environment
start_prod() {
    log_info "Starting production environment..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME up -d

    log_info "Waiting for services to be healthy..."
    sleep 10

    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME ps

    echo ""
    log_info "Production environment is running!"
    echo ""
    log_warn "Services are only accessible via reverse proxy or internal network"
    echo ""
    log_info "To view logs: ./scripts/docker-prod.sh logs"
    log_info "To stop: ./scripts/docker-prod.sh stop"
}

# Stop production environment
stop_prod() {
    log_warn "Stopping production environment..."
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME down
        log_info "Production environment stopped"
    else
        log_info "Stop cancelled"
    fi
}

# Restart production environment
restart_prod() {
    log_info "Restarting production environment..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME restart
}

# Show logs
show_logs() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        log_info "Showing logs for all services (Ctrl+C to exit)..."
        $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME logs -f --tail=100
    else
        log_info "Showing logs for $SERVICE (Ctrl+C to exit)..."
        $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME logs -f --tail=100 $SERVICE
    fi
}

# Rebuild containers
rebuild_prod() {
    log_warn "This will rebuild all containers. Downtime will occur."
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Rebuilding production containers..."
        $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME build --no-cache
        $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME up -d
        log_info "Rebuild complete"
    else
        log_info "Rebuild cancelled"
    fi
}

# Backup databases
backup_db() {
    log_info "Creating database backups..."

    BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # Backup PostgreSQL
    log_info "Backing up PostgreSQL..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME exec -T postgres pg_dump -U postgres tcad_scraper > "$BACKUP_DIR/postgres.sql"

    # Backup Redis
    log_info "Backing up Redis..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME exec -T redis redis-cli SAVE
    docker cp tcad-redis-prod:/data/dump.rdb "$BACKUP_DIR/redis.rdb"

    log_info "Backups saved to $BACKUP_DIR"
}

# Restore database
restore_db() {
    BACKUP_FILE=$1
    if [ -z "$BACKUP_FILE" ]; then
        log_error "Please specify backup file path"
        exit 1
    fi

    log_warn "This will restore the database from $BACKUP_FILE"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restoring PostgreSQL..."
        $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME exec -T postgres psql -U postgres tcad_scraper < "$BACKUP_FILE"
        log_info "Restore complete"
    else
        log_info "Restore cancelled"
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME exec backend npx prisma migrate deploy
    log_info "Migrations complete"
}

# Show service status
status() {
    log_info "Service status:"
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME ps

    echo ""
    log_info "Resource usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" $($DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME ps -q)
}

# Scale service
scale() {
    SERVICE=$1
    REPLICAS=$2

    if [ -z "$SERVICE" ] || [ -z "$REPLICAS" ]; then
        log_error "Usage: scale <service> <replicas>"
        exit 1
    fi

    log_info "Scaling $SERVICE to $REPLICAS replicas..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME up -d --scale $SERVICE=$REPLICAS
}

# Main command handler
check_docker

case "${1:-status}" in
    start)
        check_env
        start_prod
        ;;
    stop)
        stop_prod
        ;;
    restart)
        restart_prod
        ;;
    logs)
        show_logs $2
        ;;
    rebuild)
        check_env
        rebuild_prod
        ;;
    backup)
        backup_db
        ;;
    restore)
        restore_db $2
        ;;
    migrate)
        run_migrations
        ;;
    status)
        status
        ;;
    scale)
        scale $2 $3
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs [service]|rebuild|backup|restore <file>|migrate|status|scale <service> <replicas>}"
        echo ""
        echo "Commands:"
        echo "  start         - Start production environment"
        echo "  stop          - Stop production environment"
        echo "  restart       - Restart production environment"
        echo "  logs [svc]    - Show logs (optionally for specific service)"
        echo "  rebuild       - Rebuild containers from scratch"
        echo "  backup        - Backup databases"
        echo "  restore <file>- Restore database from backup"
        echo "  migrate       - Run database migrations"
        echo "  status        - Show service status and resource usage"
        echo "  scale <s> <n> - Scale service to N replicas"
        exit 1
        ;;
esac
