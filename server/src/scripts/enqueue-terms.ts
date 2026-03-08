/**
 * Enqueue a list of search terms to BullMQ from stdin (one per line).
 * Usage: echo "term1\nterm2" | doppler run -- npx tsx src/scripts/enqueue-terms.ts
 */
import { scraperQueue } from '../queues/scraper.queue';

async function main() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString('utf-8').trim();
  const terms = input.split('\n').map(t => t.trim()).filter(t => t.length >= 4);

  console.log(`Enqueuing ${terms.length} terms...`);

  let queued = 0;
  for (const searchTerm of terms) {
    await scraperQueue.add(
      'scrape-properties',
      { searchTerm, userId: 'next-200-gen', scheduled: true },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
    queued++;
  }

  console.log(`Enqueued ${queued} jobs`);
  await scraperQueue.close();
}

main();
