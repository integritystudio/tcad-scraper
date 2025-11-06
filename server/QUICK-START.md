# Quick Start Guide - Enqueue Scripts

## 🚀 Run Your First Script (30 seconds)

```bash
cd /home/aledlie/tcad-scraper/server

# Run a single high-yield script
./run-enqueue-script.sh enqueue-trust-batch
```

## 🎯 Run All Scripts

```bash
# Sequential (safer, 5-10 minutes)
./run-all-enqueue-scripts.sh

# Parallel (faster, 30-60 seconds)
./run-all-enqueue-scripts.sh parallel
```

## 📊 Monitor Jobs

Open in browser:
- **Queue Dashboard**: http://localhost:5050/admin/queues
- **Metrics**: http://localhost:4000/metrics

## ✅ Verify Setup

```bash
./verify-setup.sh
```

## 🔑 Key Features

✨ **Auto-Refreshed API Tokens** - Tokens refresh automatically every 4.5 minutes
🐳 **Docker Integration** - Runs in isolated containers
🔐 **Doppler Secrets** - Secure credential management
📈 **Priority Queueing** - High-yield searches run first

## 📚 Full Documentation

See `ENQUEUE_SCRIPTS_README.md` for complete details.

## 🆘 Troubleshooting

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

**Need Help?** See ENQUEUE_SCRIPTS_README.md for detailed troubleshooting.
