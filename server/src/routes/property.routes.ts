import { Router } from "express";
import { propertyController } from "../controllers/property.controller";
import { apiKeyAuth } from "../middleware/auth";
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
} from "../types/property.types";

const router = Router();

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
	asyncHandler(propertyController.getProperties),
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
	asyncHandler(propertyController.naturalLanguageSearch),
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
	asyncHandler(propertyController.testClaudeConnection),
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
router.get("/stats", asyncHandler(propertyController.getStats));

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
	apiKeyAuth,
	validateBody(monitorRequestSchema),
	asyncHandler(propertyController.addMonitoredSearch),
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
router.get("/monitor", asyncHandler(propertyController.getMonitoredSearches));

export { router as propertyRouter };
