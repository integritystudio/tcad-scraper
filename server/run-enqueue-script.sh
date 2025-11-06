#!/bin/bash
#
# Docker + Doppler Enqueue Script Runner
# Runs enqueue scripts using Docker with Doppler authentication
# Ensures auto-refreshed API tokens are used
#
# Usage: ./run-enqueue-script.sh <script-name>
# Example: ./run-enqueue-script.sh enqueue-trust-batch
#

set -e

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Script name (without .ts extension)
SCRIPT_NAME=$1

if [ -z "$SCRIPT_NAME" ]; then
  echo -e "${RED}❌ Error: No script name provided${NC}"
  echo ""
  echo "Usage: ./run-enqueue-script.sh <script-name>"
  echo ""
  echo "Available scripts:"
  echo "  - enqueue-residential-batch"
  echo "  - enqueue-commercial-batch"
  echo "  - enqueue-trust-batch"
  echo "  - enqueue-llc-batch"
  echo "  - enqueue-corporation-batch"
  echo "  - enqueue-partnership-batch"
  echo "  - enqueue-property-type-batch"
  echo "  - enqueue-investment-batch"
  echo "  - enqueue-construction-batch"
  echo "  - enqueue-foundation-batch"
  exit 1
fi

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Docker + Doppler Enqueue Script Runner                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if doppler is installed
if ! command -v doppler &> /dev/null; then
  echo -e "${RED}❌ Doppler CLI not found. Please install it first.${NC}"
  echo "Visit: https://docs.doppler.com/docs/install-cli"
  exit 1
fi

# Check if doppler is configured
if ! doppler setup --silent 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Doppler not configured. Setting up...${NC}"
  echo ""
  echo -e "${BLUE}Please authenticate with Doppler:${NC}"
  doppler login
  echo ""
  echo -e "${BLUE}Please select your project and config:${NC}"
  doppler setup
fi

echo -e "${GREEN}✓ Doppler configured${NC}"
echo ""

# Check if script file exists
SCRIPT_PATH="./src/scripts/${SCRIPT_NAME}.ts"
if [ ! -f "$SCRIPT_PATH" ]; then
  echo -e "${RED}❌ Script not found: ${SCRIPT_PATH}${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Script found: ${SCRIPT_NAME}${NC}"
echo ""

# Check if Docker containers are running
if ! docker ps | grep -q "tcad-worker"; then
  echo -e "${YELLOW}⚠️  TCAD worker container not running${NC}"
  echo -e "${BLUE}Starting Docker Compose services...${NC}"
  cd .. && docker compose up -d
  cd server
  echo ""
  echo -e "${GREEN}✓ Services started${NC}"
  echo -e "${YELLOW}⏳ Waiting 10 seconds for services to initialize...${NC}"
  sleep 10
fi

echo -e "${GREEN}✓ Docker services running${NC}"
echo ""

# Run the script using doppler and tsx
echo -e "${BLUE}📝 Running script: ${SCRIPT_NAME}${NC}"
echo -e "${BLUE}─────────────────────────────────────────────────────────${NC}"
echo ""

# Execute with doppler run to inject secrets
doppler run -- npx tsx "${SCRIPT_PATH}"

EXIT_CODE=$?

echo ""
echo -e "${BLUE}─────────────────────────────────────────────────────────${NC}"

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ Script completed successfully!${NC}"
  echo ""
  echo -e "${BLUE}📊 Monitor jobs at: http://localhost:5050/admin/queues${NC}"
else
  echo -e "${RED}❌ Script failed with exit code: ${EXIT_CODE}${NC}"
  exit $EXIT_CODE
fi
