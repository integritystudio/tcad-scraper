#!/usr/bin/env bash
# Pack test files only.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

repomix --include "$TEST_PATTERNS" -o "$OUT_DIR/tests.xml" --quiet
echo "Wrote $OUT_DIR/tests.xml"
