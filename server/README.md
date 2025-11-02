# TCAD Scraper Backend Server

Modern Express + TypeScript backend for the TCAD property scraper with Playwright, Bull queue, and PostgreSQL.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Redis server (for Bull queue)
- Chrome/Chromium browser (automatically installed by Playwright)

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install

# Install Playwright browsers
npx playwright install chromium
```

### 2. Configure Environment Variables

Create a `.env` file in the server directory:

```env
# Server Configuration
NODE_ENV=development
PORT=3001
HOST=localhost

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/tcad_scraper

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Scraper Configuration
SCRAPER_CONCURRENCY=2
SCRAPER_TIMEOUT=30000
SCRAPER_RETRY_ATTEMPTS=3
SCRAPER_RATE_LIMIT_DELAY=5000

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Logging
LOG_LEVEL=info
```

### 3. Setup Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations to create database tables
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

### 4. Start Services

#### Start Redis (using Docker):
```bash
docker run -d -p 6379:6379 redis:alpine
```

#### Or install Redis locally:
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis
```

### 5. Run the Server

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

### Scraping Operations

- `POST /api/properties/scrape` - Trigger a new scrape job
- `GET /api/properties/jobs/:jobId` - Get job status
- `GET /api/properties` - Get properties with filters
- `GET /api/properties/history` - Get scrape job history
- `GET /api/properties/stats` - Get statistics

### Monitoring

- `POST /api/properties/monitor` - Add search term for scheduled scraping
- `GET /api/properties/monitor` - Get monitored search terms

### Health Checks

- `GET /health` - Server health check
- `GET /health/queue` - Queue health check

### Admin

- `GET /admin/queues` - Bull Dashboard (visual queue monitoring)

## Queue Monitoring

Access the Bull Dashboard at `http://localhost:3001/admin/queues` to monitor:
- Active jobs
- Completed jobs
- Failed jobs
- Job progress
- Queue statistics

## Scheduled Jobs

The server automatically runs scheduled scrapes for monitored search terms:
- **Daily**: 2:00 AM CST
- **Weekly**: Sundays at 3:00 AM CST
- **Monthly**: 1st of each month at 4:00 AM CST

## Testing the Scraper

### 1. Test Connection
```bash
curl http://localhost:3001/health
```

### 2. Trigger a Scrape
```bash
curl -X POST http://localhost:3001/api/properties/scrape \
  -H "Content-Type: application/json" \
  -d '{"searchTerm": "test"}'
```

### 3. Check Job Status
```bash
curl http://localhost:3001/api/properties/jobs/{jobId}
```

### 4. Get Properties
```bash
curl http://localhost:3001/api/properties
```

## Development Tools

### TypeScript Watch Mode
```bash
npm run dev
```

### Database Management
```bash
# View and edit database
npm run prisma:studio

# Create new migration
doppler run -- npx prisma migrate dev --name your_migration_name

# Reset database (WARNING: deletes all data)
doppler run -- npx prisma migrate reset
```

### Logs
Logs are written to:
- Console (colored output in development)
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs

## Troubleshooting

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

### PostgreSQL Connection Issues
```bash
# Test database connection
psql postgresql://username:password@localhost:5432/tcad_scraper
```

### Playwright Issues
```bash
# Reinstall browsers
npx playwright install chromium

# Run with headed mode for debugging
# Set headless: false in scraper config
```

### Rate Limiting
The API implements rate limiting:
- General API: 100 requests per 15 minutes per IP
- Scrape endpoint: 5 requests per minute per IP
- Same search term: 5 second delay between requests

## Production Deployment

### 1. Build the Application
```bash
npm run build
```

### 2. Set Production Environment Variables
```bash
NODE_ENV=production
# Use production database and Redis URLs
```

### 3. Use Process Manager (PM2)
```bash
npm install -g pm2
pm2 start dist/index.js --name tcad-scraper-api
pm2 save
pm2 startup
```

### 4. Configure Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` file
2. **Database**: Use strong passwords and SSL connections
3. **API Keys**: Implement authentication for production
4. **CORS**: Configure allowed origins properly
5. **Rate Limiting**: Adjust limits based on your needs
6. **Input Validation**: All inputs are validated with Zod
7. **SQL Injection**: Protected by Prisma's parameterized queries

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React UI  │────▶│ Express API │────▶│   Bull      │
└─────────────┘     └─────────────┘     │   Queue     │
                            │            └─────────────┘
                            │                    │
                            ▼                    ▼
                    ┌─────────────┐      ┌─────────────┐
                    │ PostgreSQL  │      │ Playwright  │
                    └─────────────┘      │  Scraper    │
                                         └─────────────┘
```

## License

MIT