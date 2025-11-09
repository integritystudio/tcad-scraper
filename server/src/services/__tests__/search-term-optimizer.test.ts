/**
 * Search Term Optimizer Tests
 *
 * Tests for the search term performance analysis and optimization service
 */

import {
  OPTIMIZED_4_CHAR_STARTER_TERMS,
  SearchTermOptimizer,
} from '../search-term-optimizer';

// Mock Prisma
const mockPrisma = {
  searchTermAnalytics: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    groupBy: jest.fn(),
    update: jest.fn(),
  },
  scrapeJob: {
    count: jest.fn(),
  },
};

// Mock logger
jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Search Term Optimizer', () => {
  let optimizer: SearchTermOptimizer;

  beforeEach(() => {
    jest.clearAllMocks();
    optimizer = new SearchTermOptimizer(mockPrisma as any);
  });

  describe('OPTIMIZED_4_CHAR_STARTER_TERMS', () => {
    it('should export an array of search terms', () => {
      expect(Array.isArray(OPTIMIZED_4_CHAR_STARTER_TERMS)).toBe(true);
      expect(OPTIMIZED_4_CHAR_STARTER_TERMS.length).toBeGreaterThan(0);
    });

    it('should contain only string values', () => {
      OPTIMIZED_4_CHAR_STARTER_TERMS.forEach((term) => {
        expect(typeof term).toBe('string');
      });
    });

    it('should contain terms with length of at least 4 characters', () => {
      OPTIMIZED_4_CHAR_STARTER_TERMS.forEach((term) => {
        expect(term.length).toBeGreaterThanOrEqual(4);
      });
    });

    it('should not contain empty strings', () => {
      OPTIMIZED_4_CHAR_STARTER_TERMS.forEach((term) => {
        expect(term.trim()).not.toBe('');
      });
    });

    it('should contain common entity terms', () => {
      const entityTerms = ['Trus', 'LLC.', 'Corp', 'Part'];
      entityTerms.forEach((term) => {
        expect(OPTIMIZED_4_CHAR_STARTER_TERMS).toContain(term);
      });
    });

    it('should contain real estate related terms', () => {
      const realEstateTerms = ['Real', 'Prop', 'Home'];
      realEstateTerms.forEach((term) => {
        expect(OPTIMIZED_4_CHAR_STARTER_TERMS).toContain(term);
      });
    });
  });

  describe('SearchTermOptimizer class', () => {
    describe('constructor', () => {
      it('should accept custom Prisma client', () => {
        const customPrisma = { custom: 'client' };
        const customOptimizer = new SearchTermOptimizer(customPrisma as any);
        expect(customOptimizer).toBeDefined();
      });

      it('should use default Prisma client if not provided', () => {
        const defaultOptimizer = new SearchTermOptimizer();
        expect(defaultOptimizer).toBeDefined();
      });
    });

    describe('getStarterTerms', () => {
      it('should return optimized 4-char terms for cold start (empty database)', async () => {
        mockPrisma.searchTermAnalytics.count.mockResolvedValue(0);

        const terms = await optimizer.getStarterTerms();

        expect(terms).toEqual(OPTIMIZED_4_CHAR_STARTER_TERMS);
        expect(mockPrisma.searchTermAnalytics.count).toHaveBeenCalled();
      });

      it('should use analytics to optimize when database has data', async () => {
        mockPrisma.searchTermAnalytics.count.mockResolvedValue(100);
        mockPrisma.searchTermAnalytics.findMany.mockResolvedValue([
          {
            id: '1',
            searchTerm: 'Test',
            termLength: 4,
            totalSearches: 10,
            successfulSearches: 9,
            failedSearches: 1,
            totalResults: 50,
            maxResults: 10,
            minResults: 2,
            lastSearched: new Date(),
          },
        ]);

        const terms = await optimizer.getStarterTerms();

        expect(mockPrisma.searchTermAnalytics.count).toHaveBeenCalled();
        expect(mockPrisma.searchTermAnalytics.findMany).toHaveBeenCalled();
        expect(Array.isArray(terms)).toBe(true);
      });
    });

    describe('updateAnalytics', () => {
      it('should create analytics for successful scrape when term does not exist', async () => {
        mockPrisma.searchTermAnalytics.findUnique.mockResolvedValue(null);
        mockPrisma.searchTermAnalytics.create.mockResolvedValue({});

        await optimizer.updateAnalytics('TestTerm', 25, true);

        expect(mockPrisma.searchTermAnalytics.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            searchTerm: 'TestTerm',
            termLength: 8,
          }),
        });
      });

      it('should update existing analytics for successful scrape', async () => {
        mockPrisma.searchTermAnalytics.findUnique.mockResolvedValue({
          id: '1',
          searchTerm: 'TestTerm',
          termLength: 8,
          totalSearches: 5,
          successfulSearches: 4,
          failedSearches: 1,
          totalResults: 100,
          maxResults: 25,
          minResults: 10,
          lastSearched: new Date(),
        });
        mockPrisma.searchTermAnalytics.update.mockResolvedValue({});

        await optimizer.updateAnalytics('TestTerm', 30, true);

        expect(mockPrisma.searchTermAnalytics.update).toHaveBeenCalledWith({
          where: { searchTerm: 'TestTerm' },
          data: expect.objectContaining({
            totalSearches: 6,
            successfulSearches: 5,
            totalResults: 130,
          }),
        });
      });

      it('should update failed searches correctly', async () => {
        mockPrisma.searchTermAnalytics.findUnique.mockResolvedValue(null);
        mockPrisma.searchTermAnalytics.create.mockResolvedValue({});

        await optimizer.updateAnalytics('FailTerm', 0, false);

        expect(mockPrisma.searchTermAnalytics.create).toHaveBeenCalled();
      });
    });

    describe('getOptimizedTerms', () => {
      beforeEach(() => {
        mockPrisma.searchTermAnalytics.findMany.mockResolvedValue([
          {
            id: '1',
            searchTerm: 'Good',
            termLength: 4,
            totalSearches: 10,
            successfulSearches: 9,
            failedSearches: 1,
            totalResults: 100,
            maxResults: 20,
            minResults: 5,
            lastSearched: new Date('2025-01-01'),
            efficiency: 10.0,
            successRate: 0.9,
            avgResultsPerSearch: 10.0,
          },
          {
            id: '2',
            searchTerm: 'Bad',
            termLength: 3,
            totalSearches: 10,
            successfulSearches: 2,
            failedSearches: 8,
            totalResults: 10,
            maxResults: 5,
            minResults: 0,
            lastSearched: new Date('2025-01-01'),
            efficiency: 1.0,
            successRate: 0.2,
            avgResultsPerSearch: 1.0,
          },
        ]);
      });

      it('should call findMany with efficiency and success rate filters', async () => {
        await optimizer.getOptimizedTerms({
          minEfficiency: 5.0,
          minSuccessRate: 0.5,
        });

        expect(mockPrisma.searchTermAnalytics.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              efficiency: { gte: 5.0 },
              successRate: { gte: 0.5 },
            }),
          })
        );
      });

      it('should filter by preferred term length', async () => {
        const terms = await optimizer.getOptimizedTerms({
          preferredTermLength: 4,
        });

        expect(terms).toContain('Good');
      });

      it('should call findMany with maxTermsToReturn in take parameter', async () => {
        mockPrisma.searchTermAnalytics.findMany.mockResolvedValue([
          {
            id: '1',
            searchTerm: 'Term1',
            termLength: 4,
            totalSearches: 10,
            successfulSearches: 10,
            failedSearches: 0,
            totalResults: 100,
            maxResults: 20,
            minResults: 5,
            lastSearched: new Date(),
            efficiency: 10.0,
            successRate: 1.0,
            avgResultsPerSearch: 10.0,
          },
        ]);

        await optimizer.getOptimizedTerms({
          maxTermsToReturn: 25,
        });

        expect(mockPrisma.searchTermAnalytics.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 25,
          })
        );
      });

      it('should call findMany with date filter when excluding recently used terms', async () => {
        mockPrisma.searchTermAnalytics.findMany.mockResolvedValue([]);

        await optimizer.getOptimizedTerms({
          excludeRecentlyUsed: true,
          recentDays: 7,
        });

        expect(mockPrisma.searchTermAnalytics.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              lastSearched: expect.objectContaining({
                lte: expect.any(Date),
              }),
            }),
          })
        );
      });

      it('should return empty array if no terms meet criteria', async () => {
        mockPrisma.searchTermAnalytics.findMany.mockResolvedValue([]);

        const terms = await optimizer.getOptimizedTerms({
          minEfficiency: 100,
        });

        expect(terms).toEqual([]);
      });
    });

    describe('getPerformanceStats', () => {
      it('should calculate aggregate statistics', async () => {
        mockPrisma.searchTermAnalytics.findMany.mockResolvedValue([
          {
            id: '1',
            searchTerm: 'Term1',
            termLength: 4,
            totalSearches: 10,
            successfulSearches: 8,
            failedSearches: 2,
            totalResults: 100,
            maxResults: 20,
            minResults: 5,
            lastSearched: new Date(),
            efficiency: 10.0,
            successRate: 0.8,
            avgResultsPerSearch: 10.0,
          },
          {
            id: '2',
            searchTerm: 'Term2',
            termLength: 5,
            totalSearches: 5,
            successfulSearches: 5,
            failedSearches: 0,
            totalResults: 50,
            maxResults: 15,
            minResults: 8,
            lastSearched: new Date(),
            efficiency: 10.0,
            successRate: 1.0,
            avgResultsPerSearch: 10.0,
          },
        ]);

        const stats = await optimizer.getPerformanceStats();

        expect(stats.totalSearchTerms).toBe(2);
        expect(stats.avgEfficiency).toBe(10.0);
        expect(stats.avgSuccessRate).toBe(0.9);
        expect(stats.avgResultsPerSearch).toBe(10.0);
        expect(Array.isArray(stats.topPerformers)).toBe(true);
        expect(Array.isArray(stats.poorPerformers)).toBe(true);
      });

      it('should handle empty database', async () => {
        mockPrisma.searchTermAnalytics.findMany.mockResolvedValue([]);

        const stats = await optimizer.getPerformanceStats();

        expect(stats.totalSearchTerms).toBe(0);
        expect(stats.avgResultsPerSearch).toBe(0);
        expect(stats.avgSuccessRate).toBe(0);
        expect(stats.avgEfficiency).toBe(0);
      });
    });

    describe('isDatabaseEmpty', () => {
      it('should return true when database is empty', async () => {
        mockPrisma.scrapeJob.count.mockResolvedValue(0);

        const isEmpty = await optimizer.isDatabaseEmpty();

        expect(isEmpty).toBe(true);
      });

      it('should return false when database has data', async () => {
        mockPrisma.scrapeJob.count.mockResolvedValue(100);

        const isEmpty = await optimizer.isDatabaseEmpty();

        expect(isEmpty).toBe(false);
      });
    });
  });
});
