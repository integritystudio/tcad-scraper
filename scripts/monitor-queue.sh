#!/bin/bash

# Monitor queue for errors and stuck jobs
echo "=== Queue Status Monitor ==="
echo "Timestamp: $(date)"
echo ""

# Get overall status
echo "Overall Status:"
PGPASSWORD=postgres psql -h localhost -U postgres -d tcad_scraper -t -c "
SELECT 
  status, 
  COUNT(*) as count
FROM scrape_jobs
GROUP BY status
ORDER BY status;
"

echo ""
echo "Jobs with Errors:"
PGPASSWORD=postgres psql -h localhost -U postgres -d tcad_scraper -c "
SELECT 
  id,
  search_term,
  status,
  error,
  started_at
FROM scrape_jobs
WHERE error IS NOT NULL AND error != ''
ORDER BY started_at DESC
LIMIT 10;
"

echo ""
echo "Stuck Processing Jobs (>1 hour):"
PGPASSWORD=postgres psql -h localhost -U postgres -d tcad_scraper -c "
SELECT 
  id,
  search_term,
  status,
  started_at,
  EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 as minutes_in_processing
FROM scrape_jobs
WHERE status = 'processing' 
  AND completed_at IS NULL 
  AND started_at < NOW() - INTERVAL '1 hour'
ORDER BY started_at ASC;
"

# Auto-fix stuck jobs
STUCK_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d tcad_scraper -t -c "SELECT COUNT(*) FROM scrape_jobs WHERE status = 'processing' AND completed_at IS NULL AND started_at < NOW() - INTERVAL '1 hour';")

if [ "$STUCK_COUNT" -gt 0 ]; then
  echo ""
  echo "Found $STUCK_COUNT stuck jobs. Resetting to pending..."
  PGPASSWORD=postgres psql -h localhost -U postgres -d tcad_scraper -c "
  UPDATE scrape_jobs 
  SET status = 'pending', started_at = NOW()
  WHERE status = 'processing' 
    AND completed_at IS NULL 
    AND started_at < NOW() - INTERVAL '1 hour'
  RETURNING id, search_term;
  "
fi

echo ""
echo "=== End of Monitor ==="
