# Enqueue Scripts - Docker + Doppler Setup

This directory contains 10 automated enqueue scripts that queue property scraping jobs using Docker and Doppler authentication with auto-refreshed API tokens.

## 🔐 Auto-Refreshed API Tokens

All scripts automatically use the **auto-refreshed TCAD API token system**:

- ✅ Tokens are automatically refreshed every 4.5 minutes
- ✅ No manual token management required
- ✅ Continuous operation without interruption
- ✅ Configured via `TCAD_AUTO_REFRESH_TOKEN=true` (enabled by default)

The token refresh service is initialized automatically when the worker starts and provides fresh tokens to all scraping operations.

## 📋 Available Scripts

### High Priority (Expected High Yield ~70+ properties/search)
1. **enqueue-trust-batch.ts** - Trust & Estate properties
2. **enqueue-investment-batch.ts** - Investment & Holdings properties

### Medium Priority (Good Yield)
3. **enqueue-commercial-batch.ts** - Commercial properties
4. **enqueue-llc-batch.ts** - LLC-owned properties
5. **enqueue-corporation-batch.ts** - Corporation-owned properties
6. **enqueue-property-type-batch.ts** - Property type searches

### Standard Priority
7. **enqueue-partnership-batch.ts** - Partnership properties
8. **enqueue-construction-batch.ts** - Construction & Builder properties
9. **enqueue-foundation-batch.ts** - Foundation & Nonprofit properties
10. **enqueue-residential-batch.ts** - Residential name searches

Each script queues **10 search terms**, for a total of **~100 jobs** across all scripts.

## 🚀 Quick Start

### Prerequisites

1. **Docker** must be installed and running
2. **Doppler CLI** must be installed:
   ```bash
   # Install Doppler CLI
   curl -Ls https://cli.doppler.com/install.sh | sh

   # Or on macOS
   brew install dopplerhq/cli/doppler
   ```

3. **Doppler authentication** must be configured:
   ```bash
   doppler login
   doppler setup
   ```

4. **Environment variables** in Doppler must include:
   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_HOST` - Redis host
   - `REDIS_PORT` - Redis port
   - `TCAD_AUTO_REFRESH_TOKEN=true` - Enable auto-refresh (default)
   - `TCAD_TOKEN_REFRESH_INTERVAL=270000` - Refresh every 4.5 minutes
   - Other required configuration (see `.env.example`)

### Running Scripts

#### Option 1: Run Individual Script

```bash
cd /home/aledlie/tcad-scraper/server

# Run a single script
./scripts/run-enqueue-script.sh enqueue-trust-batch

# Run another script
./scripts/run-enqueue-script.sh enqueue-investment-batch
```

#### Option 2: Run All Scripts Sequentially

```bash
# Runs all 10 scripts one after another (safer, more controlled)
./scripts/run-all-enqueue-scripts.sh
```

This will:
- Queue 10 jobs from each script
- Wait 5 seconds between scripts
- Show detailed progress
- Total time: ~5-10 minutes

#### Option 3: Run All Scripts in Parallel

```bash
# Runs all 10 scripts simultaneously (faster but more intense)
./scripts/run-all-enqueue-scripts.sh parallel
```

This will:
- Queue all 100 jobs at once
- Complete in ~30-60 seconds
- Requires more system resources

## 📊 Monitoring

After queuing jobs, monitor them at:

```
http://localhost:5050/admin/queues
```

Or check queue metrics at:

```
http://localhost:4000/metrics
```

## 🔧 How It Works

### 1. Doppler Authentication

Each script runner:
1. Checks if Doppler is installed and configured
2. Uses `doppler run` to inject secrets as environment variables
3. Passes all configuration to the Node.js script

### 2. Auto-Refreshed Tokens

The system automatically:
1. Starts token refresh service when worker initializes
2. Fetches a fresh TCAD API token every 4.5 minutes
3. Provides the latest token to all scraping operations
4. Handles token expiration transparently

See `src/services/token-refresh.service.ts` for implementation details.

### 3. Job Queueing

Each script:
1. Connects to Redis via BullMQ
2. Adds jobs with configurable priority
3. Includes retry logic (3 attempts with exponential backoff)
4. Logs success/failure for each term

### 4. Job Processing

Workers automatically:
1. Pick up jobs from the queue
2. Use auto-refreshed API token for scraping
3. Save results to PostgreSQL
4. Update job status

## 🛠️ Script Structure

Each enqueue script follows this pattern:

```typescript
import { scraperQueue } from '../queues/scraper.queue';
import { logger } from '../lib/logger';
import { config } from '../config';

const SEARCH_TERMS = ['Term1', 'Term2', ...];

async function enqueueJobs() {
  logger.info('Starting batch enqueue');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);

  for (const term of SEARCH_TERMS) {
    await scraperQueue.add('scrape-properties', {
      searchTerm: term,
      userId: 'batch-enqueue',
      scheduled: true,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      priority: 1-4, // Based on expected yield
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }
}
```

## 📈 Expected Results

| Script | Terms | Priority | Est. Properties | Notes |
|--------|-------|----------|-----------------|-------|
| Trust Batch | 10 | 1 (High) | ~700 | Best yield |
| Investment Batch | 10 | 1 (High) | ~600 | High yield |
| Commercial Batch | 10 | 2 (Med) | ~400 | Good yield |
| LLC Batch | 10 | 2 (Med) | ~350 | Good yield |
| Corporation Batch | 10 | 2 (Med) | ~350 | Good yield |
| Property Type Batch | 10 | 2 (Med) | ~300 | Moderate |
| Partnership Batch | 10 | 3 (Std) | ~250 | Standard |
| Construction Batch | 10 | 3 (Std) | ~200 | Standard |
| Foundation Batch | 10 | 3 (Std) | ~150 | Lower yield |
| Residential Batch | 10 | 4 (Low) | ~100 | Lowest yield |

**Total Expected**: ~3,400 properties from 100 search terms

## 🐳 Docker Integration

### Services Running

When you run the scripts, these Docker services should be active:

```yaml
services:
  postgres:      # Database for storing properties
  redis:         # Queue backend
  tcad-worker:   # Processes scraping jobs (auto-refresh token enabled)
  bullmq-metrics: # Metrics exporter
```

### Check Services

```bash
docker ps

# Should show:
# - tcad-postgres
# - bullmq-redis
# - tcad-worker
# - bullmq-metrics
```

### View Worker Logs

```bash
docker logs tcad-worker -f

# You should see:
# - "Token refresh service initialized"
# - Job processing logs
# - "Using token from auto-refresh service"
```

## 🔍 Troubleshooting

### Doppler Not Configured

```bash
# Run this to configure Doppler
doppler login
doppler setup
```

### Docker Services Not Running

```bash
# Start services manually
cd /home/aledlie/tcad-scraper
docker compose up -d

# Check status
docker ps
```

### Auto-Refresh Not Working

Check the worker logs:

```bash
docker logs tcad-worker | grep -i token

# Should see:
# "Token refresh service initialized"
# "Using token from auto-refresh service"
```

Verify configuration:

```bash
doppler secrets get TCAD_AUTO_REFRESH_TOKEN
# Should return: true

doppler secrets get TCAD_TOKEN_REFRESH_INTERVAL
# Should return: 270000 (4.5 minutes)
```

### Jobs Failing

Check:
1. Database connection: `doppler secrets get DATABASE_URL`
2. Redis connection: `docker logs tcad-worker | grep -i redis`
3. API token: `docker logs tcad-worker | grep -i "token"`
4. Queue dashboard: http://localhost:5050/admin/queues

### Permission Denied

```bash
chmod +x scripts/run-enqueue-script.sh
chmod +x scripts/run-all-enqueue-scripts.sh
```

## 📝 Creating New Scripts

To create a new enqueue script:

1. Copy an existing script:
   ```bash
   cp src/scripts/enqueue-trust-batch.ts src/scripts/enqueue-mynew-batch.ts
   ```

2. Edit the terms array and metadata:
   ```typescript
   const MY_NEW_TERMS = ['Term1', 'Term2', ...];
   ```

3. Update the userId and logging:
   ```typescript
   userId: 'mynew-batch-enqueue'
   ```

4. Test it:
   ```bash
   ./scripts/run-enqueue-script.sh enqueue-mynew-batch
   ```

## 🎯 Best Practices

1. **Start Small**: Test with 1-2 scripts before running all 10
2. **Monitor First**: Watch the dashboard to ensure jobs are processing
3. **Check Logs**: Verify auto-refresh is working via worker logs
4. **Sequential First**: Use sequential mode first, then try parallel if needed
5. **Prioritize**: High-priority searches (Trust, Investment) should run first
6. **Rate Limits**: Be aware of TCAD API rate limits (auto-refresh helps but doesn't bypass limits)

## 🔗 Related Files

- `src/services/token-refresh.service.ts` - Auto-refresh implementation
- `src/queues/scraper.queue.ts` - Queue processor
- `src/lib/tcad-scraper.ts` - Scraper with auto-refresh integration
- `src/config/index.ts` - Configuration management
- `docker-compose.yml` - Docker services
- `Dockerfile` - Worker container

## 📚 Additional Resources

- [Doppler Documentation](https://docs.doppler.com/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## ✅ Summary

- **10 scripts** for different property types
- **~100 total jobs** across all scripts
- **Auto-refreshed API tokens** - no manual management
- **Docker + Doppler** integration for secure secret management
- **Easy to use** - single command execution
- **Monitoring** - real-time queue dashboard
- **Flexible** - run individually, sequentially, or in parallel

Happy scraping! 🎉
