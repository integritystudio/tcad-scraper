#!/usr/bin/env bash
# Pack documentation files only.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

repomix --include "$DOC_PATTERNS" -o "$OUT_DIR/docs.xml" --quiet
echo "Wrote $OUT_DIR/docs.xml"
