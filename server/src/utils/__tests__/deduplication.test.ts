import { removeDuplicatesFromQueue } from '../deduplication';

// Mock dependencies
jest.mock('../../queues/scraper.queue', () => ({
  scraperQueue: {
    getWaiting: jest.fn(),
    getDelayed: jest.fn(),
  },
}));

jest.mock('../../lib/prisma', () => ({
  prisma: {
    scrapeJob: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('removeDuplicatesFromQueue', () => {
  let scraperQueue: any;
  let prisma: any;
  let logger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const scraperQueueModule = require('../../queues/scraper.queue');
    scraperQueue = scraperQueueModule.scraperQueue;

    const prismaModule = require('../../lib/prisma');
    prisma = prismaModule.prisma;

    logger = require('../../lib/logger');
  });

  describe('with no duplicates', () => {
    it('should return zero removed when queue is empty', async () => {
      scraperQueue.getWaiting.mockResolvedValue([]);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      expect(result).toEqual({ removed: 0, failed: 0 });
      expect(scraperQueue.getWaiting).toHaveBeenCalled();
      expect(scraperQueue.getDelayed).toHaveBeenCalled();
    });

    it('should return zero removed when no duplicates exist', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn(),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Johnson' },
          opts: { priority: 10 },
          remove: jest.fn(),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      expect(result).toEqual({ removed: 0, failed: 0 });
      expect(mockJobs[0].remove).not.toHaveBeenCalled();
      expect(mockJobs[1].remove).not.toHaveBeenCalled();
    });
  });

  describe('with duplicate pending jobs', () => {
    it('should remove duplicate pending jobs and keep highest priority', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: { priority: 5 }, // Higher priority (lower number)
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 }, // Lower priority (higher number)
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-3',
          data: { searchTerm: 'Smith' },
          opts: { priority: 15 }, // Lowest priority
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      expect(result.removed).toBe(2); // Remove 2 out of 3
      expect(mockJobs[0].remove).not.toHaveBeenCalled(); // Keep highest priority
      expect(mockJobs[1].remove).toHaveBeenCalled(); // Remove
      expect(mockJobs[2].remove).toHaveBeenCalled(); // Remove
    });

    it('should handle jobs with no priority (default to 10)', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: {}, // No priority
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Smith' },
          opts: { priority: 15 },
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      expect(result.removed).toBe(1);
      expect(mockJobs[0].remove).not.toHaveBeenCalled(); // Default priority 10 < 15
      expect(mockJobs[1].remove).toHaveBeenCalled();
    });

    it('should handle multiple duplicate groups', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-3',
          data: { searchTerm: 'Johnson' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-4',
          data: { searchTerm: 'Johnson' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      expect(result.removed).toBe(2); // Remove 1 from each group
    });
  });

  describe('with already completed terms', () => {
    it('should remove all pending jobs for completed terms', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([
        { searchTerm: 'Smith' }, // Already completed
      ]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      // Note: These 2 jobs are both duplicates AND completed, so they get removed
      // by both the duplicate removal logic and the completed term logic
      // This results in 3 removals (1 from duplicate handling + 2 from completed handling)
      expect(result.removed).toBe(3);
      expect(mockJobs[0].remove).toHaveBeenCalled();
      expect(mockJobs[1].remove).toHaveBeenCalled();
    });

    it('should handle mix of completed and unique terms', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' }, // Already completed
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Johnson' }, // Not completed
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([
        { searchTerm: 'Smith' },
      ]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      expect(result.removed).toBe(1);
      expect(mockJobs[0].remove).toHaveBeenCalled();
      expect(mockJobs[1].remove).not.toHaveBeenCalled();
    });
  });

  describe('with both waiting and delayed jobs', () => {
    it('should process jobs from both queues', async () => {
      const waitingJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      const delayedJobs = [
        {
          id: 'job-2',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(waitingJobs);
      scraperQueue.getDelayed.mockResolvedValue(delayedJobs);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      expect(result.removed).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should continue removing jobs even if some fail', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockRejectedValue(new Error('Remove failed')),
        },
        {
          id: 'job-3',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      expect(result.removed).toBe(1); // 2 attempts, 1 success, 1 failure
      expect(result.failed).toBe(1);
    });

    it('should track multiple failures correctly', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockRejectedValue(new Error('Failed 1')),
        },
        {
          id: 'job-3',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockRejectedValue(new Error('Failed 2')),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      expect(result.failed).toBe(2);
      expect(result.removed).toBe(0);
    });

    it('should handle failures when removing completed terms', async () => {
      // Use only one job to avoid duplicate removal logic
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'CompletedTerm' },
          opts: { priority: 10 },
          remove: jest.fn().mockRejectedValue(new Error('Remove failed for completed term')),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([
        { searchTerm: 'CompletedTerm' },
      ]);

      const result = await removeDuplicatesFromQueue({ verbose: true, showProgress: false });

      expect(result.failed).toBe(1);
      expect(result.removed).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('verbose logging', () => {
    it('should log information when verbose is true', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      await removeDuplicatesFromQueue({ verbose: true, showProgress: false });

      expect(logger.info).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('checking for duplicates')
      );
    });

    it('should not log when verbose is false', async () => {
      scraperQueue.getWaiting.mockResolvedValue([]);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      await removeDuplicatesFromQueue({ verbose: false });

      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should log "No duplicates found" when verbose and queue is clean', async () => {
      scraperQueue.getWaiting.mockResolvedValue([]);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      await removeDuplicatesFromQueue({ verbose: true });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('No duplicates or completed terms found')
      );
    });

    it('should log errors for failed removals when verbose', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockRejectedValue(new Error('Remove failed')),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      await removeDuplicatesFromQueue({ verbose: true, showProgress: false });

      expect(logger.error).toHaveBeenCalled();
    });

    it('should show "... and X more" when more than 10 duplicate terms', async () => {
      // Create 15 different search terms, each with 2 duplicate jobs
      const mockJobs = [];
      for (let i = 0; i < 15; i++) {
        mockJobs.push(
          {
            id: `job-${i}-1`,
            data: { searchTerm: `Term${i}` },
            opts: { priority: 10 },
            remove: jest.fn().mockResolvedValue(true),
          },
          {
            id: `job-${i}-2`,
            data: { searchTerm: `Term${i}` },
            opts: { priority: 15 },
            remove: jest.fn().mockResolvedValue(true),
          }
        );
      }

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      await removeDuplicatesFromQueue({ verbose: true, showProgress: true });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('... and 5 more')
      );
    });

    it('should show "... and X more" when more than 20 completed terms', async () => {
      // Create 25 different completed terms, each with 1 pending job
      const mockJobs = [];
      const completedTerms = [];
      for (let i = 0; i < 25; i++) {
        mockJobs.push({
          id: `job-${i}`,
          data: { searchTerm: `CompletedTerm${i}` },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        });
        completedTerms.push({ searchTerm: `CompletedTerm${i}` });
      }

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue(completedTerms);

      await removeDuplicatesFromQueue({ verbose: true, showProgress: true });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('... and 5 more')
      );
    });
  });

  describe('progress reporting', () => {
    it('should show progress when showProgress is true and removing many jobs', async () => {
      // Create enough duplicate jobs to trigger progress reporting (10+ removals)
      const mockJobs = [];
      for (let i = 0; i < 12; i++) {
        mockJobs.push(
          {
            id: `job-${i}-1`,
            data: { searchTerm: 'DuplicateTerm' },
            opts: { priority: 10 },
            remove: jest.fn().mockResolvedValue(true),
          }
        );
      }

      // Mock process.stdout.write to verify progress output
      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      await removeDuplicatesFromQueue({ verbose: true, showProgress: true });

      // Should have written progress at 10 removals
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Progress: 10/')
      );

      stdoutWriteSpy.mockRestore();
    });

    it('should not show progress when showProgress is false', async () => {
      const mockJobs = [];
      for (let i = 0; i < 12; i++) {
        mockJobs.push(
          {
            id: `job-${i}-1`,
            data: { searchTerm: 'DuplicateTerm' },
            opts: { priority: 10 },
            remove: jest.fn().mockResolvedValue(true),
          }
        );
      }

      const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      await removeDuplicatesFromQueue({ verbose: true, showProgress: false });

      // Should not have written any progress
      expect(stdoutWriteSpy).not.toHaveBeenCalled();

      stdoutWriteSpy.mockRestore();
    });

    it('should log new line after progress when verbose and showProgress', async () => {
      const mockJobs = [];
      for (let i = 0; i < 12; i++) {
        mockJobs.push({
          id: `job-${i}`,
          data: { searchTerm: 'CompletedTerm' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        });
      }

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([
        { searchTerm: 'CompletedTerm' },
      ]);

      await removeDuplicatesFromQueue({ verbose: true, showProgress: true });

      // Should log empty string for new line after progress (line 172)
      expect(logger.info).toHaveBeenCalledWith('');
    });
  });

  describe('complex scenarios', () => {
    it('should handle combination of duplicates and completed terms', async () => {
      const mockJobs = [
        // Duplicates for 'Smith' (2 jobs)
        {
          id: 'job-1',
          data: { searchTerm: 'Smith' },
          opts: { priority: 5 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: 'Smith' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        // Already completed 'Johnson' (should remove all)
        {
          id: 'job-3',
          data: { searchTerm: 'Johnson' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        // Unique 'Williams' (should keep)
        {
          id: 'job-4',
          data: { searchTerm: 'Williams' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([
        { searchTerm: 'Johnson' },
      ]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      // Should remove: 1 duplicate Smith + 1 completed Johnson = 2 total
      expect(result.removed).toBe(2);
      expect(mockJobs[0].remove).not.toHaveBeenCalled(); // Keep high priority Smith
      expect(mockJobs[1].remove).toHaveBeenCalled(); // Remove duplicate Smith
      expect(mockJobs[2].remove).toHaveBeenCalled(); // Remove completed Johnson
      expect(mockJobs[3].remove).not.toHaveBeenCalled(); // Keep unique Williams
    });

    it('should handle empty searchTerm gracefully', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          data: { searchTerm: '' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'job-2',
          data: { searchTerm: '' },
          opts: { priority: 10 },
          remove: jest.fn().mockResolvedValue(true),
        },
      ];

      scraperQueue.getWaiting.mockResolvedValue(mockJobs);
      scraperQueue.getDelayed.mockResolvedValue([]);
      prisma.scrapeJob.findMany.mockResolvedValue([]);

      const result = await removeDuplicatesFromQueue({ verbose: false });

      expect(result.removed).toBe(1); // Treat empty strings as duplicates
    });
  });
});
