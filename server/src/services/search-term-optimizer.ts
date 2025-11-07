import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Optimized 4-character search terms for cold start
 * These are strategically chosen to maximize results per query
 * Based on common prefixes in entity names, property types, and locations
 */
export const OPTIMIZED_4_CHAR_STARTER_TERMS = [
  // Trust & Estate related (high yield)
  'Trus', 'Esta', 'Revo', 'Irre', 'Fami', 'Bene',

  // LLC & Corporate (high yield)
  'L.L.', 'LLC.', 'Limi', 'LMTD', 'Corp', 'Inc.', 'Inco',

  // Partnership & Associations
  'Part', 'Partn', 'Asso', 'Assn',

  // Real estate specific
  'Real', 'Realt', 'Prop', 'Park', 'Parc', 'Plaz', 'Cent',
  'Land', 'Lane', 'Home', 'Hous', 'Apar', 'Cond',

  // Business types (high yield)
  'Mana', 'Hold', 'Inve', 'Grou', 'Vent', 'Fund',
  'Capi', 'Deve', 'Buil', 'Cons',

  // Geographic/Street patterns
  'Main', 'Oak ', 'Elms', 'Pine', 'Mapl', 'Cedr',
  'West', 'East', 'Nort', 'Sout',

  // Common last names (high yield)
  'Smit', 'John', 'Wili', 'Brow', 'Jone', 'Mill', 'Davi',
  'Garc', 'Rodr', 'Wils', 'Mart', 'Ande', 'Tayl', 'Thom',

  // Foundation & Non-profit
  'Foun', 'Char', 'Endow',

  // Investment & Finance
  'Equi', 'Asse', 'Port', 'Trad',
];

export interface SearchTermPerformance {
  searchTerm: string;
  termLength: number;
  totalSearches: number;
  successfulSearches: number;
  failedSearches: number;
  totalResults: number;
  avgResultsPerSearch: number;
  maxResults: number;
  minResults: number | null;
  lastSearched: Date;
  successRate: number;
  efficiency: number;
}

export interface OptimizerConfig {
  minEfficiency?: number;        // Minimum efficiency score to consider term "good"
  minSuccessRate?: number;       // Minimum success rate (0-1)
  preferredTermLength?: number;  // Preferred term length (default: 4)
  maxTermsToReturn?: number;     // Maximum number of terms to return
  excludeRecentlyUsed?: boolean; // Exclude terms used within last N days
  recentDays?: number;           // Days to consider "recent"
}

export class SearchTermOptimizer {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || prisma;
  }

  /**
   * Get optimized starter terms for cold start (empty database)
   * Returns 4-character terms optimized for maximum coverage
   */
  async getStarterTerms(): Promise<string[]> {
    // Check if database has analytics data
    const analyticsCount = await this.prisma.searchTermAnalytics.count();

    if (analyticsCount === 0) {
      // Cold start - return optimized 4-char terms
      console.log('🚀 Cold start detected - using optimized 4-character starter terms');
      return OPTIMIZED_4_CHAR_STARTER_TERMS;
    }

    // Database has data - use analytics to optimize
    console.log('📊 Using analytics to optimize starter terms');
    return this.getOptimizedTerms({
      preferredTermLength: 4,
      minEfficiency: 5.0,
      minSuccessRate: 0.5,
      maxTermsToReturn: 50,
    });
  }

  /**
   * Update analytics after a scrape job completes
   */
  async updateAnalytics(
    searchTerm: string,
    resultCount: number,
    wasSuccessful: boolean,
    error?: string
  ): Promise<void> {
    const existing = await this.prisma.searchTermAnalytics.findUnique({
      where: { searchTerm },
    });

    if (existing) {
      // Update existing record
      const newTotalSearches = existing.totalSearches + 1;
      const newSuccessfulSearches = existing.successfulSearches + (wasSuccessful ? 1 : 0);
      const newFailedSearches = existing.failedSearches + (wasSuccessful ? 0 : 1);
      const newTotalResults = existing.totalResults + resultCount;
      const newAvgResults = newTotalResults / newSuccessfulSearches || 0;
      const newSuccessRate = newSuccessfulSearches / newTotalSearches;
      const newEfficiency = newAvgResults * newSuccessRate;

      await this.prisma.searchTermAnalytics.update({
        where: { searchTerm },
        data: {
          totalSearches: newTotalSearches,
          successfulSearches: newSuccessfulSearches,
          failedSearches: newFailedSearches,
          totalResults: newTotalResults,
          avgResultsPerSearch: newAvgResults,
          maxResults: Math.max(existing.maxResults, resultCount),
          minResults: existing.minResults
            ? Math.min(existing.minResults, resultCount)
            : resultCount,
          lastSearched: new Date(),
          successRate: newSuccessRate,
          efficiency: newEfficiency,
        },
      });
    } else {
      // Create new record
      const successRate = wasSuccessful ? 1.0 : 0.0;
      const avgResults = wasSuccessful ? resultCount : 0;
      const efficiency = avgResults * successRate;

      await this.prisma.searchTermAnalytics.create({
        data: {
          searchTerm,
          termLength: searchTerm.length,
          totalSearches: 1,
          successfulSearches: wasSuccessful ? 1 : 0,
          failedSearches: wasSuccessful ? 0 : 1,
          totalResults: resultCount,
          avgResultsPerSearch: avgResults,
          maxResults: resultCount,
          minResults: wasSuccessful ? resultCount : null,
          lastSearched: new Date(),
          successRate,
          efficiency,
        },
      });
    }
  }

  /**
   * Get optimized search terms based on historical performance
   */
  async getOptimizedTerms(config: OptimizerConfig = {}): Promise<string[]> {
    const {
      minEfficiency = 5.0,
      minSuccessRate = 0.5,
      preferredTermLength = 4,
      maxTermsToReturn = 50,
      excludeRecentlyUsed = false,
      recentDays = 7,
    } = config;

    const whereClause: any = {
      efficiency: { gte: minEfficiency },
      successRate: { gte: minSuccessRate },
    };

    if (preferredTermLength) {
      whereClause.termLength = preferredTermLength;
    }

    if (excludeRecentlyUsed) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - recentDays);
      whereClause.lastSearched = { lte: cutoffDate };
    }

    const analytics = await this.prisma.searchTermAnalytics.findMany({
      where: whereClause,
      orderBy: [
        { efficiency: 'desc' },
        { avgResultsPerSearch: 'desc' },
      ],
      take: maxTermsToReturn,
    });

    return analytics.map(a => a.searchTerm);
  }

  /**
   * Get performance statistics for all search terms
   */
  async getPerformanceStats(): Promise<{
    totalSearchTerms: number;
    avgEfficiency: number;
    avgSuccessRate: number;
    avgResultsPerSearch: number;
    topPerformers: SearchTermPerformance[];
    poorPerformers: SearchTermPerformance[];
  }> {
    const allAnalytics = await this.prisma.searchTermAnalytics.findMany();

    if (allAnalytics.length === 0) {
      return {
        totalSearchTerms: 0,
        avgEfficiency: 0,
        avgSuccessRate: 0,
        avgResultsPerSearch: 0,
        topPerformers: [],
        poorPerformers: [],
      };
    }

    const totalEfficiency = allAnalytics.reduce((sum, a) => sum + a.efficiency, 0);
    const totalSuccessRate = allAnalytics.reduce((sum, a) => sum + a.successRate, 0);
    const totalAvgResults = allAnalytics.reduce((sum, a) => sum + a.avgResultsPerSearch, 0);

    const topPerformers = await this.prisma.searchTermAnalytics.findMany({
      orderBy: { efficiency: 'desc' },
      take: 20,
    });

    const poorPerformers = await this.prisma.searchTermAnalytics.findMany({
      where: { successRate: { lt: 0.3 } },
      orderBy: { efficiency: 'asc' },
      take: 20,
    });

    return {
      totalSearchTerms: allAnalytics.length,
      avgEfficiency: totalEfficiency / allAnalytics.length,
      avgSuccessRate: totalSuccessRate / allAnalytics.length,
      avgResultsPerSearch: totalAvgResults / allAnalytics.length,
      topPerformers: topPerformers as SearchTermPerformance[],
      poorPerformers: poorPerformers as SearchTermPerformance[],
    };
  }

  /**
   * Get insights on what term lengths and patterns work best
   */
  async getTermLengthAnalysis(): Promise<{
    byLength: Record<number, {
      count: number;
      avgEfficiency: number;
      avgResultsPerSearch: number;
      avgSuccessRate: number;
    }>;
  }> {
    const allAnalytics = await this.prisma.searchTermAnalytics.findMany();

    const byLength: Record<number, any> = {};

    for (const analytics of allAnalytics) {
      if (!byLength[analytics.termLength]) {
        byLength[analytics.termLength] = {
          count: 0,
          totalEfficiency: 0,
          totalAvgResults: 0,
          totalSuccessRate: 0,
        };
      }

      byLength[analytics.termLength].count++;
      byLength[analytics.termLength].totalEfficiency += analytics.efficiency;
      byLength[analytics.termLength].totalAvgResults += analytics.avgResultsPerSearch;
      byLength[analytics.termLength].totalSuccessRate += analytics.successRate;
    }

    // Calculate averages
    for (const length in byLength) {
      const data = byLength[length];
      byLength[length] = {
        count: data.count,
        avgEfficiency: data.totalEfficiency / data.count,
        avgResultsPerSearch: data.totalAvgResults / data.count,
        avgSuccessRate: data.totalSuccessRate / data.count,
      };
    }

    return { byLength };
  }

  /**
   * Suggest new terms based on successful patterns
   */
  async suggestNewTerms(count: number = 20): Promise<string[]> {
    // Get top performing terms
    const topTerms = await this.prisma.searchTermAnalytics.findMany({
      where: { efficiency: { gte: 10.0 } },
      orderBy: { efficiency: 'desc' },
      take: 50,
    });

    if (topTerms.length === 0) {
      return OPTIMIZED_4_CHAR_STARTER_TERMS.slice(0, count);
    }

    // Analyze patterns in successful terms
    const suggestions = new Set<string>();

    for (const term of topTerms) {
      // Generate variations of successful terms
      if (term.searchTerm.length >= 4) {
        // Prefix variations (first 4 chars)
        suggestions.add(term.searchTerm.substring(0, 4));

        // If term is longer, try middle and end substrings
        if (term.searchTerm.length > 4) {
          suggestions.add(term.searchTerm.substring(0, 5));
          suggestions.add(term.searchTerm.substring(0, 3));
        }
      }
    }

    // Filter out terms we've already tried
    const alreadyTried = new Set(topTerms.map(t => t.searchTerm));
    const newSuggestions = Array.from(suggestions)
      .filter(s => !alreadyTried.has(s))
      .slice(0, count);

    return newSuggestions;
  }

  /**
   * Check if database is empty (cold start scenario)
   */
  async isDatabaseEmpty(): Promise<boolean> {
    const scrapeJobCount = await this.prisma.scrapeJob.count();
    return scrapeJobCount === 0;
  }
}

export const searchTermOptimizer = new SearchTermOptimizer();
