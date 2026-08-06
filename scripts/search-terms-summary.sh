#!/bin/bash
# Recent search terms table from production D1.
# Thin wrapper — the implementation lives in search-terms-summary.ts.
set -euo pipefail

cd "$(dirname "$0")/.." && exec doppler run -- npx tsx scripts/search-terms-summary.ts "$@"
