#!/usr/bin/env bash
# Pack docs/changelog/ only (kept separate from docs.xml — see repomix-docs.sh).
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

repomix --include "$CHANGELOG_PATTERNS" -o "$OUT_DIR/changelog.xml" --quiet
echo "Wrote $OUT_DIR/changelog.xml"
