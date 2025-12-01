#!/bin/bash
#
# Run All Enqueue Scripts
# Executes all 10 enqueue scripts using Docker + Doppler
# Can run sequentially or in parallel
#
# Usage:
#   ./run-all-enqueue-scripts.sh         # Run sequentially
#   ./run-all-enqueue-scripts.sh parallel # Run in parallel
#

set -e

# Change to server directory (parent of scripts/)
cd "$(dirname "$0")/.."

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

MODE=${1:-sequential}

# All enqueue scripts
SCRIPTS=(
  "enqueue-trust-batch"            # Priority 1 - High yield
  "enqueue-investment-batch"       # Priority 1 - High yield
  "enqueue-commercial-batch"       # Priority 2
  "enqueue-llc-batch"             # Priority 2
  "enqueue-corporation-batch"      # Priority 2
  "enqueue-property-type-batch"    # Priority 2
  "enqueue-partnership-batch"      # Priority 3
  "enqueue-construction-batch"     # Priority 3
  "enqueue-foundation-batch"       # Priority 3
  "enqueue-residential-batch"      # Priority 4
)

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Running All 10 Enqueue Scripts                   ║${NC}"
echo -e "${BLUE}║        Mode: ${MODE}${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if doppler is configured
if ! doppler setup --silent 2>/dev/null; then
  echo -e "${RED}❌ Doppler not configured. Please run ./scripts/run-enqueue-script.sh first${NC}"
  exit 1
fi

# Ensure Docker services are running
if ! docker ps | grep -q "tcad-worker"; then
  echo -e "${BLUE}Starting Docker Compose services...${NC}"
  cd .. && docker compose up -d
  cd server
  echo -e "${YELLOW}⏳ Waiting 10 seconds for services to initialize...${NC}"
  sleep 10
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

if [ "$MODE" = "parallel" ]; then
  echo -e "${BLUE}🚀 Running all scripts in PARALLEL${NC}"
  echo -e "${YELLOW}⚠️  This will queue all 100 jobs simultaneously${NC}"
  echo ""

  PIDS=()

  for script in "${SCRIPTS[@]}"; do
    echo -e "${BLUE}Starting: ${script}${NC}"
    doppler run -- npx tsx "./src/scripts/${script}.ts" > "/tmp/${script}.log" 2>&1 &
    PIDS+=($!)
  done

  echo ""
  echo -e "${YELLOW}⏳ Waiting for all scripts to complete...${NC}"

  FAILED=0
  for i in "${!PIDS[@]}"; do
    wait ${PIDS[$i]}
    EXIT_CODE=$?
    script="${SCRIPTS[$i]}"

    if [ $EXIT_CODE -eq 0 ]; then
      echo -e "${GREEN}✅ ${script} completed${NC}"
    else
      echo -e "${RED}❌ ${script} failed (exit code: ${EXIT_CODE})${NC}"
      FAILED=$((FAILED + 1))
    fi
  done

  echo ""
  if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All scripts completed successfully!${NC}"
  else
    echo -e "${YELLOW}⚠️  ${FAILED} script(s) failed${NC}"
  fi

else
  echo -e "${BLUE}🐢 Running all scripts SEQUENTIALLY${NC}"
  echo -e "${BLUE}This will take longer but is more controlled${NC}"
  echo ""

  COMPLETED=0
  FAILED=0

  for script in "${SCRIPTS[@]}"; do
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Running: ${script} [${COMPLETED}/${#SCRIPTS[@]}]${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if doppler run -- npx tsx "./src/scripts/${script}.ts"; then
      COMPLETED=$((COMPLETED + 1))
      echo -e "${GREEN}✅ Completed: ${script}${NC}"
    else
      FAILED=$((FAILED + 1))
      echo -e "${RED}❌ Failed: ${script}${NC}"
    fi

    echo ""
    echo -e "${YELLOW}⏳ Waiting 5 seconds before next script...${NC}"
    sleep 5
  done

  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}FINAL SUMMARY${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✅ Completed: ${COMPLETED}/${#SCRIPTS[@]}${NC}"
  echo -e "${RED}❌ Failed: ${FAILED}/${#SCRIPTS[@]}${NC}"
  echo ""

  if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All scripts completed successfully!${NC}"
  else
    echo -e "${YELLOW}⚠️  Some scripts failed. Check logs above.${NC}"
  fi
fi

echo ""
echo -e "${BLUE}📊 Total jobs queued: ~100 (10 per script)${NC}"
echo -e "${BLUE}📊 Monitor at: http://localhost:5050/admin/queues${NC}"
echo ""
echo -e "${GREEN}✨ Done!${NC}"
