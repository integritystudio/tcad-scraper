import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { scraperQueue, canScheduleJob } from '../queues/scraper.queue';
import { prisma } from '../lib/prisma';
import { ScrapeRequest, ScrapeResponse } from '../types';

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
      prisma.property.findMany({
        where,
        skip: filters.offset,
        take: filters.limit,
        orderBy: { scrapedAt: 'desc' },
      }),
      prisma.property.count({ where }),
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

// GET /api/properties/history - Get scrape job history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const jobs = await prisma.scrapeJob.findMany({
      orderBy: { startedAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await prisma.scrapeJob.count();

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
      prisma.property.count(),
      prisma.scrapeJob.count(),
      prisma.scrapeJob.count({
        where: {
          startedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
      prisma.property.groupBy({
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
      prisma.property.groupBy({
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
    const monitoredSearches = await prisma.monitoredSearch.findMany({
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