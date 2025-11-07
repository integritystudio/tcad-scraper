import { scraperQueue } from '../queues/scraper.queue';

const PRIORITY_TERMS = ['Lake', 'River', 'Pecan', 'Maple', 'Oak', 'Mount', 'Limited'];

async function enqueuePriorityTerms() {
  console.log('Enqueueing priority search terms...');

  for (const term of PRIORITY_TERMS) {
    try {
      await scraperQueue.add(
        'scrape',
        { searchTerm: term },
        { priority: 1 } // Higher priority (lower number = higher priority in Bull)
      );
      console.log(`✓ Enqueued: ${term}`);
    } catch (error) {
      console.error(`✗ Failed to enqueue ${term}:`, error);
    }
  }

  console.log(`\n✓ Successfully enqueued ${PRIORITY_TERMS.length} priority terms`);
  console.log('These jobs will be processed before other waiting jobs');
  process.exit(0);
}

enqueuePriorityTerms().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
