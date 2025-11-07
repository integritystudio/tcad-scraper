import { scraperQueue } from '../queues/scraper.queue';

async function checkGroveJob() {
  const waiting = await scraperQueue.getWaiting();
  const active = await scraperQueue.getActive();
  const completed = await scraperQueue.getCompleted();

  console.log('Queue Status:');
  console.log('- Waiting jobs:', waiting.length);
  console.log('- Active jobs:', active.length);
  console.log('- Completed jobs (recent):', completed.length);

  // Find Grove job
  const groveJobs = [...waiting, ...active, ...completed].filter((job: any) =>
    job.data?.searchTerm === 'Grove'
  );

  console.log('\nGrove job(s):', groveJobs.length);
  if (groveJobs.length > 0) {
    const job = groveJobs[0];
    const state = await job.getState();
    console.log('Grove job details:', JSON.stringify({
      id: job.id,
      state,
      data: job.data,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      returnvalue: job.returnvalue
    }, null, 2));
  } else {
    console.log('No Grove job found in queue');
  }

  process.exit(0);
}

checkGroveJob().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
