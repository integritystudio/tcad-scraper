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
 * POST /api/properties/scrape
 * Trigger a new scrape job for the given search term
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
 * GET /api/properties
 * Get properties from database with optional filters
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
