"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const scraper_queue_1 = require("../queues/scraper.queue");
const prisma_1 = require("../lib/prisma");
const claude_service_1 = require("../lib/claude.service");
const router = (0, express_1.Router)();
exports.propertyRouter = router;
// Validation schemas
const scrapeRequestSchema = zod_1.z.object({
    searchTerm: zod_1.z.string().min(4, 'Search term must be at least 4 characters').max(100),
    userId: zod_1.z.string().optional(),
});
const propertyFilterSchema = zod_1.z.object({
    searchTerm: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    propType: zod_1.z.string().optional(),
    minValue: zod_1.z.number().optional(),
    maxValue: zod_1.z.number().optional(),
    limit: zod_1.z.number().min(1).max(1000).default(100),
    offset: zod_1.z.number().min(0).default(0),
});
// POST /api/properties/scrape - Trigger a new scrape job
router.post('/scrape', async (req, res) => {
    try {
        const validatedData = scrapeRequestSchema.parse(req.body);
        // Check rate limiting
        const canSchedule = await (0, scraper_queue_1.canScheduleJob)(validatedData.searchTerm);
        if (!canSchedule) {
            return res.status(429).json({
                error: 'Rate limit exceeded. Please wait before scraping the same search term again.',
            });
        }
        // Add job to queue
        const job = await scraper_queue_1.scraperQueue.add('scrape-properties', validatedData, {
            delay: 0,
            attempts: 3,
        });
        const response = {
            jobId: job.id.toString(),
            message: 'Scrape job queued successfully',
        };
        res.status(202).json(response);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        console.error('Error queuing scrape job:', error);
        res.status(500).json({ error: 'Failed to queue scrape job' });
    }
});
// GET /api/properties/jobs/:jobId - Get job status
router.get('/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await scraper_queue_1.scraperQueue.getJob(jobId);
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
    catch (error) {
        console.error('Error fetching job status:', error);
        res.status(500).json({ error: 'Failed to fetch job status' });
    }
});
// GET /api/properties - Get properties from database with filters
router.get('/', async (req, res) => {
    try {
        const filters = propertyFilterSchema.parse(req.query);
        const where = {};
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
            if (filters.minValue)
                where.appraisedValue.gte = filters.minValue;
            if (filters.maxValue)
                where.appraisedValue.lte = filters.maxValue;
        }
        const [properties, total] = await Promise.all([
            prisma_1.prismaReadOnly.property.findMany({
                where,
                skip: filters.offset,
                take: filters.limit,
                orderBy: { scrapedAt: 'desc' },
            }),
            prisma_1.prismaReadOnly.property.count({ where }),
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
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
        }
        console.error('Error fetching properties:', error);
        res.status(500).json({ error: 'Failed to fetch properties' });
    }
});
// GET /api/properties/search/test - Test Claude API connection
router.get('/search/test', async (req, res) => {
    try {
        const testQuery = 'properties in Austin';
        const result = await claude_service_1.claudeSearchService.parseNaturalLanguageQuery(testQuery);
        res.json({
            success: true,
            message: 'Claude API connection successful',
            testQuery,
            result,
        });
    }
    catch (error) {
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
router.post('/search', async (req, res) => {
    try {
        const { query, limit = 100, offset = 0 } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query is required and must be a string' });
        }
        // Use Claude to parse the natural language query
        const { whereClause, orderBy, explanation } = await claude_service_1.claudeSearchService.parseNaturalLanguageQuery(query);
        // Query the database with the generated filters
        const [properties, total] = await Promise.all([
            prisma_1.prismaReadOnly.property.findMany({
                where: whereClause,
                orderBy: orderBy || { scrapedAt: 'desc' },
                skip: offset,
                take: Math.min(limit, 1000),
            }),
            prisma_1.prismaReadOnly.property.count({ where: whereClause }),
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
    catch (error) {
        console.error('Error in natural language search:', error);
        res.status(500).json({ error: 'Failed to process search query' });
    }
});
// GET /api/properties/history - Get scrape job history
router.get('/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const jobs = await prisma_1.prismaReadOnly.scrapeJob.findMany({
            orderBy: { startedAt: 'desc' },
            skip: offset,
            take: limit,
        });
        const total = await prisma_1.prismaReadOnly.scrapeJob.count();
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
    catch (error) {
        console.error('Error fetching scrape history:', error);
        res.status(500).json({ error: 'Failed to fetch scrape history' });
    }
});
// GET /api/properties/stats - Get statistics
router.get('/stats', async (req, res) => {
    try {
        const [totalProperties, totalJobs, recentJobs, cityStats, typeStats] = await Promise.all([
            prisma_1.prismaReadOnly.property.count(),
            prisma_1.prismaReadOnly.scrapeJob.count(),
            prisma_1.prismaReadOnly.scrapeJob.count({
                where: {
                    startedAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                    },
                },
            }),
            prisma_1.prismaReadOnly.property.groupBy({
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
            prisma_1.prismaReadOnly.property.groupBy({
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
    catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});
// POST /api/properties/monitor - Add a search term to monitor
router.post('/monitor', async (req, res) => {
    try {
        const { searchTerm, frequency = 'daily' } = req.body;
        if (!searchTerm) {
            return res.status(400).json({ error: 'Search term is required' });
        }
        const monitoredSearch = await prisma_1.prisma.monitoredSearch.upsert({
            where: { searchTerm },
            update: { active: true, frequency },
            create: { searchTerm, frequency },
        });
        res.json({
            message: 'Search term added to monitoring',
            data: monitoredSearch,
        });
    }
    catch (error) {
        console.error('Error adding monitored search:', error);
        res.status(500).json({ error: 'Failed to add monitored search' });
    }
});
// GET /api/properties/monitor - Get monitored search terms
router.get('/monitor', async (req, res) => {
    try {
        const monitoredSearches = await prisma_1.prismaReadOnly.monitoredSearch.findMany({
            where: { active: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ data: monitoredSearches });
    }
    catch (error) {
        console.error('Error fetching monitored searches:', error);
        res.status(500).json({ error: 'Failed to fetch monitored searches' });
    }
});
//# sourceMappingURL=property.routes.js.map