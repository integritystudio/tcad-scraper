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

# Retrain the zstd dictionary on current tracked TypeScript so it never drifts
# from the corpus (a stale dictionary silently degrades and can embed deleted code).
#
# This dictionary compresses its own training set (storage only), so a large
# memorizing dictionary is correct here: zstd's "dictionary too large vs source"
# warning optimizes for generalization to unseen data and is expected — measured
# 2026-08-06, shrinking to the recommended corpus/10 made every file compress
# WORSE (99 KB vs 76 KB total). --train-cover beats the default fastcover
# trainer at the same size (76,062 vs 79,708 bytes across all tracked TS).
DICT_MAX_BYTES=65536
if command -v zstd >/dev/null 2>&1; then
  REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
  DICT_PATH="$REPO_ROOT/.condense/dictionaries/dict_typescript.zdict"
  (cd "$REPO_ROOT" && git ls-files -z '*.ts' '*.tsx' \
    | xargs -0 zstd --train-cover --maxdict="$DICT_MAX_BYTES" -o "$DICT_PATH" -f -q \
      2> >(grep -v '^WARNING: The maximum dictionary size' >&2))
  echo "Retrained $DICT_PATH"
else
  echo "zstd not found; skipped dictionary retrain" >&2
fi

echo "All repomix outputs regenerated in docs/repomix/"
