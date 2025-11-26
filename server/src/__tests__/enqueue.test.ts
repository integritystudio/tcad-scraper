/**
 * Queue Enqueuing Tests
 *
 * Tests for the enqueueing functionality to ensure:
 * - Jobs are properly added to the queue
 * - Job data is correctly structured
 * - Error handling works as expected
 * - Queue configuration is correct
 */

import { describe, test, expect, afterAll } from 'vitest';
import { scraperQueue } from '../queues/scraper.queue';
import { ScrapeJobData } from '../types';
import Bull from 'bull';
import { isRedisAvailable } from './test-utils';

// Check Redis availability at module load time
let redisAvailable = false;
const checkRedis = async () => {
  redisAvailable = await isRedisAvailable(3000);
  return redisAvailable;
};

describe.skipIf(!(await checkRedis()))('Queue Enqueuing Tests', () => {
  // Clean up after tests
  afterAll(async () => {
    await scraperQueue.close();
  });

  describe('Basic Enqueueing', () => {
    test('should successfully enqueue a single job', async () => {
      const jobData: ScrapeJobData = {
        searchTerm: 'Test Corporation',
        userId: 'test-user',
        scheduled: false,
      };

      const job = await scraperQueue.add('scrape-properties', jobData);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.data.searchTerm).toBe('Test Corporation');
      expect(job.data.userId).toBe('test-user');

      // Clean up
      await job.remove();
    });

    test('should enqueue job with correct default options', async () => {
      const jobData: ScrapeJobData = {
        searchTerm: 'Trust',
        userId: 'test-user',
        scheduled: true,
      };

      const job = await scraperQueue.add('scrape-properties', jobData);

      expect(job.opts.attempts).toBeDefined();
      expect(job.opts.backoff).toBeDefined();
      expect(job.opts.removeOnComplete).toBeDefined();
      expect(job.opts.removeOnFail).toBeDefined();

      // Clean up
      await job.remove();
    });

    test('should enqueue job with custom priority', async () => {
      const jobData: ScrapeJobData = {
        searchTerm: 'High Priority',
        userId: 'test-user',
        scheduled: true,
      };

      const job = await scraperQueue.add('scrape-properties', jobData, {
        priority: 1,
      });

      expect(job.opts.priority).toBe(1);

      // Clean up
      await job.remove();
    });
  });

  describe('Batch Enqueueing', () => {
    test('should enqueue multiple jobs successfully', async () => {
      const searchTerms = ['LLC', 'Corporation', 'Trust', 'Partnership', 'Investment'];
      const jobs: Bull.Job<ScrapeJobData>[] = [];

      for (const term of searchTerms) {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'batch-test',
          scheduled: true,
        });
        jobs.push(job);
      }

      expect(jobs.length).toBe(5);
      jobs.forEach(job => {
        expect(job.id).toBeDefined();
        expect(job.data.searchTerm).toBeDefined();
      });

      // Clean up
      await Promise.all(jobs.map(job => job.remove()));
    });

    test('should handle enqueueing with different priorities', async () => {
      const jobConfigs = [
        { searchTerm: 'High', priority: 1 },
        { searchTerm: 'Medium', priority: 2 },
        { searchTerm: 'Low', priority: 3 },
      ];

      const jobs = await Promise.all(
        jobConfigs.map(config =>
          scraperQueue.add('scrape-properties', {
            searchTerm: config.searchTerm,
            userId: 'priority-test',
            scheduled: true,
          }, {
            priority: config.priority,
          })
        )
      );

      expect(jobs[0].opts.priority).toBe(1);
      expect(jobs[1].opts.priority).toBe(2);
      expect(jobs[2].opts.priority).toBe(3);

      // Clean up
      await Promise.all(jobs.map(job => job.remove()));
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid job data gracefully', async () => {
      // Test with missing searchTerm
      const invalidData = {
        userId: 'test-user',
        scheduled: true,
      } as ScrapeJobData;

      const job = await scraperQueue.add('scrape-properties', invalidData);

      // Job should still be created, but validation might fail during processing
      expect(job).toBeDefined();

      // Clean up
      await job.remove();
    });

    test('should handle duplicate job enqueuing', async () => {
      const jobData: ScrapeJobData = {
        searchTerm: 'Duplicate Test',
        userId: 'test-user',
        scheduled: true,
      };

      const job1 = await scraperQueue.add('scrape-properties', jobData);
      const job2 = await scraperQueue.add('scrape-properties', jobData);

      // Both jobs should be created (Bull doesn't prevent duplicates by default)
      expect(job1.id).toBeDefined();
      expect(job2.id).toBeDefined();
      expect(job1.id).not.toBe(job2.id);

      // Clean up
      await Promise.all([job1.remove(), job2.remove()]);
    });
  });

  describe('Job Options', () => {
    test('should respect custom retry attempts', async () => {
      const job = await scraperQueue.add('scrape-properties', {
        searchTerm: 'Retry Test',
        userId: 'test-user',
        scheduled: true,
      }, {
        attempts: 5,
      });

      expect(job.opts.attempts).toBe(5);

      // Clean up
      await job.remove();
    });

    test('should respect custom backoff delay', async () => {
      const job = await scraperQueue.add('scrape-properties', {
        searchTerm: 'Backoff Test',
        userId: 'test-user',
        scheduled: true,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });

      expect(job.opts.backoff).toBeDefined();
      expect((job.opts.backoff as { type: string; delay: number }).type).toBe('exponential');
      expect((job.opts.backoff as { type: string; delay: number }).delay).toBe(5000);

      // Clean up
      await job.remove();
    });

    test('should respect removeOnComplete option', async () => {
      const job = await scraperQueue.add('scrape-properties', {
        searchTerm: 'Cleanup Test',
        userId: 'test-user',
        scheduled: true,
      }, {
        removeOnComplete: true,
      });

      expect(job.opts.removeOnComplete).toBe(true);

      // Clean up
      await job.remove();
    });
  });

  describe('Queue State', () => {
    test('should be able to get waiting jobs count', async () => {
      const waiting = await scraperQueue.getWaiting();
      expect(Array.isArray(waiting)).toBe(true);
    });

    test('should be able to get active jobs count', async () => {
      const active = await scraperQueue.getActive();
      expect(Array.isArray(active)).toBe(true);
    });

    test('should be able to check if queue is paused', async () => {
      const isPaused = await scraperQueue.isPaused();
      expect(typeof isPaused).toBe('boolean');
    });

    test('should be able to get job counts', async () => {
      const counts = await scraperQueue.getJobCounts();
      expect(counts).toBeDefined();
      expect(counts).toHaveProperty('waiting');
      expect(counts).toHaveProperty('active');
      expect(counts).toHaveProperty('completed');
      expect(counts).toHaveProperty('failed');
    });
  });

  describe('Job Retrieval', () => {
    test('should be able to retrieve job by ID', async () => {
      const job = await scraperQueue.add('scrape-properties', {
        searchTerm: 'Retrieval Test',
        userId: 'test-user',
        scheduled: true,
      });

      const retrievedJob = await scraperQueue.getJob(job.id!);
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(job.id);
      expect(retrievedJob?.data.searchTerm).toBe('Retrieval Test');

      // Clean up
      await job.remove();
    });

    test('should return null for non-existent job ID', async () => {
      const nonExistentJob = await scraperQueue.getJob('999999999');
      expect(nonExistentJob).toBeNull();
    });
  });

  describe('Integration with Enqueue Scripts', () => {
    test('should enqueue jobs similar to enqueue-high-value-batch', async () => {
      const highValueTerms = ['Trust', 'Investment', 'LLC'];
      const jobs: Bull.Job<ScrapeJobData>[] = [];

      for (const term of highValueTerms) {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'high-value-batch-test',
          scheduled: true,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority: 1,
          removeOnComplete: 100,
          removeOnFail: 50,
        });
        jobs.push(job);
      }

      expect(jobs.length).toBe(3);
      jobs.forEach(job => {
        expect(job.opts.attempts).toBe(3);
        expect(job.opts.priority).toBe(1);
        expect((job.opts.backoff as { type: string; delay: number }).delay).toBe(2000);
      });

      // Clean up
      await Promise.all(jobs.map(job => job.remove()));
    });

    test('should handle job failures gracefully', async () => {
      // This test verifies that the error handling structure is correct
      const job = await scraperQueue.add('scrape-properties', {
        searchTerm: 'Error Test',
        userId: 'error-test',
        scheduled: true,
      }, {
        attempts: 1, // Only try once
      });

      expect(job).toBeDefined();

      // We're not actually running the job, just ensuring it can be enqueued
      // with error handling options

      // Clean up
      await job.remove();
    });
  });

  describe('Rate Limiting', () => {
    test('should enqueue jobs with delays between them', async () => {
      const startTime = Date.now();
      const jobs: Bull.Job<ScrapeJobData>[] = [];

      for (let i = 0; i < 3; i++) {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: `Rate Limit Test ${i}`,
          userId: 'rate-limit-test',
          scheduled: true,
        });
        jobs.push(job);

        // Small delay between jobs (simulating rate limiting)
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      const duration = Date.now() - startTime;

      // Should take at least 100ms (2 delays of 50ms each)
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(jobs.length).toBe(3);

      // Clean up
      await Promise.all(jobs.map(job => job.remove()));
    });
  });
});
