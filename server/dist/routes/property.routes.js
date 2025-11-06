"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyRouter = void 0;
const express_1 = require("express");
const property_controller_1 = require("../controllers/property.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const property_types_1 = require("../types/property.types");
const router = (0, express_1.Router)();
exports.propertyRouter = router;
// ============================================================================
// Scraping Routes
// ============================================================================
/**
 * POST /api/properties/scrape
 * Trigger a new scrape job for the given search term
 */
router.post('/scrape', (0, validation_middleware_1.validateBody)(property_types_1.scrapeRequestSchema), (0, error_middleware_1.asyncHandler)(property_controller_1.propertyController.scrapeProperties.bind(property_controller_1.propertyController)));
/**
 * GET /api/properties/jobs/:jobId
 * Get the status of a specific scrape job
 */
router.get('/jobs/:jobId', (0, error_middleware_1.asyncHandler)(property_controller_1.propertyController.getJobStatus.bind(property_controller_1.propertyController)));
/**
 * GET /api/properties/history
 * Get scrape job history with pagination
 */
router.get('/history', (0, validation_middleware_1.validateQuery)(property_types_1.historyQuerySchema), (0, error_middleware_1.asyncHandler)(property_controller_1.propertyController.getScrapeHistory.bind(property_controller_1.propertyController)));
// ============================================================================
// Property Query Routes
// ============================================================================
/**
 * GET /api/properties
 * Get properties from database with optional filters
 */
router.get('/', (0, validation_middleware_1.validateQuery)(property_types_1.propertyFilterSchema), (0, error_middleware_1.asyncHandler)(property_controller_1.propertyController.getProperties.bind(property_controller_1.propertyController)));
/**
 * POST /api/properties/search
 * Natural language search powered by Claude AI
 */
router.post('/search', (0, validation_middleware_1.validateBody)(property_types_1.naturalLanguageSearchSchema), (0, error_middleware_1.asyncHandler)(property_controller_1.propertyController.naturalLanguageSearch.bind(property_controller_1.propertyController)));
/**
 * GET /api/properties/search/test
 * Test endpoint for Claude API connection
 */
router.get('/search/test', (0, error_middleware_1.asyncHandler)(property_controller_1.propertyController.testClaudeConnection.bind(property_controller_1.propertyController)));
// ============================================================================
// Statistics & Analytics Routes
// ============================================================================
/**
 * GET /api/properties/stats
 * Get aggregate statistics about properties and scrape jobs
 */
router.get('/stats', (0, error_middleware_1.asyncHandler)(property_controller_1.propertyController.getStats.bind(property_controller_1.propertyController)));
// ============================================================================
// Monitoring Routes
// ============================================================================
/**
 * POST /api/properties/monitor
 * Add a search term to the monitoring list
 */
router.post('/monitor', (0, validation_middleware_1.validateBody)(property_types_1.monitorRequestSchema), (0, error_middleware_1.asyncHandler)(property_controller_1.propertyController.addMonitoredSearch.bind(property_controller_1.propertyController)));
/**
 * GET /api/properties/monitor
 * Get all active monitored search terms
 */
router.get('/monitor', (0, error_middleware_1.asyncHandler)(property_controller_1.propertyController.getMonitoredSearches.bind(property_controller_1.propertyController)));
//# sourceMappingURL=property.routes.js.map