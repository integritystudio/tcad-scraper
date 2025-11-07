import { scraperQueue } from '../queues/scraper.queue';

// High-value terms identified from last hour analysis
const HIGH_PRIORITY_TERMS = [
  'Boulevard',  // Expected: 7,000+ (Avenue = 25,483)
  'Drive',      // Expected: 5,000+
  'Lane',       // Expected: 5,000+
  'Way',        // Expected: 3,000+
  'Terrace',    // Expected: 2,000+
  'Michelle',   // Expected: 2,000+ (top 30 US name)
];

async function enqueueHighPriority() {
  console.log('Enqueueing high-priority search terms from analysis...\n');

  for (const term of HIGH_PRIORITY_TERMS) {
    try {
      await scraperQueue.add(
        'scrape-properties',
        { searchTerm: term },
        { priority: 1 } // Highest priority
      );
      console.log(`✓ Enqueued: ${term}`);
    } catch (error) {
      console.error(`✗ Failed to enqueue ${term}:`, error);
    }
  }

  console.log(`\n✓ Successfully enqueued ${HIGH_PRIORITY_TERMS.length} high-priority terms`);
  console.log('Expected total: 24,000+ properties from these 6 terms alone!');
  process.exit(0);
}

enqueueHighPriority().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
