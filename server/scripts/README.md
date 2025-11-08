# Test Database Setup Scripts

This directory contains scripts to automate test database setup for local development.

## Quick Start

```bash
# Run the setup script (recommended - cross-platform)
npm run setup:test-db

# Or use the shell script directly (Unix-like systems)
./scripts/setup-test-db.sh
```

## What the Script Does

1. **Checks Prerequisites**
   - Verifies PostgreSQL client is installed
   - Verifies Redis CLI is installed (optional)

2. **Checks Service Status**
   - Tests PostgreSQL connection
   - Tests Redis connection (optional)

3. **Database Setup**
   - Creates test database if it doesn't exist
   - Generates Prisma Client
   - Runs all migrations

4. **Verification**
   - Verifies database schema is correct
   - Counts tables to ensure migrations ran

5. **Optional Seeding**
   - Prompts to seed test data (not implemented yet)

## Configuration

The scripts use environment variables with sensible defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | `tcad_scraper_test` | Test database name |
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | `postgres` | Database password |
| `POSTGRES_HOST` | `localhost` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

### Custom Configuration

```bash
# Set custom values
export POSTGRES_DB=my_test_db
export POSTGRES_USER=myuser
export POSTGRES_PASSWORD=mypassword

# Run setup
npm run setup:test-db
```

## Prerequisites

### macOS (Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@16

# Start PostgreSQL
brew services start postgresql@16

# Install Redis (optional, for full test suite)
brew install redis
brew services start redis
```

### Docker

```bash
# Start PostgreSQL
docker run --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16

# Start Redis (optional)
docker run --name redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

### Linux (Ubuntu/Debian)

```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql-16

# Start PostgreSQL
sudo systemctl start postgresql

# Install Redis (optional)
sudo apt-get install redis-server
sudo systemctl start redis-server
```

### Windows

```bash
# Install PostgreSQL
# Download from: https://www.postgresql.org/download/windows/

# Install Redis (optional)
# Download from: https://github.com/microsoftarchive/redis/releases
```

## Troubleshooting

### PostgreSQL Connection Failed

**Error:** `Cannot connect to PostgreSQL`

**Solutions:**
1. Check if PostgreSQL is running:
   ```bash
   # macOS
   brew services list | grep postgresql

   # Linux
   sudo systemctl status postgresql

   # Windows
   net start postgresql-x64-16
   ```

2. Verify credentials:
   ```bash
   psql -U postgres -h localhost -p 5432
   ```

3. Check `pg_hba.conf` allows local connections

### Database Already Exists

**Error:** `Database already exists`

**Solution:** This is not an error! The script will use the existing database and run migrations.

To start fresh:
```bash
# Drop and recreate
psql -U postgres -c "DROP DATABASE tcad_scraper_test;"
npm run setup:test-db
```

### Migrations Failed

**Error:** Migration deployment failed

**Solutions:**
1. Check database connection
2. Verify Prisma schema is valid:
   ```bash
   npx prisma validate
   ```
3. Reset migrations:
   ```bash
   npx prisma migrate reset
   ```

### Redis Not Running

**Warning:** `Redis is not running. Tests may fail.`

**Solution:** This is a warning, not an error. Some tests require Redis:
```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis-server

# Docker
docker start redis
```

## Manual Setup

If you prefer manual setup:

```bash
# 1. Create database
psql -U postgres -c "CREATE DATABASE tcad_scraper_test;"

# 2. Generate Prisma Client
cd server
npx prisma generate

# 3. Run migrations
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper_test" \
  npx prisma migrate deploy

# 4. Verify
psql -U postgres -d tcad_scraper_test -c "\dt"
```

## CI/CD Usage

The setup script can be used in CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Setup Test Database
  run: npm run setup:test-db
  working-directory: ./server
  env:
    POSTGRES_DB: tcad_scraper_test
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_HOST: localhost
    POSTGRES_PORT: 5432
```

## Next Steps

After setup completes:

1. **Run Tests**
   ```bash
   npm test
   ```

2. **Start Dev Server**
   ```bash
   npm run dev
   ```

3. **View Database**
   ```bash
   npm run prisma:studio
   ```

4. **Check Database Stats**
   ```bash
   npm run stats
   ```

## Scripts

### setup-test-db.ts
Cross-platform Node.js/TypeScript version. Works on all platforms including Windows.

**Pros:**
- Cross-platform (Windows, macOS, Linux)
- Better error handling
- Uses TypeScript for type safety
- Can be extended easily

**Cons:**
- Requires Node.js runtime
- Slightly slower startup

### setup-test-db.sh
Bash shell script for Unix-like systems.

**Pros:**
- Faster execution
- Native shell features
- No Node.js required

**Cons:**
- Unix-only (macOS, Linux)
- Doesn't work on Windows without WSL
