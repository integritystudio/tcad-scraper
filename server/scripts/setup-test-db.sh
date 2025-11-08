#!/bin/bash

# Test Database Setup Script
# This script creates and configures the test database for CI/CD and local development

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="${DATABASE_NAME:-tcad_scraper_test}"
DB_USER="${DATABASE_USER:-postgres}"
DB_PASSWORD="${DATABASE_PASSWORD:-postgres}"
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo -e "${GREEN}=== Test Database Setup ===${NC}"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Host: $DB_HOST:$DB_PORT"
echo ""

# Function to check if PostgreSQL is running
check_postgres() {
    echo -e "${YELLOW}Checking PostgreSQL connection...${NC}"
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c '\q' 2>/dev/null; then
        echo -e "${GREEN}✓ PostgreSQL is running${NC}"
        return 0
    else
        echo -e "${RED}✗ Cannot connect to PostgreSQL${NC}"
        echo "Please ensure PostgreSQL is running:"
        echo "  - Docker: docker-compose up -d postgres"
        echo "  - System: sudo systemctl start postgresql"
        return 1
    fi
}

# Function to check if database exists
database_exists() {
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres \
        -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1
}

# Function to drop database if it exists
drop_database() {
    echo -e "${YELLOW}Dropping existing database '$DB_NAME'...${NC}"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres \
        -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
    echo -e "${GREEN}✓ Database dropped${NC}"
}

# Function to create database
create_database() {
    echo -e "${YELLOW}Creating database '$DB_NAME'...${NC}"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres \
        -c "CREATE DATABASE \"$DB_NAME\";"
    echo -e "${GREEN}✓ Database created${NC}"
}

# Function to run migrations
run_migrations() {
    echo -e "${YELLOW}Running Prisma migrations...${NC}"
    cd "$(dirname "$0")/.."
    DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy
    echo -e "${GREEN}✓ Migrations applied${NC}"
}

# Function to verify database schema
verify_schema() {
    echo -e "${YELLOW}Verifying database schema...${NC}"

    # Check if main tables exist
    local tables=("properties" "scrape_jobs" "monitored_searches")
    for table in "${tables[@]}"; do
        if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
            -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='$table'" | grep -q 1; then
            echo -e "${GREEN}  ✓ Table '$table' exists${NC}"
        else
            echo -e "${RED}  ✗ Table '$table' missing${NC}"
            return 1
        fi
    done

    echo -e "${GREEN}✓ Schema verification passed${NC}"
}

# Function to seed test data (optional)
seed_test_data() {
    if [ "$SEED_DATA" = "true" ]; then
        echo -e "${YELLOW}Seeding test data...${NC}"
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
-- Insert test property
INSERT INTO properties (
    id, property_id, name, prop_type, city, property_address,
    appraised_value, scraped_at, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'TEST001',
    'Test Property Owner',
    'R',
    'AUSTIN',
    '123 Test St, Austin, TX 78701',
    500000,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (property_id) DO NOTHING;
EOF
        echo -e "${GREEN}✓ Test data seeded${NC}"
    fi
}

# Function to display usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --drop        Drop existing database before creating"
    echo "  --seed        Seed database with test data"
    echo "  --verify-only Only verify schema, don't create/migrate"
    echo "  --help        Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_NAME     (default: tcad_scraper_test)"
    echo "  DATABASE_USER     (default: postgres)"
    echo "  DATABASE_PASSWORD (default: postgres)"
    echo "  DATABASE_HOST     (default: localhost)"
    echo "  DATABASE_PORT     (default: 5432)"
}

# Parse command line arguments
DROP_EXISTING=false
SEED_DATA=false
VERIFY_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --drop)
            DROP_EXISTING=true
            shift
            ;;
        --seed)
            SEED_DATA=true
            shift
            ;;
        --verify-only)
            VERIFY_ONLY=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    # Check if PostgreSQL is running
    if ! check_postgres; then
        exit 1
    fi

    if [ "$VERIFY_ONLY" = "true" ]; then
        # Just verify schema
        if database_exists; then
            verify_schema
        else
            echo -e "${RED}✗ Database '$DB_NAME' does not exist${NC}"
            exit 1
        fi
    else
        # Full setup
        if [ "$DROP_EXISTING" = "true" ] && database_exists; then
            drop_database
        fi

        # Create database if it doesn't exist
        if ! database_exists; then
            create_database
        else
            echo -e "${YELLOW}Database '$DB_NAME' already exists, skipping creation${NC}"
        fi

        # Run migrations
        run_migrations

        # Verify schema
        verify_schema

        # Seed test data if requested
        seed_test_data
    fi

    echo ""
    echo -e "${GREEN}=== Setup Complete ===${NC}"
    echo "Database URL: $DATABASE_URL"
    echo ""
    echo "To run tests with this database:"
    echo "  DATABASE_URL=\"$DATABASE_URL\" npm test"
    echo ""
    echo "To connect with psql:"
    echo "  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
}

# Run main function
main
