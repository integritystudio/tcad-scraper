# Test Database Setup Guide

This guide explains how to set up and manage the test database for local development and CI/CD.

## Quick Start

```bash
cd /home/aledlie/tcad-scraper/server

# Create test database and run migrations
./scripts/setup-test-db.sh

# Run tests
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" npm test
```

## Prerequisites

1. **PostgreSQL must be running**:
   ```bash
   # Using Docker
   docker-compose up -d postgres

   # Or system PostgreSQL
   sudo systemctl start postgresql
   ```

2. **Environment variables** (optional, defaults shown):
   ```bash
   export DATABASE_NAME=tcad_scraper_test
   export DATABASE_USER=postgres
   export DATABASE_PASSWORD=postgres
   export DATABASE_HOST=localhost
   export DATABASE_PORT=5432
   ```

## Setup Script Usage

### Basic Setup
Creates the test database and runs migrations:
```bash
./scripts/setup-test-db.sh
```

### Drop and Recreate
Useful for starting fresh:
```bash
./scripts/setup-test-db.sh --drop
```

### With Test Data
Creates database with sample test data:
```bash
./scripts/setup-test-db.sh --seed
```

### Verify Only
Check if database schema is correct without creating/migrating:
```bash
./scripts/setup-test-db.sh --verify-only
```

### Combine Options
```bash
./scripts/setup-test-db.sh --drop --seed
```

## What the Script Does

1. **Checks PostgreSQL Connection**: Verifies that PostgreSQL is running and accessible
2. **Database Management**:
   - Drops existing database (if `--drop` flag is used)
   - Creates database if it doesn't exist
   - Skips creation if database already exists
3. **Runs Migrations**: Applies all Prisma migrations to the test database
4. **Verifies Schema**: Checks that all required tables exist:
   - `properties`
   - `scrape_jobs`
   - `monitored_searches`
5. **Seeds Data** (optional): Inserts test data if `--seed` flag is used

## Manual Setup

If you prefer to set up manually:

```bash
# 1. Create database
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres \
  -c "CREATE DATABASE tcad_scraper_test;"

# 2. Run migrations
cd /home/aledlie/tcad-scraper/server
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" \
  npx prisma migrate deploy

# 3. Verify
PGPASSWORD=postgres psql -h localhost -U postgres -d tcad_scraper_test \
  -c "\dt"
```

## Running Tests

### All Tests
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" npm test
```

### Specific Test File
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" \
  npm test -- auth-database.connection.test.ts
```

### With Coverage
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" \
  npm test -- --coverage
```

## CI/CD Integration

### GitHub Actions
The CI pipeline automatically sets up the test database using service containers:

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tcad_scraper_test
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

No manual setup is needed in CI - migrations run automatically.

### Local Development
Developers should run the setup script once:
```bash
./scripts/setup-test-db.sh
```

Then tests can be run repeatedly without recreating the database.

## Troubleshooting

### "Cannot connect to PostgreSQL"
**Problem**: PostgreSQL is not running

**Solutions**:
```bash
# Docker
docker-compose up -d postgres

# System service
sudo systemctl start postgresql

# Check status
docker ps | grep postgres
# or
sudo systemctl status postgresql
```

### "Database already exists"
**Problem**: Database exists from previous run

**Solutions**:
```bash
# Drop and recreate
./scripts/setup-test-db.sh --drop

# Or manually
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres \
  -c "DROP DATABASE IF EXISTS tcad_scraper_test;"
```

### "Permission denied"
**Problem**: User doesn't have permissions to create databases

**Solutions**:
```bash
# Grant permissions
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres \
  -c "ALTER USER postgres CREATEDB;"

# Or use superuser
sudo -u postgres psql -c "CREATE DATABASE tcad_scraper_test;"
```

### "Migration failed"
**Problem**: Migrations are out of sync

**Solutions**:
```bash
# Check migration status
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" \
  npx prisma migrate status

# Reset database
./scripts/setup-test-db.sh --drop

# Regenerate Prisma client
npx prisma generate
```

### "Table does not exist"
**Problem**: Migrations haven't been run

**Solution**:
```bash
# Run migrations
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" \
  npx prisma migrate deploy
```

## Test Data Management

### Clear Test Data
```bash
# Connect to database
PGPASSWORD=postgres psql -h localhost -U postgres -d tcad_scraper_test

# Truncate tables
TRUNCATE TABLE properties, scrape_jobs, monitored_searches CASCADE;
```

### Seed Specific Data
```sql
-- Insert test properties
INSERT INTO properties (
    id, property_id, name, prop_type, city, property_address,
    appraised_value, scraped_at, created_at, updated_at
) VALUES
    (gen_random_uuid(), 'TEST001', 'Test Owner 1', 'R', 'AUSTIN', '123 Test St', 500000, NOW(), NOW(), NOW()),
    (gen_random_uuid(), 'TEST002', 'Test Owner 2', 'P', 'LAKEWAY', '456 Test Ave', 300000, NOW(), NOW(), NOW());
```

### Export Test Data
```bash
# Export properties
PGPASSWORD=postgres pg_dump -h localhost -U postgres -d tcad_scraper_test \
  --table=properties --data-only > test-properties.sql

# Import later
PGPASSWORD=postgres psql -h localhost -U postgres -d tcad_scraper_test < test-properties.sql
```

## Best Practices

1. **Use the setup script**: Always use `setup-test-db.sh` instead of manual creation
2. **Start fresh when needed**: Use `--drop` flag if tests are behaving unexpectedly
3. **Don't commit .env changes**: Test database config should match defaults
4. **Verify after setup**: Run `--verify-only` to check schema correctness
5. **Clean up between test runs**: Truncate tables instead of dropping database
6. **Use transactions in tests**: Wrap tests in transactions and rollback after each test

## Database Differences

### Test Database vs Production Database

| Aspect | Test Database | Production Database |
|--------|---------------|---------------------|
| Name | `tcad_scraper_test` | `tcad_scraper` |
| Data | Temporary/test data | Real property data |
| Lifecycle | Created/dropped frequently | Persistent |
| Migrations | Always deployed | Carefully managed |
| Credentials | Default (postgres/postgres) | Secured (via Doppler) |

## Related Documentation

- [CI/CD Documentation](../../docs/CI-CD.md)
- [Testing Guide](../../TESTING.md)
- [Test Status Report](../../docs/TEST-STATUS.md)
- [Prisma Documentation](https://www.prisma.io/docs)

## Script Output Example

```
=== Test Database Setup ===
Database: tcad_scraper_test
User: postgres
Host: localhost:5432

Checking PostgreSQL connection...
✓ PostgreSQL is running
Creating database 'tcad_scraper_test'...
✓ Database created
Running Prisma migrations...
✓ Migrations applied
Verifying database schema...
  ✓ Table 'properties' exists
  ✓ Table 'scrape_jobs' exists
  ✓ Table 'monitored_searches' exists
✓ Schema verification passed

=== Setup Complete ===
Database URL: postgresql://postgres:postgres@localhost:5432/tcad_scraper_test

To run tests with this database:
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" npm test

To connect with psql:
  PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d tcad_scraper_test
```
