import { Router } from 'express';
import { propertyController } from '../controllers/property.controller';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import {
  scrapeRequestSchema,
  propertyFilterSchema,
  naturalLanguageSearchSchema,
  historyQuerySchema,
  monitorRequestSchema,
} from '../types/property.types';

const router = Router();

// ============================================================================
// Scraping Routes
// ============================================================================

/**
 * @swagger
 * /api/properties/scrape:
 *   post:
 *     summary: Trigger a new scrape job
 *     description: Queue a new web scraping job to collect property data for the given search term
 *     tags: [Scraping]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - searchTerm
 *             properties:
 *               searchTerm:
 *                 type: string
 *                 description: Search term to query TCAD website
 *                 example: Smith
 *               userId:
 *                 type: string
 *                 description: Optional user ID for tracking
 *               scheduled:
 *                 type: boolean
 *                 description: Whether this is a scheduled job
 *                 default: false
 *     responses:
 *       202:
 *         description: Job queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   description: Job ID for status tracking
 *                   example: "12345"
 *                 message:
 *                   type: string
 *                   example: Scrape job queued successfully
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/scrape',
  validateBody(scrapeRequestSchema),
  asyncHandler(propertyController.scrapeProperties.bind(propertyController))
);

/**
 * GET /api/properties/jobs/:jobId
 * Get the status of a specific scrape job
 */
router.get(
  '/jobs/:jobId',
  asyncHandler(propertyController.getJobStatus.bind(propertyController))
);

/**
 * GET /api/properties/history
 * Get scrape job history with pagination
 */
router.get(
  '/history',
  validateQuery(historyQuerySchema),
  asyncHandler(propertyController.getScrapeHistory.bind(propertyController))
);

// ============================================================================
// Property Query Routes
// ============================================================================

/**
 * @swagger
 * /api/properties:
 *   get:
 *     summary: Get properties from database
 *     description: Query properties with optional filters (cached for 5 minutes)
 *     tags: [Properties]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city name
 *         example: Austin
 *       - in: query
 *         name: propType
 *         schema:
 *           type: string
 *         description: Filter by property type
 *         example: Residential
 *       - in: query
 *         name: minValue
 *         schema:
 *           type: number
 *         description: Minimum appraised value
 *         example: 100000
 *       - in: query
 *         name: maxValue
 *         schema:
 *           type: number
 *         description: Maximum appraised value
 *         example: 500000
 *       - in: query
 *         name: searchTerm
 *         schema:
 *           type: string
 *         description: Filter by original search term
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 1000
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Property list with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Property'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 */
router.get(
  '/',
  validateQuery(propertyFilterSchema),
  asyncHandler(propertyController.getProperties.bind(propertyController))
);

/**
 * POST /api/properties/search
 * Natural language search powered by Claude AI
 */
router.post(
  '/search',
  validateBody(naturalLanguageSearchSchema),
  asyncHandler(propertyController.naturalLanguageSearch.bind(propertyController))
);

/**
 * GET /api/properties/search/test
 * Test endpoint for Claude API connection
 */
router.get(
  '/search/test',
  asyncHandler(propertyController.testClaudeConnection.bind(propertyController))
);

// ============================================================================
// Statistics & Analytics Routes
// ============================================================================

/**
 * GET /api/properties/stats
 * Get aggregate statistics about properties and scrape jobs
 */
router.get(
  '/stats',
  asyncHandler(propertyController.getStats.bind(propertyController))
);

// ============================================================================
// Monitoring Routes
// ============================================================================

/**
 * POST /api/properties/monitor
 * Add a search term to the monitoring list
 */
router.post(
  '/monitor',
  validateBody(monitorRequestSchema),
  asyncHandler(propertyController.addMonitoredSearch.bind(propertyController))
);

/**
 * GET /api/properties/monitor
 * Get all active monitored search terms
 */
router.get(
  '/monitor',
  asyncHandler(propertyController.getMonitoredSearches.bind(propertyController))
);

export { router as propertyRouter };
