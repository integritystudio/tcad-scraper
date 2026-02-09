# Enqueue Scripts - Unified Batch Runner

A single config-driven script replaces 10 individual enqueue scripts. All batch types are defined in `src/scripts/config/batch-configs.ts` and executed via `src/scripts/enqueue-batch.ts`.

## Auto-Refreshed API Tokens

All scripts automatically use the auto-refreshed TCAD API token system:

- Tokens are automatically refreshed every 4.5 minutes
- No manual token management required
- Configured via `TCAD_AUTO_REFRESH_TOKEN=true` (enabled by default)

## Available Batch Types

| Type | Name | Terms | Priority | Est. Properties |
|------|------|-------|----------|-----------------|
| trust | Trust & Estate | 10 | High | ~700 |
| investment | Investment & Holdings | 10 | High | ~600 |
| commercial | Commercial | 10 | Medium | ~400 |
| llc | LLC-owned | 10 | Medium | ~350 |
| corporation | Corporation-owned | 10 | Medium | ~350 |
| propertytype | Property Type | 10 | Medium | ~300 |
| partnership | Partnership | 10 | Standard | ~250 |
| construction | Construction & Builder | 10 | Standard | ~200 |
| foundation | Foundation & Nonprofit | 10 | Standard | ~150 |
| residential | Residential Names | 10 | Low | ~100 |

**Total**: ~100 jobs across 10 batch types, ~3,400 estimated properties.

## Quick Start

### Prerequisites

1. **Doppler CLI** installed and configured:
   ```bash
   brew install dopplerhq/cli/doppler
   doppler login
   doppler setup --project integrity-studio --config dev
   ```

2. **Environment variables** in Doppler:
   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_HOST` / `REDIS_PORT` - Redis connection
   - `TCAD_AUTO_REFRESH_TOKEN=true`

### Running Scripts

#### Run a single batch type

```bash
cd /home/aledlie/tcad-scraper/server

# Via shell wrapper (handles Doppler)
./scripts/run-enqueue-script.sh trust

# Or directly with Doppler
doppler run -- npx tsx src/scripts/enqueue-batch.ts trust
```

#### Run all batch types

```bash
# Via shell wrapper
./scripts/run-all-enqueue-scripts.sh

# Or directly
doppler run -- npx tsx src/scripts/enqueue-batch.ts --all
```

#### List available batch types

```bash
doppler run -- npx tsx src/scripts/enqueue-batch.ts --list
```

#### Run multiple specific types

```bash
doppler run -- npx tsx src/scripts/enqueue-batch.ts trust llc commercial
```

## Monitoring

- **Queue Dashboard**: http://localhost:5050/admin/queues
- **Metrics**: http://localhost:4000/metrics

## Architecture

### Config file: `src/scripts/config/batch-configs.ts`

All batch types defined as data:

```typescript
export const BATCH_CONFIGS: Record<string, BatchConfigEntry> = {
  trust: {
    batchName: "Trust & Estate",
    terms: ["Trust", "Family Trust", "Living Trust", ...],
    userId: "trust-batch-enqueue",
  },
  // ... 9 more batch types
};
```

### Runner: `src/scripts/enqueue-batch.ts`

Single CLI entry point with `--list`, `--all`, `--help` flags.

### Adding a new batch type

Add an entry to `batch-configs.ts`:

```typescript
export const BATCH_CONFIGS = {
  // ... existing types
  mynewtype: {
    batchName: "My New Type",
    emoji: "...",
    terms: ["Term1", "Term2"],
    userId: "mynewtype-batch-enqueue",
  },
};
```

No new scripts needed - the runner picks it up automatically.

## Troubleshooting

**Doppler not configured?**
```bash
doppler login && doppler setup --project integrity-studio --config dev
```

**Docker services not running?**
```bash
cd /home/aledlie/tcad-scraper && docker compose up -d
```

**Token refresh not working?**
```bash
docker logs tcad-worker | grep -i token
```

**Permission denied on shell scripts?**
```bash
chmod +x scripts/run-enqueue-script.sh scripts/run-all-enqueue-scripts.sh
```

## Related Files

- `src/scripts/config/batch-configs.ts` - Batch type definitions
- `src/scripts/enqueue-batch.ts` - CLI runner
- `src/scripts/utils/batch-enqueue.ts` - Generic enqueue logic
- `src/services/token-refresh.service.ts` - Auto-refresh implementation
- `src/queues/scraper.queue.ts` - Queue processor
