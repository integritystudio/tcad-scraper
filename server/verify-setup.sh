#!/bin/bash
#
# Verify Enqueue Scripts Setup
# Checks all prerequisites for running enqueue scripts with Docker + Doppler
#

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Enqueue Scripts Setup Verification                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check 1: Doppler CLI
echo -n "Checking Doppler CLI... "
if command -v doppler &> /dev/null; then
  VERSION=$(doppler --version | head -n 1)
  echo -e "${GREEN}✓ Installed ($VERSION)${NC}"
else
  echo -e "${RED}✗ Not installed${NC}"
  echo -e "${YELLOW}  Install: curl -Ls https://cli.doppler.com/install.sh | sh${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check 2: Doppler Configuration
echo -n "Checking Doppler configuration... "
if doppler setup --silent 2>/dev/null; then
  PROJECT=$(doppler configure get project.config 2>/dev/null || echo "unknown")
  echo -e "${GREEN}✓ Configured (${PROJECT})${NC}"
else
  echo -e "${RED}✗ Not configured${NC}"
  echo -e "${YELLOW}  Run: doppler login && doppler setup${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check 3: Docker
echo -n "Checking Docker... "
if command -v docker &> /dev/null; then
  VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
  echo -e "${GREEN}✓ Installed (${VERSION})${NC}"
else
  echo -e "${RED}✗ Not installed${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check 4: Docker Compose
echo -n "Checking Docker Compose... "
if docker compose version &> /dev/null; then
  VERSION=$(docker compose version --short)
  echo -e "${GREEN}✓ Installed (${VERSION})${NC}"
else
  echo -e "${RED}✗ Not installed${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check 5: Docker Services
echo -n "Checking Docker services... "
if docker ps &> /dev/null; then
  if docker ps | grep -q "tcad-worker\|bullmq-redis\|tcad-postgres"; then
    SERVICES=$(docker ps --format "{{.Names}}" | grep -E "tcad-worker|bullmq-redis|tcad-postgres" | wc -l)
    echo -e "${GREEN}✓ Running (${SERVICES}/3 services)${NC}"

    if [ $SERVICES -lt 3 ]; then
      echo -e "${YELLOW}  ⚠️  Not all services running. Run: cd .. && docker compose up -d${NC}"
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    echo -e "${YELLOW}⚠ Not running${NC}"
    echo -e "${YELLOW}  Start with: cd .. && docker compose up -d${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}✗ Docker daemon not running${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check 6: Node.js / npm
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
  VERSION=$(node --version)
  echo -e "${GREEN}✓ Installed (${VERSION})${NC}"
else
  echo -e "${RED}✗ Not installed${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check 7: npx / tsx
echo -n "Checking npx... "
if command -v npx &> /dev/null; then
  echo -e "${GREEN}✓ Available${NC}"
else
  echo -e "${RED}✗ Not available${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check 8: Required Environment Variables (from Doppler)
if doppler setup --silent 2>/dev/null; then
  echo ""
  echo -e "${BLUE}Checking Doppler Secrets:${NC}"

  check_secret() {
    local SECRET_NAME=$1
    local REQUIRED=$2

    echo -n "  Checking ${SECRET_NAME}... "
    VALUE=$(doppler secrets get ${SECRET_NAME} --plain 2>/dev/null || echo "")

    if [ -n "$VALUE" ]; then
      # Mask value for security
      if [ ${#VALUE} -gt 10 ]; then
        MASKED="${VALUE:0:5}...${VALUE: -3}"
      else
        MASKED="***"
      fi
      echo -e "${GREEN}✓ Set (${MASKED})${NC}"
    else
      if [ "$REQUIRED" = "required" ]; then
        echo -e "${RED}✗ Missing${NC}"
        ERRORS=$((ERRORS + 1))
      else
        echo -e "${YELLOW}⚠ Missing (optional)${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
    fi
  }

  check_secret "DATABASE_URL" "required"
  check_secret "REDIS_HOST" "required"
  check_secret "REDIS_PORT" "required"
  check_secret "TCAD_AUTO_REFRESH_TOKEN" "optional"
  check_secret "TCAD_TOKEN_REFRESH_INTERVAL" "optional"
fi

# Check 9: Enqueue Scripts
echo ""
echo -n "Checking enqueue scripts... "
SCRIPT_COUNT=$(ls -1 src/scripts/enqueue-*.ts 2>/dev/null | wc -l)
if [ $SCRIPT_COUNT -ge 10 ]; then
  echo -e "${GREEN}✓ Found ${SCRIPT_COUNT} scripts${NC}"
else
  echo -e "${YELLOW}⚠ Found ${SCRIPT_COUNT} scripts (expected 10+)${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# Check 10: Runner Scripts
echo -n "Checking runner scripts... "
if [ -x "./run-enqueue-script.sh" ] && [ -x "./run-all-enqueue-scripts.sh" ]; then
  echo -e "${GREEN}✓ Available and executable${NC}"
else
  echo -e "${YELLOW}⚠ Not executable${NC}"
  echo -e "${YELLOW}  Run: chmod +x run-*.sh${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# Check 11: Auto-Refresh Service
if docker ps | grep -q "tcad-worker"; then
  echo -n "Checking auto-refresh service... "
  if docker logs tcad-worker 2>&1 | grep -q "Token refresh service initialized"; then
    echo -e "${GREEN}✓ Running${NC}"
  else
    echo -e "${YELLOW}⚠ Not detected in logs${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! You're ready to run enqueue scripts.${NC}"
  echo ""
  echo -e "${BLUE}Quick Start:${NC}"
  echo -e "  ./run-enqueue-script.sh enqueue-trust-batch"
  echo -e "  ./run-all-enqueue-scripts.sh"
  echo ""
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Setup is functional with ${WARNINGS} warning(s)${NC}"
  echo -e "${YELLOW}You can proceed but some features may not work optimally.${NC}"
  echo ""
else
  echo -e "${RED}❌ Setup incomplete: ${ERRORS} error(s), ${WARNINGS} warning(s)${NC}"
  echo -e "${RED}Please address the errors above before running enqueue scripts.${NC}"
  echo ""
  exit 1
fi

echo -e "${BLUE}📖 For more information, see: ENQUEUE_SCRIPTS_README.md${NC}"
