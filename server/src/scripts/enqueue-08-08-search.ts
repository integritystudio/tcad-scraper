/**
 * Enqueue unsearched terms from docs/08-08-2026-search.md and monitor results.
 *
 * Usage: doppler run -- npx tsx src/scripts/enqueue-08-08-search.ts
 */
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { scraperQueue } from '../queues/scraper.queue';
import { getErrorMessage } from '../utils/error-helpers';

const POLL_INTERVAL_MS = 15_000;

// 193 terms from docs/08-08-2026-search.md (deduped, filtered against searchTermAnalytics + 2025 completed jobs)
const NAMES = [
  'McLean', 'McMullen', 'McPherson', 'Meadows', 'Mercer', 'Meyers',
  'Millar', 'Millard', 'Moeller', 'Mooney', 'Moorehead', 'Mullen',
];

const STREETS = [
  'Devon', 'Fawn', 'Hazel', 'Ivory', 'Jade', 'Lilac', 'Lilly', 'Lodge',
  'Mango', 'Marina', 'Mist', 'Mulberry', 'Ocean', 'Olive', 'Orchid',
  'Pebble', 'Raven', 'Sand', 'Shell', 'Slate', 'Spruce', 'Storm', 'Swift',
  'Timber', 'Turtle', 'Vine', 'Violet', 'Wind', 'Wren',
];

const ENTITIES = [
  'Advisor', 'Anchor', 'Benefit', 'Broker', 'Charter', 'Civic', 'Classic',
  'Coastal', 'Commerce', 'Compass', 'Condo', 'Consult', 'Corner', 'District',
  'Dynasty', 'Endow', 'Guardian', 'Imperial', 'Liberty', 'Pinnacle',
  'Prestige', 'Prospect', 'Regent', 'Reliant', 'Republic', 'Residential',
  'Select', 'Senior', 'Solid', 'Sovereign', 'Succession', 'Superior',
  'Supreme', 'Trident', 'Universal', 'Vanguard',
];

const NUMBERS = [
  '1000', '1100', '1200', '1400', '1500', '1600', '1800', '2000', '2100',
  '2200', '2300', '2500', '2600', '2700', '2800', '2900', '3000', '3100',
  '3300', '3400', '3500', '3600', '3700', '3800', '3900', '4000', '4100',
  '4200', '4400', '4500', '4600', '4700', '4800', '4900', '5000', '5100',
  '5200', '5300', '5400', '5500', '5600', '5700', '5900', '6000', '6100',
  '6200', '6300', '6400', '6500', '6600', '6700', '6800', '6900', '7000',
  '7100', '7200', '7300', '7400', '7500', '7600', '7700', '7800', '7900',
  '8000', '8100', '8200', '8300', '8400', '8500', '8600', '8700', '8800',
  '8900', '9000', '9100', '9200', '9300', '9400', '9500', '9600', '9700',
  '9800', '9900', '10000', '10100', '10200', '10300', '10400', '10500',
  '10600', '10700', '10800', '10900', '11000', '11100', '11200', '11300',
  '11400', '11500', '11600', '11700', '11800', '11900', '12000', '12100',
  '12200', '12300', '12400', '12500', '13000', '13500', '14000', '14500',
  '15000', '15500', '16000',
];

// Enqueue high-value categories first (names/entities), numbers last
const ALL_TERMS = [...NAMES, ...ENTITIES, ...STREETS, ...NUMBERS];

async function enqueueAll(): Promise<Map<string, string>> {
  const jobMap = new Map<string, string>(); // jobId -> searchTerm
  let enqueued = 0;

  for (const searchTerm of ALL_TERMS) {
    const job = await scraperQueue.add(
      'scrape-properties',
      { searchTerm, userId: '08-08-search', scheduled: true },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    );
    jobMap.set(String(job.id), searchTerm);
    enqueued++;
    if (enqueued % 50 === 0) {
      logger.info(`Enqueued ${enqueued}/${ALL_TERMS.length}...`);
    }
  }

  logger.info(`Enqueued all ${enqueued} terms`);
  return jobMap;
}

const MAX_MONITOR_MS = 2 * 60 * 60 * 1000; // 2 hour deadline

async function monitor(jobMap: Map<string, string>) {
  const startCount = await prisma.property.count();
  const startTime = Date.now();
  const deadline = startTime + MAX_MONITOR_MS;
  const totalJobs = jobMap.size;

  logger.info(`Starting property count: ${startCount.toLocaleString()}`);
  logger.info(`Monitoring ${totalJobs} jobs (polling every ${POLL_INTERVAL_MS / 1000}s, deadline ${MAX_MONITOR_MS / 60_000}m)...\n`);

  let lastCompleted = 0;
  let lastFailed = 0;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const [waiting, active, completed, failed] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getCompletedCount(),
      scraperQueue.getFailedCount(),
    ]);

    const currentCount = await prisma.property.count();
    const newProps = currentCount - startCount;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    const completedDelta = completed - lastCompleted;
    const failedDelta = failed - lastFailed;
    lastCompleted = completed;
    lastFailed = failed;

    logger.info(
      `[${mins}m${secs.toString().padStart(2, '0')}s] ` +
      `W:${waiting} A:${active} C:${completed}(+${completedDelta}) F:${failed}(+${failedDelta}) | ` +
      `Props: ${currentCount.toLocaleString()} (+${newProps.toLocaleString()} new)`
    );

    if (waiting === 0 && active === 0) {
      const finalCount = await prisma.property.count();
      const totalNew = finalCount - startCount;
      const totalElapsed = Math.floor((Date.now() - startTime) / 1000);

      logger.info('\n=== 08-08-2026 Search Complete ===');
      logger.info(`Runtime: ${Math.floor(totalElapsed / 60)}m ${totalElapsed % 60}s`);
      logger.info(`Terms: ${totalJobs} (${completed} completed, ${failed} failed)`);
      logger.info(`Properties: ${startCount.toLocaleString()} -> ${finalCount.toLocaleString()} (+${totalNew.toLocaleString()})`);
      logger.info(`Categories: ${NAMES.length} names, ${ENTITIES.length} entities, ${STREETS.length} streets, ${NUMBERS.length} numbers`);
      return;
    }
  }

  logger.warn(`Monitor deadline reached (${MAX_MONITOR_MS / 60_000}m). Jobs may still be processing.`);
}

async function run() {
  let running = true;
  process.on('SIGINT', () => { running = false; logger.info('Shutting down...'); });
  process.on('SIGTERM', () => { running = false; });

  try {
    logger.info('=== 08-08-2026 Search Term Enqueue ===');
    logger.info(`Terms: ${ALL_TERMS.length} (${NAMES.length} names, ${ENTITIES.length} entities, ${STREETS.length} streets, ${NUMBERS.length} numbers)`);

    const jobMap = await enqueueAll();
    if (running) await monitor(jobMap);
  } catch (error) {
    logger.error(`Fatal: ${getErrorMessage(error)}`);
    process.exit(1);
  } finally {
    await Promise.all([scraperQueue.close(), prisma.$disconnect()]);
  }
}

run();
