"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyController = exports.PropertyController = void 0;
const scraper_queue_1 = require("../queues/scraper.queue");
const prisma_1 = require("../lib/prisma");
const claude_service_1 = require("../lib/claude.service");
const redis_cache_service_1 = require("../lib/redis-cache.service");
class PropertyController {
    /**
     * POST /api/properties/scrape - Trigger a new scrape job
     */
    async scrapeProperties(req, res) {
        const validatedData = req.body;
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
        return res.status(202).json(response);
    }
    /**
     * GET /api/properties/jobs/:jobId - Get job status
     */
    async getJobStatus(req, res, _next) {
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
        return res.json({
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
     * Cached for 5 minutes per unique filter combination
     */
    async getProperties(req, res, _next) {
        const filters = req.query;
        // Generate cache key based on filters
        const cacheKey = `properties:list:${JSON.stringify(filters)}`;
        // Try to get from cache first (cache-aside pattern)
        const result = await redis_cache_service_1.cacheService.getOrSet(cacheKey, async () => {
            const where = this.buildWhereClause(filters);
            const [properties, total] = await Promise.all([
                prisma_1.prismaReadOnly.property.findMany({
                    where,
                    skip: filters.offset,
                    take: filters.limit,
                    orderBy: { scrapedAt: 'desc' },
                }),
                prisma_1.prismaReadOnly.property.count({ where }),
            ]);
            // Transform properties from camelCase (Prisma) to snake_case (frontend expectation)
            const transformedProperties = properties.map(prop => ({
                id: prop.id,
                property_id: prop.propertyId,
                name: prop.name,
                prop_type: prop.propType,
                city: prop.city,
                property_address: prop.propertyAddress,
                assessed_value: prop.assessedValue,
                appraised_value: prop.appraisedValue,
                geo_id: prop.geoId,
                description: prop.description,
                search_term: prop.searchTerm,
                scraped_at: prop.scrapedAt.toISOString(),
                created_at: prop.createdAt.toISOString(),
                updated_at: prop.updatedAt.toISOString(),
            }));
            return {
                data: transformedProperties,
                pagination: {
                    total,
                    limit: filters.limit,
                    offset: filters.offset,
                    hasMore: filters.offset + filters.limit < total,
                },
            };
        }, 300 // 5 minutes TTL
        );
        return res.json(result);
    }
    /**
     * GET /api/properties/search/test - Test Claude API connection
     */
    async testClaudeConnection(_req, res) {
        const testQuery = 'properties in Austin';
        const result = await claude_service_1.claudeSearchService.parseNaturalLanguageQuery(testQuery);
        return res.json({
            success: true,
            message: 'Claude API connection successful',
            testQuery,
            result,
        });
    }
    /**
     * POST /api/properties/search - Natural language search powered by Claude
     */
    async naturalLanguageSearch(req, res) {
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
        // Transform properties from camelCase (Prisma) to snake_case (frontend expectation)
        const transformedProperties = properties.map(prop => ({
            id: prop.id,
            property_id: prop.propertyId,
            name: prop.name,
            prop_type: prop.propType,
            city: prop.city,
            property_address: prop.propertyAddress,
            assessed_value: prop.assessedValue,
            appraised_value: prop.appraisedValue,
            geo_id: prop.geoId,
            description: prop.description,
            search_term: prop.searchTerm,
            scraped_at: prop.scrapedAt.toISOString(),
            created_at: prop.createdAt.toISOString(),
            updated_at: prop.updatedAt.toISOString(),
        }));
        return res.json({
            data: transformedProperties,
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
    async getScrapeHistory(req, res, _next) {
        const { limit = 20, offset = 0 } = req.query;
        const jobs = await prisma_1.prismaReadOnly.scrapeJob.findMany({
            orderBy: { startedAt: 'desc' },
            skip: offset,
            take: limit,
        });
        const total = await prisma_1.prismaReadOnly.scrapeJob.count();
        return res.json({
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
     * Cached for 10 minutes (expensive aggregation queries)
     */
    async getStats(_req, res) {
        const cacheKey = 'properties:stats:all';
        // Cache stats for 10 minutes (600 seconds)
        const stats = await redis_cache_service_1.cacheService.getOrSet(cacheKey, async () => {
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
            return {
                totalProperties,
                totalJobs,
                recentJobs,
                cityDistribution: cityStats,
                propertyTypeDistribution: typeStats,
            };
        }, 600 // 10 minutes TTL
        );
        return res.json(stats);
    }
    /**
     * POST /api/properties/monitor - Add a search term to monitor
     */
    async addMonitoredSearch(req, res) {
        const { searchTerm, frequency = 'daily' } = req.body;
        if (!searchTerm) {
            return res.status(400).json({ error: 'Search term is required' });
        }
        const monitoredSearch = await prisma_1.prisma.monitoredSearch.upsert({
            where: { searchTerm },
            update: { active: true, frequency },
            create: { searchTerm, frequency },
        });
        return res.json({
            message: 'Search term added to monitoring',
            data: monitoredSearch,
        });
    }
    /**
     * GET /api/properties/monitor - Get monitored search terms
     */
    async getMonitoredSearches(_req, res) {
        const monitoredSearches = await prisma_1.prismaReadOnly.monitoredSearch.findMany({
            where: { active: true },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ data: monitoredSearches });
    }
    /**
     * Helper method to build Prisma where clause from filters
     */
    buildWhereClause(filters) {
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
        return where;
    }
}
exports.PropertyController = PropertyController;
exports.propertyController = new PropertyController();
//# sourceMappingURL=property.controller.js.map