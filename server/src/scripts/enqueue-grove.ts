import { scraperQueue } from '../queues/scraper.queue';

async function enqueueGrove() {
  console.log('Enqueueing job for search term: Grove');
  await scraperQueue.add('scrape', { searchTerm: 'Grove' });
  console.log('Job enqueued successfully');
  process.exit(0);
}

enqueueGrove().catch((err) => {
  console.error('Error enqueueing job:', err);
  process.exit(1);
});
