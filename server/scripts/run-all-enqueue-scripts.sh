#!/bin/bash
#
# Run All Enqueue Batch Types
# Uses the unified enqueue-batch.ts script with --all flag
#
# Usage:
#   ./run-all-enqueue-scripts.sh
#

set -e

# Change to server directory (parent of scripts/)
cd "$(dirname "$0")/.."

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Running All Batch Enqueue Types                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if doppler is configured
if ! doppler setup --silent 2>/dev/null; then
  echo -e "${RED}Doppler not configured. Run 'doppler setup' first.${NC}"
  exit 1
fi

doppler run -- npx tsx "./src/scripts/enqueue-batch.ts" --all

echo ""
echo -e "${GREEN}Done!${NC}"
