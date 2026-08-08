#!/usr/bin/env bash
# List the 20 most recent commits with the files each one touched.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

git log -20 --pretty=format:'%h %ad %s' --date=short --name-only \
  | awk '/^[0-9a-f]{7,} / || /^$/ { print; next } { print "  " $0 }' \
  > "$OUT_DIR/gitlog-top20.txt"
echo "Wrote $OUT_DIR/gitlog-top20.txt"
