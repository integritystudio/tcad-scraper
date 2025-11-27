#!/bin/bash

# ============================================
# Docker Development Environment Manager
# ============================================
# Manages the TCAD Scraper development environment using Docker Compose
# Usage: ./scripts/docker-dev.sh [start|stop|restart|logs|rebuild|clean]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILES="-f config/docker-compose.base.yml -f config/docker-compose.dev.yml"
PROJECT_NAME="tcad-dev"

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
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    log_info "Docker is running"

    if [ "$USE_DOPPLER" = true ]; then
        log_info "Using Doppler for secrets management"
    else
        log_warn "Doppler not configured. Using .env file if available"
    fi
}

# Start development environment
start_dev() {
    log_info "Starting development environment..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME up -d

    log_info "Waiting for services to be healthy..."
    sleep 5

    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME ps

    echo ""
    log_info "Development environment is running!"
    echo ""
    echo "Access points:"
    echo "  Frontend:       http://localhost:5173"
    echo "  Backend API:    http://localhost:3000"
    echo "  BullMQ Metrics: http://localhost:4000"
    echo "  Prometheus:     http://localhost:9090"
    echo "  Grafana:        http://localhost:3001 (admin/admin)"
    echo "  PostgreSQL:     localhost:5432"
    echo "  Redis:          localhost:6379"
    echo ""
    log_info "To view logs: ./scripts/docker-dev.sh logs"
    log_info "To stop: ./scripts/docker-dev.sh stop"
}

# Stop development environment
stop_dev() {
    log_info "Stopping development environment..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME down
    log_info "Development environment stopped"
}

# Restart development environment
restart_dev() {
    log_info "Restarting development environment..."
    stop_dev
    start_dev
}

# Show logs
show_logs() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        log_info "Showing logs for all services (Ctrl+C to exit)..."
        $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME logs -f
    else
        log_info "Showing logs for $SERVICE (Ctrl+C to exit)..."
        $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME logs -f $SERVICE
    fi
}

# Rebuild containers
rebuild_dev() {
    log_info "Rebuilding development containers..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME build --no-cache
    restart_dev
}

# Clean up (remove volumes)
clean_dev() {
    log_warn "This will remove all containers, networks, and volumes!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up development environment..."
        $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME down -v --remove-orphans
        log_info "Cleanup complete"
    else
        log_info "Cleanup cancelled"
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME exec backend npx prisma migrate dev
    log_info "Migrations complete"
}

# Open a shell in a container
shell() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        log_error "Please specify a service: frontend, backend, postgres, redis"
        exit 1
    fi

    log_info "Opening shell in $SERVICE..."
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME exec $SERVICE sh
}

# Show service status
status() {
    log_info "Service status:"
    $DOCKER_COMPOSE $COMPOSE_FILES -p $PROJECT_NAME ps
}

# Main command handler
check_docker

case "${1:-start}" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    restart)
        restart_dev
        ;;
    logs)
        show_logs $2
        ;;
    rebuild)
        rebuild_dev
        ;;
    clean)
        clean_dev
        ;;
    migrate)
        run_migrations
        ;;
    shell)
        shell $2
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs [service]|rebuild|clean|migrate|shell <service>|status}"
        echo ""
        echo "Commands:"
        echo "  start       - Start development environment"
        echo "  stop        - Stop development environment"
        echo "  restart     - Restart development environment"
        echo "  logs [svc]  - Show logs (optionally for specific service)"
        echo "  rebuild     - Rebuild containers from scratch"
        echo "  clean       - Remove all containers, networks, and volumes"
        echo "  migrate     - Run database migrations"
        echo "  shell <svc> - Open shell in service container"
        echo "  status      - Show service status"
        exit 1
        ;;
esac
