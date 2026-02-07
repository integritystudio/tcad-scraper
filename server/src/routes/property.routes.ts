import { Router } from "express";
import { propertyController } from "../controllers/property.controller";
import { asyncHandler } from "../middleware/error.middleware";
import {
	validateBody,
	validateQuery,
} from "../middleware/validation.middleware";
import {
	historyQuerySchema,
	monitorRequestSchema,
	naturalLanguageSearchSchema,
	propertyFilterSchema,
	scrapeRequestSchema,
} from "../types/property.types";

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
	"/scrape",
	validateBody(scrapeRequestSchema),
	asyncHandler(propertyController.scrapeProperties.bind(propertyController)),
);

/**
 * @swagger
 * /api/properties/jobs/{jobId}:
 *   get:
 *     summary: Get scrape job status
 *     description: Retrieve the current status and details of a specific scrape job
 *     tags: [Scraping]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: The job ID returned when the scrape was queued
 *         example: "12345"
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScrapeJob'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
	"/jobs/:jobId",
	asyncHandler(
		propertyController.getJobStatus.bind(propertyController),
	),
);

/**
 * @swagger
 * /api/properties/history:
 *   get:
 *     summary: Get scrape job history
 *     description: Retrieve paginated scrape job history with optional filters
 *     tags: [Scraping]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of jobs per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Number of jobs to skip
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: Filter by job status
 *     responses:
 *       200:
 *         description: Job history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ScrapeJob'
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
	"/history",
	validateQuery(historyQuerySchema),
	asyncHandler(
		propertyController.getScrapeHistory.bind(propertyController),
	),
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
	"/",
	validateQuery(propertyFilterSchema),
	asyncHandler(
		propertyController.getProperties.bind(propertyController),
	),
);

/**
 * @swagger
 * /api/properties/search:
 *   post:
 *     summary: Natural language property search
 *     description: Search properties using natural language queries powered by Claude AI
 *     tags: [Search]
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
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Natural language search query
 *                 example: Find all residential properties in Austin worth more than $500k
 *               limit:
 *                 type: integer
 *                 default: 20
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Property'
 *                 query:
 *                   type: string
 *                   description: The original query
 *                 parsedFilters:
 *                   type: object
 *                   description: AI-interpreted filters
 *       400:
 *         description: Invalid query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
	"/search",
	validateBody(naturalLanguageSearchSchema),
	asyncHandler(
		propertyController.naturalLanguageSearch.bind(propertyController),
	),
);

/**
 * @swagger
 * /api/properties/search/test:
 *   get:
 *     summary: Test Claude AI connection
 *     description: Test endpoint to verify Claude AI API connectivity and functionality
 *     tags: [Search]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Claude AI connection successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Claude AI connection test successful
 *       500:
 *         description: Claude AI connection failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
	"/search/test",
	asyncHandler(
		propertyController.testClaudeConnection.bind(propertyController),
	),
);

// ============================================================================
// Statistics & Analytics Routes
// ============================================================================

/**
 * @swagger
 * /api/properties/stats:
 *   get:
 *     summary: Get property statistics
 *     description: Retrieve aggregate statistics about properties and scrape jobs (cached for 10 minutes)
 *     tags: [Statistics]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalProperties:
 *                   type: integer
 *                   description: Total number of properties in database
 *                   example: 12345
 *                 totalJobs:
 *                   type: integer
 *                   description: Total number of scrape jobs
 *                   example: 567
 *                 jobsByStatus:
 *                   type: object
 *                   properties:
 *                     pending:
 *                       type: integer
 *                     processing:
 *                       type: integer
 *                     completed:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                 propertiesByCity:
 *                   type: object
 *                   description: Property count grouped by city
 *                   additionalProperties:
 *                     type: integer
 *                 propertiesByType:
 *                   type: object
 *                   description: Property count grouped by type
 *                   additionalProperties:
 *                     type: integer
 *                 averageValue:
 *                   type: number
 *                   description: Average appraised value
 *                   example: 275000
 */
router.get(
	"/stats",
	asyncHandler(propertyController.getStats.bind(propertyController)),
);

// ============================================================================
// Monitoring Routes
// ============================================================================

/**
 * @swagger
 * /api/properties/monitor:
 *   post:
 *     summary: Add monitored search term
 *     description: Add a search term to the monitoring list for scheduled scraping
 *     tags: [Monitoring]
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
 *                 description: Search term to monitor
 *                 example: Smith
 *               schedule:
 *                 type: string
 *                 description: Cron schedule expression (optional)
 *                 example: "0 0 * * *"
 *               enabled:
 *                 type: boolean
 *                 description: Whether monitoring is active
 *                 default: true
 *     responses:
 *       201:
 *         description: Search term added to monitoring list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 searchTerm:
 *                   type: string
 *                 schedule:
 *                   type: string
 *                 enabled:
 *                   type: boolean
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
	"/monitor",
	validateBody(monitorRequestSchema),
	asyncHandler(propertyController.addMonitoredSearch.bind(propertyController)),
);

/**
 * @swagger
 * /api/properties/monitor:
 *   get:
 *     summary: Get monitored search terms
 *     description: Retrieve all search terms that are actively being monitored
 *     tags: [Monitoring]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of monitored search terms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       searchTerm:
 *                         type: string
 *                       schedule:
 *                         type: string
 *                       enabled:
 *                         type: boolean
 *                       lastRun:
 *                         type: string
 *                         format: date-time
 *                       nextRun:
 *                         type: string
 *                         format: date-time
 */
router.get(
	"/monitor",
	asyncHandler(
		propertyController.getMonitoredSearches.bind(propertyController),
	),
);

export { router as propertyRouter };
