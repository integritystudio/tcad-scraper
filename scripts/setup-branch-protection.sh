#!/bin/bash

# GitHub Branch Protection Setup Script
# This script configures branch protection rules for the main branch

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "GitHub Branch Protection Setup"
echo "=========================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}✗${NC} GitHub CLI (gh) is not installed"
    echo ""
    echo "Install GitHub CLI:"
    echo "  macOS: brew install gh"
    echo "  Linux: See https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  Windows: See https://github.com/cli/cli/releases"
    echo ""
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}✗${NC} Not authenticated with GitHub"
    echo ""
    echo "Please authenticate:"
    echo "  gh auth login"
    echo ""
    exit 1
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Repository: $REPO"
echo ""

# Get current branch
BRANCH=${1:-main}
echo "Configuring protection for branch: $BRANCH"
echo ""

# Enable branch protection
echo "Setting up branch protection rules..."

# Create branch protection rule
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/$REPO/branches/$BRANCH/protection" \
  -f "required_status_checks[strict]=true" \
  -f "required_status_checks[contexts][]=CI Pipeline Success" \
  -f "required_status_checks[contexts][]=Lint & Type Check (ubuntu-latest)" \
  -f "required_status_checks[contexts][]=Build Verification (ubuntu-latest)" \
  -f "enforce_admins=false" \
  -f "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  -f "required_pull_request_reviews[require_code_owner_reviews]=false" \
  -f "required_pull_request_reviews[required_approving_review_count]=1" \
  -f "required_pull_request_reviews[require_last_push_approval]=false" \
  -f "restrictions=null" \
  -f "required_linear_history=false" \
  -f "allow_force_pushes=false" \
  -f "allow_deletions=false" \
  -f "block_creations=false" \
  -f "required_conversation_resolution=true" \
  -f "lock_branch=false" \
  -f "allow_fork_syncing=true"

echo ""
echo -e "${GREEN}✓${NC} Branch protection enabled successfully!"
echo ""

echo "Protection rules configured:"
echo "  ✓ Require pull request reviews (1 approval)"
echo "  ✓ Dismiss stale pull request approvals"
echo "  ✓ Require status checks to pass"
echo "  ✓ Require branches to be up to date before merging"
echo "  ✓ Require conversation resolution before merging"
echo "  ✓ Prevent force pushes"
echo "  ✓ Prevent branch deletion"
echo ""

echo "Required status checks:"
echo "  - CI Pipeline Success"
echo "  - Lint & Type Check (ubuntu-latest)"
echo "  - Build Verification (ubuntu-latest)"
echo ""

echo -e "${YELLOW}Note:${NC} Admin enforcement is disabled to allow emergency fixes"
echo ""
echo "To verify protection rules:"
echo "  gh api repos/$REPO/branches/$BRANCH/protection | jq"
echo ""
echo "To view in browser:"
echo "  gh repo view --web -s /settings/branches"
echo ""
