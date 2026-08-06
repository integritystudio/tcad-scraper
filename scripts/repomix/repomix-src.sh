#!/usr/bin/env bash
# Pack src/ (frontend) only.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

repomix --include "src/**" -o "$OUT_DIR/src.xml" --quiet
echo "Wrote $OUT_DIR/src.xml"
