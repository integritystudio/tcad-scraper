#!/usr/bin/env bash
# Pack current-architecture documentation only (excludes docs/changelog/ — see repomix-changelog.sh).
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

repomix --include "$DOC_PATTERNS" --ignore "$CHANGELOG_PATTERNS" -o "$OUT_DIR/docs.xml" --quiet
echo "Wrote $OUT_DIR/docs.xml"
