#!/bin/bash

# ============================================
# Docker Build Script
# ============================================
# Builds all Docker images for the TCAD Scraper project
# Usage: ./scripts/docker-build.sh [dev|prod|all]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    log_info "Docker is running"
}

# Build frontend
build_frontend() {
    TARGET=$1
    log_step "Building frontend (target: $TARGET)..."

    docker build \
        --target $TARGET \
        --tag tcad-frontend:$TARGET \
        --tag tcad-frontend:latest \
        -f Dockerfile \
        .

    log_info "Frontend build complete"
}

# Build backend
build_backend() {
    TARGET=$1
    log_step "Building backend (target: $TARGET)..."

    docker build \
        --target $TARGET \
        --tag tcad-backend:$TARGET \
        --tag tcad-backend:latest \
        -f server/Dockerfile \
        ./server

    log_info "Backend build complete"
}

# Build BullMQ exporter
build_bullmq_exporter() {
    log_step "Building BullMQ exporter..."

    docker build \
        --tag tcad-bullmq-exporter:latest \
        -f bullmq-exporter/Dockerfile \
        ./bullmq-exporter

    log_info "BullMQ exporter build complete"
}

# Build development images
build_dev() {
    log_info "Building development images..."
    build_frontend "development"
    build_backend "development"
    build_bullmq_exporter
    log_info "Development build complete!"
}

# Build production images
build_prod() {
    log_info "Building production images..."
    build_frontend "production"
    build_backend "production"
    build_bullmq_exporter
    log_info "Production build complete!"
}

# Build all images
build_all() {
    log_info "Building all images..."

    # Development
    build_frontend "development"
    docker tag tcad-frontend:development tcad-frontend:dev

    build_backend "development"
    docker tag tcad-backend:development tcad-backend:dev

    # Production
    build_frontend "production"
    docker tag tcad-frontend:production tcad-frontend:prod

    build_backend "production"
    docker tag tcad-backend:production tcad-backend:prod

    # BullMQ exporter
    build_bullmq_exporter

    log_info "All builds complete!"
}

# Clean up dangling images
cleanup() {
    log_step "Cleaning up dangling images..."
    docker image prune -f
    log_info "Cleanup complete"
}

# Show image sizes
show_sizes() {
    log_info "Image sizes:"
    echo ""
    docker images | grep tcad | awk '{printf "%-35s %-15s %-15s\n", $1":"$2, $7, $7}'
    echo ""
}

# Push images to registry
push_images() {
    REGISTRY=$1
    if [ -z "$REGISTRY" ]; then
        log_error "Please specify registry URL"
        exit 1
    fi

    log_info "Pushing images to $REGISTRY..."

    docker tag tcad-frontend:production $REGISTRY/tcad-frontend:latest
    docker tag tcad-backend:production $REGISTRY/tcad-backend:latest
    docker tag tcad-bullmq-exporter:latest $REGISTRY/tcad-bullmq-exporter:latest

    docker push $REGISTRY/tcad-frontend:latest
    docker push $REGISTRY/tcad-backend:latest
    docker push $REGISTRY/tcad-bullmq-exporter:latest

    log_info "Push complete"
}

# Main command handler
check_docker

case "${1:-all}" in
    dev|development)
        build_dev
        cleanup
        show_sizes
        ;;
    prod|production)
        build_prod
        cleanup
        show_sizes
        ;;
    all)
        build_all
        cleanup
        show_sizes
        ;;
    frontend)
        build_frontend "${2:-production}"
        cleanup
        show_sizes
        ;;
    backend)
        build_backend "${2:-production}"
        cleanup
        show_sizes
        ;;
    exporter)
        build_bullmq_exporter
        cleanup
        show_sizes
        ;;
    push)
        push_images $2
        ;;
    clean)
        cleanup
        ;;
    sizes)
        show_sizes
        ;;
    *)
        echo "Usage: $0 {dev|prod|all|frontend|backend|exporter|push <registry>|clean|sizes}"
        echo ""
        echo "Commands:"
        echo "  dev        - Build development images"
        echo "  prod       - Build production images"
        echo "  all        - Build all images (dev + prod)"
        echo "  frontend   - Build only frontend [dev|prod]"
        echo "  backend    - Build only backend [dev|prod]"
        echo "  exporter   - Build only BullMQ exporter"
        echo "  push <reg> - Push production images to registry"
        echo "  clean      - Remove dangling images"
        echo "  sizes      - Show image sizes"
        exit 1
        ;;
esac
