/** Shared queue helpers for backfill scripts. */

import { scraperQueue } from "../../queues/scraper.queue";
import { config } from "../../config";
import { getErrorMessage } from "../../utils/error-helpers";

export const POLL_INTERVAL_MS = 15_000;
export const BATCH_SIZE = 20;

// No timeout: polls until queue is fully drained. A permanently stalled BullMQ job
// will block indefinitely. Acceptable for CLI use — Ctrl+C to abort if needed.
export async function waitForQueueDrain(): Promise<void> {
  let waiting = await scraperQueue.getWaitingCount();
  let active = await scraperQueue.getActiveCount();
  while (waiting > 0 || active > 0) {
    process.stdout.write(`\r  Queue: ${active} active, ${waiting} waiting...   `);
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    waiting = await scraperQueue.getWaitingCount();
    active = await scraperQueue.getActiveCount();
  }
  process.stdout.write("\r  Queue drained.                          \n");
}

export interface EnqueueLogger {
  error: (msg: string) => void;
}

export async function enqueueBatch(
  terms: string[],
  userId: string,
  logger: EnqueueLogger = console,
): Promise<number> {
  const { jobName, defaultJobOptions } = config.queue;
  let enqueued = 0;
  for (const term of terms) {
    try {
      await scraperQueue.add(
        jobName,
        { searchTerm: term, userId, scheduled: true },
        {
          attempts: defaultJobOptions.attempts,
          backoff: { type: "exponential", delay: defaultJobOptions.backoffDelay },
          removeOnComplete: defaultJobOptions.removeOnComplete,
          removeOnFail: defaultJobOptions.removeOnFail,
        },
      );
      enqueued++;
    } catch (error) {
      logger.error(`  Failed to enqueue "${term}": ${getErrorMessage(error)}`);
    }
  }
  return enqueued;
}
