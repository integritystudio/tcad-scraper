# Quick Start Guide - Enqueue Scripts

## Run Your First Batch (30 seconds)

```bash
cd /home/aledlie/tcad-scraper/server

# Run a single batch type
./scripts/run-enqueue-script.sh trust
```

## Run All Batches

```bash
./scripts/run-all-enqueue-scripts.sh
```

## List Available Batch Types

```bash
./scripts/run-enqueue-script.sh --list
```

## Monitor Jobs

Open in browser:
- **Queue Dashboard**: http://localhost:5050/admin/queues
- **Metrics**: http://localhost:4000/metrics

## Verify Setup

```bash
./scripts/verify-setup.sh
```

## Key Features

- **Config-driven** - All 10 batch types in a single config file
- **Auto-refreshed API tokens** - Tokens refresh automatically every 4.5 minutes
- **Doppler secrets** - Secure credential management
- **Priority queueing** - High-yield searches run first

## Troubleshooting

**Doppler not configured?**
```bash
doppler setup --project integrity-studio --config dev
```

**Services not running?**
```bash
cd /home/aledlie/tcad-scraper
docker compose up -d
```

**Check logs:**
```bash
docker logs tcad-worker -f
```

---

See `ENQUEUE_SCRIPTS_README.md` for detailed documentation.
