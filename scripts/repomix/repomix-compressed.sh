#!/usr/bin/env bash
# Pack the full repo compressed (code-structure only), excluding documentation and tests.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

repomix --compress --ignore "$DOC_PATTERNS,$TEST_PATTERNS" -o "$OUT_DIR/compressed.xml" --quiet
echo "Wrote $OUT_DIR/compressed.xml"
