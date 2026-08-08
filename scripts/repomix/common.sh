#!/usr/bin/env bash
# Shared configuration for repomix scripts. Source, don't execute.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$REPO_ROOT/docs/repomix"

# Test file patterns (comma-separated globs for --include / --ignore)
TEST_PATTERNS="**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx,**/__tests__/**,e2e/**,**/vitest.config.*,**/playwright.config.*"

# Documentation patterns
DOC_PATTERNS="docs/**,**/*.md"
CHANGELOG_PATTERNS="docs/changelog/**"

mkdir -p "$OUT_DIR"
cd "$REPO_ROOT"
