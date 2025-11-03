#!/bin/bash

echo "╔════════════════════════════════════════════════════╗"
echo "║     TCAD Scraper - Live Progress Monitor          ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

while true; do
    clear
    echo "🕐 $(date '+%H:%M:%S')"
    echo ""

    echo "📊 Database Stats:"
    doppler run -- psql -d tcad_scraper -t -c "
        SELECT
            '   Total Properties: ' || COUNT(*) as stat
        FROM properties
        UNION ALL
        SELECT
            '   Last 5 minutes:  ' || COUNT(*)
        FROM properties
        WHERE scraped_at > NOW() - INTERVAL '5 minutes'
        UNION ALL
        SELECT
            '   Last hour:       ' || COUNT(*)
        FROM properties
        WHERE scraped_at > NOW() - INTERVAL '1 hour'
    "

    echo ""
    echo "📋 Recent Properties:"
    doppler run -- psql -d tcad_scraper -t -c "
        SELECT
            '   ' || property_id || ' - ' || LEFT(owner_name, 30)
        FROM properties
        ORDER BY scraped_at DESC
        LIMIT 5
    "

    echo ""
    echo "💡 Press Ctrl+C to stop monitoring"
    echo ""

    sleep 5
done
