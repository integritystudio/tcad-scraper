#!/usr/bin/env bash
# Pack workers/ only.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

repomix --include "workers/**" -o "$OUT_DIR/workers.xml" --quiet
echo "Wrote $OUT_DIR/workers.xml"
