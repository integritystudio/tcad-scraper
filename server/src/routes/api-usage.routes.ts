import { Router } from 'express';
import { apiUsageController } from '../controllers/api-usage.controller';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

/**
 * @swagger
 * /api/usage/stats:
 *   get:
 *     summary: Get API usage statistics
 *     description: Retrieve aggregate statistics about Claude API usage and costs
 *     tags: [API Usage]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *           minimum: 1
 *           maximum: 90
 *         description: Number of days to look back
 *       - in: query
 *         name: environment
 *         schema:
 *           type: string
 *           enum: [development, production, staging]
 *         description: Filter by environment
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalCalls:
 *                       type: integer
 *                     successfulCalls:
 *                       type: integer
 *                     failedCalls:
 *                       type: integer
 *                     successRate:
 *                       type: string
 *                     totalCost:
 *                       type: string
 *                     averageCost:
 *                       type: string
 *                     period:
 *                       type: string
 *                 byDay:
 *                   type: array
 *                   items:
 *                     type: object
 *                 byModel:
 *                   type: array
 *                   items:
 *                     type: object
 *                 recentCalls:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get(
  '/stats',
  asyncHandler(apiUsageController.getUsageStats.bind(apiUsageController))
);

/**
 * @swagger
 * /api/usage/logs:
 *   get:
 *     summary: Get paginated API usage logs
 *     description: Retrieve detailed logs of Claude API calls
 *     tags: [API Usage]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 1000
 *         description: Number of logs per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Number of logs to skip
 *       - in: query
 *         name: environment
 *         schema:
 *           type: string
 *           enum: [development, production, staging]
 *         description: Filter by environment
 *       - in: query
 *         name: success
 *         schema:
 *           type: boolean
 *         description: Filter by success status
 *     responses:
 *       200:
 *         description: Usage logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 */
router.get(
  '/logs',
  asyncHandler(apiUsageController.getUsageLogs.bind(apiUsageController))
);

/**
 * @swagger
 * /api/usage/alerts:
 *   get:
 *     summary: Check for cost/usage alerts
 *     description: Get alerts about API usage exceeding thresholds
 *     tags: [API Usage]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Usage alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alerts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       level:
 *                         type: string
 *                         enum: [warning, critical]
 *                       message:
 *                         type: string
 *                 costs:
 *                   type: object
 *                   properties:
 *                     today:
 *                       type: string
 *                     month:
 *                       type: string
 *                 failures:
 *                   type: object
 *                 thresholds:
 *                   type: object
 */
router.get(
  '/alerts',
  asyncHandler(apiUsageController.getUsageAlerts.bind(apiUsageController))
);

export { router as apiUsageRouter };
