#!/usr/bin/env python3
import json
import requests
import time

# Get failed jobs
response = requests.get('http://localhost:3002/api/properties/history?limit=100')
data = response.json()
failed_jobs = [job for job in data['data'] if job['status'] == 'failed']

# Get unique search terms
search_terms = list(set([job['searchTerm'] for job in failed_jobs]))

print(f'Re-queueing {len(search_terms)} unique failed search terms with 6-second delays...\n')

success = 0
failed = 0
for i, term in enumerate(search_terms, 1):
    try:
        response = requests.post(
            'http://localhost:3002/api/properties/scrape',
            json={'searchTerm': term},
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        if response.status_code == 202:
            print(f'{i}/{len(search_terms)} ✓ Queued: "{term}"')
            success += 1
        else:
            print(f'{i}/{len(search_terms)} ✗ Failed: "{term}" - HTTP {response.status_code}')
            failed += 1
        time.sleep(6)  # Wait 6 seconds between requests to avoid rate limiting
    except Exception as e:
        print(f'{i}/{len(search_terms)} ✗ Error: "{term}" - {str(e)}')
        failed += 1
        time.sleep(6)

print(f'\n✅ Successfully queued: {success}')
print(f'❌ Failed to queue: {failed}')
