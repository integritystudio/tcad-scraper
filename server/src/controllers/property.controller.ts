import { Request, Response } from 'express';
import { scraperQueue, canScheduleJob } from '../queues/scraper.queue';
import { prisma, prismaReadOnly } from '../lib/prisma';
import { ScrapeResponse } from '../types';
import { claudeSearchService } from '../lib/claude.service';
import type {
  ScrapeRequestBody,
  PropertyFilters,
  NaturalLanguageSearchBody,
  HistoryQueryParams,
  MonitorRequestBody
} from '../types/property.types';

export class PropertyController {
  /**
   * POST /api/properties/scrape - Trigger a new scrape job
   */
  async scrapeProperties(req: Request<{}, {}, ScrapeRequestBody>, res: Response) {
    const validatedData = req.body;

    // Check rate limiting
    const canSchedule = await canScheduleJob(validatedData.searchTerm);
    if (!canSchedule) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before scraping the same search term again.',
      });
    }

    // Add job to queue
    const job = await scraperQueue.add('scrape-properties', validatedData, {
      delay: 0,
      attempts: 3,
    });

    const response: ScrapeResponse = {
      jobId: job.id.toString(),
      message: 'Scrape job queued successfully',
    };

    res.status(202).json(response);
  }

  /**
   * GET /api/properties/jobs/:jobId - Get job status
   */
  async getJobStatus(req: Request<{ jobId: string }>, res: Response) {
    const { jobId } = req.params;

    const job = await scraperQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress();

    let result = null;
    if (state === 'completed') {
      result = job.returnvalue;
    }

    let error = null;
    if (state === 'failed') {
      error = job.failedReason;
    }

    res.json({
      id: jobId,
      status: state,
      progress: typeof progress === 'number' ? progress : 0,
      resultCount: result?.count,
      error,
      createdAt: new Date(job.timestamp),
      completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
    });
  }

  /**
   * GET /api/properties - Get properties from database with filters
   */
  async getProperties(req: Request<{}, {}, {}, PropertyFilters>, res: Response) {
    const filters = req.query as PropertyFilters;

    const where = this.buildWhereClause(filters);

    const [properties, total] = await Promise.all([
      prismaReadOnly.property.findMany({
        where,
        skip: filters.offset,
        take: filters.limit,
        orderBy: { scrapedAt: 'desc' },
      }),
      prismaReadOnly.property.count({ where }),
    ]);

    res.json({
      data: properties,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + filters.limit < total,
      },
    });
  }

  /**
   * GET /api/properties/search/test - Test Claude API connection
   */
  async testClaudeConnection(req: Request, res: Response) {
    const testQuery = 'properties in Austin';
    const result = await claudeSearchService.parseNaturalLanguageQuery(testQuery);

    res.json({
      success: true,
      message: 'Claude API connection successful',
      testQuery,
      result,
    });
  }

  /**
   * POST /api/properties/search - Natural language search powered by Claude
   */
  async naturalLanguageSearch(req: Request<{}, {}, NaturalLanguageSearchBody>, res: Response) {
    const { query, limit = 100, offset = 0 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    // Use Claude to parse the natural language query
    const { whereClause, orderBy, explanation } = await claudeSearchService.parseNaturalLanguageQuery(query);

    // Query the database with the generated filters
    const [properties, total] = await Promise.all([
      prismaReadOnly.property.findMany({
        where: whereClause,
        orderBy: orderBy || { scrapedAt: 'desc' },
        skip: offset,
        take: Math.min(limit, 1000),
      }),
      prismaReadOnly.property.count({ where: whereClause }),
    ]);

    res.json({
      data: properties,
      pagination: {
        total,
        limit: Math.min(limit, 1000),
        offset,
        hasMore: offset + properties.length < total,
      },
      query: {
        original: query,
        explanation,
      },
    });
  }

  /**
   * GET /api/properties/history - Get scrape job history
   */
  async getScrapeHistory(req: Request<{}, {}, {}, HistoryQueryParams>, res: Response) {
    const { limit = 20, offset = 0 } = req.query;

    const jobs = await prismaReadOnly.scrapeJob.findMany({
      orderBy: { startedAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await prismaReadOnly.scrapeJob.count();

    res.json({
      data: jobs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  }

  /**
   * GET /api/properties/stats - Get statistics
   */
  async getStats(req: Request, res: Response) {
    const [totalProperties, totalJobs, recentJobs, cityStats, typeStats] = await Promise.all([
      prismaReadOnly.property.count(),
      prismaReadOnly.scrapeJob.count(),
      prismaReadOnly.scrapeJob.count({
        where: {
          startedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
      prismaReadOnly.property.groupBy({
        by: ['city'],
        _count: true,
        where: {
          city: { not: null },
        },
        orderBy: {
          _count: {
            city: 'desc',
          },
        },
        take: 10,
      }),
      prismaReadOnly.property.groupBy({
        by: ['propType'],
        _count: true,
        _avg: {
          appraisedValue: true,
        },
        orderBy: {
          _count: {
            propType: 'desc',
          },
        },
      }),
    ]);

    res.json({
      totalProperties,
      totalJobs,
      recentJobs,
      cityDistribution: cityStats,
      propertyTypeDistribution: typeStats,
    });
  }

  /**
   * POST /api/properties/monitor - Add a search term to monitor
   */
  async addMonitoredSearch(req: Request<{}, {}, MonitorRequestBody>, res: Response) {
    const { searchTerm, frequency = 'daily' } = req.body;

    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const monitoredSearch = await prisma.monitoredSearch.upsert({
      where: { searchTerm },
      update: { active: true, frequency },
      create: { searchTerm, frequency },
    });

    res.json({
      message: 'Search term added to monitoring',
      data: monitoredSearch,
    });
  }

  /**
   * GET /api/properties/monitor - Get monitored search terms
   */
  async getMonitoredSearches(req: Request, res: Response) {
    const monitoredSearches = await prismaReadOnly.monitoredSearch.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: monitoredSearches });
  }

  /**
   * Helper method to build Prisma where clause from filters
   */
  private buildWhereClause(filters: PropertyFilters) {
    const where: any = {};

    if (filters.searchTerm) {
      where.OR = [
        { searchTerm: { contains: filters.searchTerm, mode: 'insensitive' } },
        { name: { contains: filters.searchTerm, mode: 'insensitive' } },
        { propertyAddress: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    if (filters.city) {
      where.city = filters.city;
    }

    if (filters.propType) {
      where.propType = filters.propType;
    }

    if (filters.minValue || filters.maxValue) {
      where.appraisedValue = {};
      if (filters.minValue) where.appraisedValue.gte = filters.minValue;
      if (filters.maxValue) where.appraisedValue.lte = filters.maxValue;
    }

    return where;
  }
}

export const propertyController = new PropertyController();
