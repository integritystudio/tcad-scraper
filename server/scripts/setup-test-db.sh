#!/bin/bash

# TCAD Scraper - Test Database Setup Script
# This script automates the setup of a local test database for development

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="${POSTGRES_DB:-tcad_scraper_test}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

echo "=========================================="
echo "TCAD Scraper - Test Database Setup"
echo "=========================================="
echo ""

# Function to check if PostgreSQL is running
check_postgres() {
    echo -n "Checking PostgreSQL connection... "
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} PostgreSQL is running"
        return 0
    else
        echo -e "${RED}✗${NC} PostgreSQL is not running"
        return 1
    fi
}

# Function to check if Redis is running
check_redis() {
    echo -n "Checking Redis connection... "
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis is running"
        return 0
    else
        echo -e "${RED}✗${NC} Redis is not running"
        return 1
    fi
}

# Function to create database if it doesn't exist
create_database() {
    echo -n "Checking if database '$DB_NAME' exists... "

    # Check if database exists
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        echo -e "${YELLOW}⚠${NC} Database already exists"
    else
        echo -e "${YELLOW}Creating...${NC}"
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" > /dev/null 2>&1
        echo -e "${GREEN}✓${NC} Database '$DB_NAME' created successfully"
    fi
}

# Function to run Prisma migrations
run_migrations() {
    echo "Running Prisma migrations..."
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

    # Generate Prisma Client
    echo -n "Generating Prisma Client... "
    npx prisma generate > /dev/null 2>&1
    echo -e "${GREEN}✓${NC}"

    # Run migrations
    echo -n "Deploying migrations... "
    npx prisma migrate deploy > /dev/null 2>&1
    echo -e "${GREEN}✓${NC}"
}

# Function to verify database schema
verify_schema() {
    echo -n "Verifying database schema... "
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

    # Count tables
    TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)

    if [ "$TABLE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} Found $TABLE_COUNT tables"
    else
        echo -e "${RED}✗${NC} No tables found"
        return 1
    fi
}

# Function to seed test data (optional)
seed_test_data() {
    echo -n "Would you like to seed test data? (y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "Seeding test data..."
        export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
        # Add seed script here if needed
        echo -e "${YELLOW}⚠${NC} Seed script not implemented yet"
    fi
}

# Main setup flow
main() {
    echo "Configuration:"
    echo "  Database: $DB_NAME"
    echo "  User: $DB_USER"
    echo "  Host: $DB_HOST:$DB_PORT"
    echo "  Redis: $REDIS_HOST:$REDIS_PORT"
    echo ""

    # Check prerequisites
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}✗${NC} PostgreSQL client (psql) not found. Please install PostgreSQL."
        exit 1
    fi

    if ! command -v redis-cli &> /dev/null; then
        echo -e "${YELLOW}⚠${NC} Redis CLI not found. Skipping Redis check."
    else
        check_redis || {
            echo -e "${YELLOW}⚠${NC} Redis is not running. Tests may fail."
            echo "  To start Redis: redis-server"
        }
    fi

    # Check PostgreSQL
    check_postgres || {
        echo ""
        echo -e "${RED}ERROR:${NC} Cannot connect to PostgreSQL"
        echo ""
        echo "To start PostgreSQL:"
        echo "  - macOS (Homebrew): brew services start postgresql"
        echo "  - Docker: docker run --name postgres -e POSTGRES_PASSWORD=$DB_PASSWORD -p 5432:5432 -d postgres:16"
        echo "  - Linux (systemd): sudo systemctl start postgresql"
        echo ""
        exit 1
    }

    echo ""

    # Create database
    create_database

    echo ""

    # Run migrations
    run_migrations

    echo ""

    # Verify schema
    verify_schema

    echo ""

    # Optional: Seed data
    seed_test_data

    echo ""
    echo "=========================================="
    echo -e "${GREEN}✓${NC} Test database setup complete!"
    echo "=========================================="
    echo ""
    echo "Database URL: postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    echo ""
    echo "Next steps:"
    echo "  1. Run tests: npm test"
    echo "  2. Start dev server: npm run dev"
    echo "  3. View database: npm run prisma:studio"
    echo ""
}

# Run main function
main
