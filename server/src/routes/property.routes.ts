import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { scraperQueue, canScheduleJob } from '../queues/scraper.queue';
import { prisma, prismaReadOnly } from '../lib/prisma';
import { ScrapeRequest, ScrapeResponse } from '../types';
import { claudeSearchService } from '../lib/claude.service';

const router = Router();

// Validation schemas
const scrapeRequestSchema = z.object({
  searchTerm: z.string().min(4, 'Search term must be at least 4 characters').max(100),
  userId: z.string().optional(),
});

const propertyFilterSchema = z.object({
  searchTerm: z.string().optional(),
  city: z.string().optional(),
  propType: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});

// POST /api/properties/scrape - Trigger a new scrape job
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    const validatedData = scrapeRequestSchema.parse(req.body);

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error queuing scrape job:', error);
    res.status(500).json({ error: 'Failed to queue scrape job' });
  }
});

// GET /api/properties/jobs/:jobId - Get job status
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

// GET /api/properties - Get properties from database with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = propertyFilterSchema.parse(req.query);

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// GET /api/properties/search/test - Test Claude API connection
router.get('/search/test', async (req: Request, res: Response) => {
  try {
    const testQuery = 'properties in Austin';
    const result = await claudeSearchService.parseNaturalLanguageQuery(testQuery);

    res.json({
      success: true,
      message: 'Claude API connection successful',
      testQuery,
      result,
    });
  } catch (error) {
    console.error('Claude API test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Claude API connection failed',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    });
  }
});

// POST /api/properties/search - Natural language search powered by Claude
router.post('/search', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    console.error('Error in natural language search:', error);
    res.status(500).json({ error: 'Failed to process search query' });
  }
});

// GET /api/properties/history - Get scrape job history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

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
  } catch (error) {
    console.error('Error fetching scrape history:', error);
    res.status(500).json({ error: 'Failed to fetch scrape history' });
  }
});

// GET /api/properties/stats - Get statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// POST /api/properties/monitor - Add a search term to monitor
router.post('/monitor', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    console.error('Error adding monitored search:', error);
    res.status(500).json({ error: 'Failed to add monitored search' });
  }
});

// GET /api/properties/monitor - Get monitored search terms
router.get('/monitor', async (req: Request, res: Response) => {
  try {
    const monitoredSearches = await prismaReadOnly.monitoredSearch.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: monitoredSearches });
  } catch (error) {
    console.error('Error fetching monitored searches:', error);
    res.status(500).json({ error: 'Failed to fetch monitored searches' });
  }
});

export { router as propertyRouter };
