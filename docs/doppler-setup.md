# Doppler Setup Guide

This guide will help you set up Doppler for secure environment variable management.

## Prerequisites

1. Install Doppler CLI:
```bash
# macOS
brew install dopplerhq/cli/doppler

# Linux
curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/config.deb.asc' | sudo apt-key add -
echo "deb https://packages.doppler.com/public/cli/deb/debian any-version main" | sudo tee /etc/apt/sources.list.d/doppler-cli.list
sudo apt-get update && sudo apt-get install doppler

# Windows (via Scoop)
scoop bucket add doppler https://github.com/DopplerHQ/scoop-doppler.git
scoop install doppler
```

2. Login to Doppler:
```bash
doppler login
```

## Setup Steps

### 1. Create Doppler Project

```bash
# Navigate to server directory
cd server

# Initialize Doppler
doppler setup

# Select or create project: tcad-scraper
# Select config: dev (for development) or prd (for production)
```

### 2. Set Environment Variables in Doppler

```bash
# Database (Render PostgreSQL — get URL from Render dashboard)
doppler secrets set DATABASE_URL="postgresql://user:pass@host/tcad_scraper"

# Redis (Render Redis with TLS — get URL from Render dashboard)
doppler secrets set REDIS_URL="rediss://user:pass@oregon-keyvalue.render.com:6379"
doppler secrets set REDIS_HOST="oregon-keyvalue.render.com"
doppler secrets set REDIS_PORT="6379"

# Server
doppler secrets set NODE_ENV="development"
doppler secrets set PORT="3001"
doppler secrets set HOST="localhost"

# Authentication
doppler secrets set JWT_SECRET="your-secure-jwt-secret-key"
doppler secrets set JWT_EXPIRES_IN="7d"
doppler secrets set API_KEY="your-secure-api-key"

# Scraper
doppler secrets set SCRAPER_CONCURRENCY="2"
doppler secrets set SCRAPER_TIMEOUT="30000"
doppler secrets set SCRAPER_RETRY_ATTEMPTS="3"
doppler secrets set SCRAPER_RATE_LIMIT_DELAY="5000"

# Frontend
doppler secrets set FRONTEND_URL="http://localhost:5174"

# Logging
doppler secrets set LOG_LEVEL="info"

# Optional: TCAD API Key (if needed)
doppler secrets set TCAD_API_KEY="your-tcad-api-token"
```

### 3. Run Server with Doppler

```bash
# Start server using Doppler
doppler run -- npm run dev

# Or for production
doppler run -- npm start
```

### 4. Frontend Environment Setup

```bash
# Navigate to root directory
cd ..

# Create .env file for frontend
echo "VITE_API_URL=http://localhost:3001/api" > .env

# Or use Doppler for frontend too
doppler setup
doppler secrets set VITE_API_URL="http://localhost:3001/api"
doppler run -- npm run dev
```

## Running with Doppler

### Development

```bash
# Server (from server directory)
cd server
doppler run -- npm run dev

# Frontend (from root directory)
cd ..
npm run dev
```

### Production

```bash
# Switch to production config
doppler setup --config prd

# Run server
doppler run -- npm start
```

## Verify Setup

1. Check if Doppler is configured:
```bash
doppler configure get
```

2. View current secrets:
```bash
doppler secrets
```

3. Test server connection:
```bash
curl http://localhost:3001/health
```

4. Test API endpoint:
```bash
curl http://localhost:3001/api/properties?limit=10
```

## Security Best Practices

1. Never commit `.env` files to git
2. Use different configs for dev/staging/prod
3. Rotate JWT_SECRET and API_KEY regularly
4. Use strong, random values for secrets
5. Limit access to Doppler project

## Troubleshooting

### Doppler not found
- Ensure Doppler CLI is installed
- Run `doppler login` to authenticate

### Secrets not loading
- Verify you're in the correct directory
- Check `doppler configure get` shows correct project/config
- Ensure you have permissions to the Doppler project

### Database connection errors
- Verify DATABASE_URL is correct (should point to Render PostgreSQL)
- Check Render dashboard for DB status
- Test connection: `doppler run -- psql $DATABASE_URL`

## Alternative: Using .env without Doppler

If you prefer not to use Doppler:

1. Copy `.env.example` to `.env` in server directory
2. Edit values in `.env`
3. Run normally: `npm run dev`

Note: Doppler is recommended for production for better security and team collaboration.
