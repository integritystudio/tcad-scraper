#!/usr/bin/env bash
# Pack the full repo, excluding documentation and tests.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

repomix --ignore "$DOC_PATTERNS,$TEST_PATTERNS" -o "$OUT_DIR/full.xml" --quiet
echo "Wrote $OUT_DIR/full.xml"
