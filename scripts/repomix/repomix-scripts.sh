#!/usr/bin/env bash
# Pack scripts/ only.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

repomix --include "scripts/**" -o "$OUT_DIR/scripts.xml" --quiet
echo "Wrote $OUT_DIR/scripts.xml"
