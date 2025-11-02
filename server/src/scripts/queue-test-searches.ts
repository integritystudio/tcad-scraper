import Bull from 'bull';

async function queueTestSearches() {
  const queue = new Bull('scraper-queue', {
    redis: {
      host: 'localhost',
      port: 6379,
    },
  });

  console.log('📋 Queuing test searches...\n');

  const searchTerms = [
    'Austin',
    '78701',
    'dede', // Known to have 20 results
  ];

  for (const searchTerm of searchTerms) {
    await queue.add('scrape-properties', {
      searchTerm,
      timestamp: new Date().toISOString(),
    });
    console.log(`✅ Queued: ${searchTerm}`);
  }

  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const completed = await queue.getCompletedCount();
  const failed = await queue.getFailedCount();

  console.log(`\n📊 Queue status:`);
  console.log(`   Waiting: ${waiting}`);
  console.log(`   Active: ${active}`);
  console.log(`   Completed: ${completed}`);
  console.log(`   Failed: ${failed}`);

  await queue.close();
  process.exit(0);
}

queueTestSearches();
