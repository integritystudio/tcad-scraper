#!/usr/bin/env bash
# Generate a token-count tree of the repo (no packed file contents).
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

TMP_OUTPUT="$(mktemp)"
trap 'rm -f "$TMP_OUTPUT"' EXIT

repomix --token-count-tree -o "$TMP_OUTPUT" > "$OUT_DIR/token-tree.txt"
echo "Wrote $OUT_DIR/token-tree.txt"
