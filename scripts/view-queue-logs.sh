#!/bin/bash

# View queue monitoring logs
LOG_FILE="/home/aledlie/tcad-scraper/logs/queue-monitor.log"

if [ ! -f "$LOG_FILE" ]; then
  echo "No monitoring logs found yet."
  exit 0
fi

if [ "$1" == "tail" ]; then
  echo "=== Following queue monitoring logs (Ctrl+C to exit) ==="
  tail -f "$LOG_FILE"
elif [ "$1" == "errors" ]; then
  echo "=== Jobs with Errors ==="
  grep -A 10 "Jobs with Errors:" "$LOG_FILE" | tail -20
elif [ "$1" == "stuck" ]; then
  echo "=== Stuck Processing Jobs ==="
  grep -A 10 "Stuck Processing Jobs" "$LOG_FILE" | tail -20
elif [ "$1" == "reset" ]; then
  echo "=== Jobs Reset Events ==="
  grep "Found.*stuck jobs" "$LOG_FILE"
else
  echo "=== Last 50 lines of queue monitoring logs ==="
  tail -50 "$LOG_FILE"
fi
