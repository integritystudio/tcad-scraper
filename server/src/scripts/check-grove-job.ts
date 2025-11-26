import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';
import type Bull from 'bull';

async function checkGroveJob() {
  const waiting = await scraperQueue.getWaiting();
  const active = await scraperQueue.getActive();
  const completed = await scraperQueue.getCompleted();

  logger.info('Queue Status:');
  logger.info(`- Waiting jobs: ${waiting.length}`);
  logger.info(`- Active jobs: ${active.length}`);
  logger.info(`- Completed jobs (recent): ${completed.length}`);

  // Find Grove job
  const groveJobs = [...waiting, ...active, ...completed].filter((job: Bull.Job) =>
    job.data?.searchTerm === 'Grove'
  );

  logger.info(`\nGrove job(s): ${groveJobs.length}`);
  if (groveJobs.length > 0) {
    const job = groveJobs[0];
    const state = await job.getState();
    logger.info({
      job: {
        id: job.id,
        state,
        data: job.data,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn,
        returnvalue: job.returnvalue
      }
    }, 'Grove job details');
  } else {
    logger.info('No Grove job found in queue');
  }

  process.exit(0);
}

checkGroveJob().catch((err) => {
  logger.error({ err }, 'Error');
  process.exit(1);
});
