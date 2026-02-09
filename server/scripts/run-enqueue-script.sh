#!/bin/bash
#
# Docker + Doppler Enqueue Script Runner
# Runs a batch enqueue using the unified enqueue-batch.ts script
#
# Usage: ./run-enqueue-script.sh <batch-type>
# Example: ./run-enqueue-script.sh trust
#
# For a list of available types: ./run-enqueue-script.sh --list
#

set -e

# Change to server directory (parent of scripts/)
cd "$(dirname "$0")/.."

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

BATCH_TYPE=$1

if [ -z "$BATCH_TYPE" ]; then
  echo -e "${RED}Error: No batch type provided${NC}"
  echo ""
  echo "Usage: ./run-enqueue-script.sh <batch-type>"
  echo ""
  doppler run -- npx tsx "./src/scripts/enqueue-batch.ts" --list
  exit 1
fi

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Enqueue Script Runner                                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if doppler is configured
if ! doppler setup --silent 2>/dev/null; then
  echo -e "${RED}Doppler not configured. Run 'doppler setup' first.${NC}"
  exit 1
fi

doppler run -- npx tsx "./src/scripts/enqueue-batch.ts" "$BATCH_TYPE"

echo ""
echo -e "${GREEN}Done!${NC}"
