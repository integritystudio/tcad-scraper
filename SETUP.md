# TCAD Scraper Setup with Doppler Authentication

This project now includes Doppler integration for secure environment variable management and authentication for the API and UI.

## Quick Start

### 1. Start Infrastructure Services

```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d

# Verify services are running
docker ps
```

### 2. Setup Server with Doppler

#### Option A: Using Doppler (Recommended for Production)

```bash
# Install Doppler CLI (if not already installed)
brew install dopplerhq/cli/doppler  # macOS
# See doppler-setup.md for other platforms

# Login to Doppler
doppler login

# Navigate to server directory and setup
cd server
doppler setup

# Set your secrets in Doppler
doppler secrets set DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper"
doppler secrets set REDIS_HOST="localhost"
doppler secrets set REDIS_PORT="6379"
doppler secrets set JWT_SECRET="your-secure-random-jwt-secret"
doppler secrets set API_KEY="your-secure-api-key"
doppler secrets set FRONTEND_URL="http://localhost:5173"

# Run server with Doppler
doppler run -- npm run dev
```

#### Option B: Using .env File (Development)

```bash
cd server

# Copy example env file
cp .env.example .env

# Edit .env and set your values
# Important: Change JWT_SECRET and API_KEY to secure random values!

# Run server normally
npm run dev
```

### 3. Setup Frontend

```bash
# From project root
cd ..

# The .env file is already created with:
# VITE_API_URL=http://localhost:3001/api

# Start frontend
npm run dev
```

### 4. Initialize Database

```bash
cd server

# Push Prisma schema to database
npx prisma db push

# Optional: View data in Prisma Studio
npx prisma studio
```

## Access the Application

- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **API Health**: http://localhost:3001/health
- **Queue Dashboard**: http://localhost:3001/admin/queues
- **Prisma Studio**: http://localhost:5555 (if running)

## Authentication

The API now includes authentication middleware:

- **Optional Auth**: By default, the API works without authentication in development
- **JWT Auth**: For production, set `JWT_SECRET` and use Bearer tokens
- **API Key Auth**: Alternative authentication using `X-API-Key` header

### Using API Key Authentication

```bash
# Set API key in your environment
export API_KEY="your-secure-api-key"

# Make authenticated requests
curl -H "X-API-Key: your-secure-api-key" http://localhost:3001/api/properties
```

### Using JWT Authentication

```bash
# Generate a token (implement your own auth endpoint)
# Then use it in requests:
curl -H "Authorization: Bearer your-jwt-token" http://localhost:3001/api/properties
```

## Viewing Database Contents

The UI now displays real data from PostgreSQL instead of mock data:

1. Start the services (database, server, frontend)
2. Navigate to http://localhost:5173
3. The UI will fetch properties from the database and display them

### If No Data Shows

If you see "No properties found", it means the database is empty. To populate it:

1. Use the scraper to collect data:
```bash
cd server
npm run cli
# Select option 1 or 2 to add search terms
```

2. Or run the continuous scraper:
```bash
cd server
doppler run -- npx tsx src/scripts/continuous-batch-scraper.ts
```

3. Check progress:
```bash
# View database contents
docker exec tcad-postgres psql -U postgres -d tcad_scraper -c "SELECT COUNT(*) FROM properties;"

# View in Prisma Studio
cd server
npx prisma studio
```

## Security Best Practices

1. **Never commit secrets**: The `.env` file is in `.gitignore`
2. **Use strong secrets**: Generate random values for JWT_SECRET and API_KEY
3. **Use Doppler in production**: Better security and team collaboration
4. **Rotate secrets regularly**: Change JWT_SECRET and API_KEY periodically
5. **Enable authentication**: Set `JWT_SECRET` to require authentication in production

## Troubleshooting

### Cannot connect to database
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Test connection
psql postgresql://postgres:postgres@localhost:5432/tcad_scraper -c "SELECT 1;"
```

### API returns 401 Unauthorized
- Check if API_KEY or JWT_SECRET is set
- In development, these are optional
- Set `NODE_ENV=development` to skip auth

### UI shows "Failed to load properties"
- Verify server is running: `curl http://localhost:3001/health`
- Check browser console for errors
- Verify VITE_API_URL in `.env` matches server URL

### Doppler commands fail
- Login: `doppler login`
- Check setup: `doppler configure get`
- View secrets: `doppler secrets`

## Advanced Configuration

### Environment Variables Reference

#### Server (.env in server/ directory)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`: Redis hostname
- `REDIS_PORT`: Redis port
- `JWT_SECRET`: Secret for JWT token signing
- `API_KEY`: API key for simple authentication
- `FRONTEND_URL`: Frontend URL for CORS
- `NODE_ENV`: development/production
- `PORT`: Server port (default: 3001)

#### Frontend (.env in root directory)
- `VITE_API_URL`: Backend API URL (default: http://localhost:3001/api)

### Running in Production

1. Switch to production Doppler config:
```bash
doppler setup --config prd
```

2. Set production secrets:
```bash
doppler secrets set NODE_ENV="production"
doppler secrets set JWT_SECRET="super-secure-production-secret"
doppler secrets set DATABASE_URL="your-production-db-url"
```

3. Build and run:
```bash
# Build frontend
npm run build

# Run server
cd server
doppler run -- npm start
```

## Next Steps

1. Populate database by running the scraper
2. Explore the UI at http://localhost:5173
3. Monitor queue jobs at http://localhost:3001/admin/queues
4. Set up Doppler for production deployment
5. Configure production secrets and deploy

For detailed Doppler setup instructions, see `doppler-setup.md`.
