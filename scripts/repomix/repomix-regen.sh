#!/usr/bin/env bash
# Regenerate all repomix outputs into docs/repomix/.
# Respects .gitignore (repomix default) and the repo-root .repomixignore for build files.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/repomix-token-tree.sh"
"$SCRIPT_DIR/repomix-tests.sh"
"$SCRIPT_DIR/repomix-docs.sh"
"$SCRIPT_DIR/repomix-workers.sh"
"$SCRIPT_DIR/repomix-src.sh"
"$SCRIPT_DIR/repomix-scripts.sh"
"$SCRIPT_DIR/repomix-full.sh"
"$SCRIPT_DIR/repomix-compressed.sh"

echo "All repomix outputs regenerated in docs/repomix/"
