# Setup

Getting the TCAD Scraper running locally.

## Prerequisites

- **Node.js** 20+ and npm
- **Docker** (optional — only needed if running Redis locally instead of Render)
- **Doppler CLI** (for secrets)
- **Playwright** (`npx playwright install chromium`)

## 1. Install Dependencies

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

## 2. Configure Doppler

```bash
doppler login
doppler setup  # Project: integrity-studio, Config: dev
```

See [doppler-setup.md](doppler-setup.md) for detailed Doppler CLI installation.

## 3. Connect to Database

```bash
# Verify DB access
doppler run -- npx prisma db pull

# Generate Prisma client
npx prisma generate
```

PostgreSQL runs on Render. Connection string is managed via Doppler.

## 4. Start Services

Redis is hosted on Render and configured via Doppler (`REDIS_URL=rediss://...`). No local Redis required.

```bash
# Start backend (from server/)
doppler run -- npm run dev

# Start frontend (from root)
doppler run -- npm run dev
```

> **Offline/fallback**: If you need local Redis, run `docker run -d --name tcad-redis -p 6379:6379 redis:7-alpine` and set `REDIS_URL=redis://localhost:6379` in Doppler.

## Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5174 |
| Backend API | http://localhost:3001 |
| Bull Dashboard | http://localhost:3001/admin/queues |

## Verify

```bash
# Health check
curl http://localhost:3001/health

# Run tests
cd server && npm test
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| DB connection failed | Check DATABASE_URL in Doppler, verify Render DB status |
| Redis connection refused | Check `REDIS_URL` in Doppler; verify Render Redis status or start local Docker Redis |
| Doppler not configured | `doppler login && doppler setup` |
| Prisma client missing | `npx prisma generate` |
