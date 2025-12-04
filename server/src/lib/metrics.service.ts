/**
 * Prometheus Metrics Service
 *
 * Provides comprehensive application monitoring with Prometheus metrics
 */

import {
	Counter,
	collectDefaultMetrics,
	Gauge,
	Histogram,
	Registry,
} from "prom-client";
import logger from "./logger";

// Create a new registry
const register = new Registry();

// Add default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({
	register,
	prefix: "tcad_scraper_",
});

// ============================================================================
// HTTP Metrics
// ============================================================================

/**
 * HTTP request counter
 * Tracks total number of HTTP requests by method, route, and status
 */
export const httpRequestsTotal = new Counter({
	name: "tcad_scraper_http_requests_total",
	help: "Total number of HTTP requests",
	labelNames: ["method", "route", "status_code"],
	registers: [register],
});

/**
 * HTTP request duration histogram
 * Tracks request processing time distribution
 */
export const httpRequestDuration = new Histogram({
	name: "tcad_scraper_http_request_duration_seconds",
	help: "HTTP request duration in seconds",
	labelNames: ["method", "route", "status_code"],
	buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // Response time buckets in seconds
	registers: [register],
});

// ============================================================================
// Scraper Metrics
// ============================================================================

/**
 * Scrape job counter
 * Tracks total number of scrape jobs by status
 */
export const scrapeJobsTotal = new Counter({
	name: "tcad_scraper_jobs_total",
	help: "Total number of scrape jobs",
	labelNames: ["status"], // pending, processing, completed, failed
	registers: [register],
});

/**
 * Scrape job duration histogram
 * Tracks how long scrape jobs take to complete
 */
export const scrapeJobDuration = new Histogram({
	name: "tcad_scraper_job_duration_seconds",
	help: "Scrape job duration in seconds",
	labelNames: ["status"],
	buckets: [5, 10, 30, 60, 120, 300, 600], // Job duration buckets in seconds
	registers: [register],
});

/**
 * Properties scraped counter
 * Tracks total number of properties scraped
 */
export const propertiesScrapedTotal = new Counter({
	name: "tcad_scraper_properties_scraped_total",
	help: "Total number of properties scraped",
	labelNames: ["search_term"],
	registers: [register],
});

/**
 * Active scrape jobs gauge
 * Tracks current number of active scrape jobs
 */
export const activeScrapeJobs = new Gauge({
	name: "tcad_scraper_active_jobs",
	help: "Current number of active scrape jobs",
	registers: [register],
});

// ============================================================================
// Queue Metrics
// ============================================================================

/**
 * Queue size gauge
 * Tracks current queue depth by status
 */
export const queueSize = new Gauge({
	name: "tcad_scraper_queue_size",
	help: "Current number of jobs in queue",
	labelNames: ["status"], // waiting, active, completed, failed
	registers: [register],
});

/**
 * Queue processing rate
 * Tracks jobs processed per second
 */
export const queueProcessingRate = new Counter({
	name: "tcad_scraper_queue_processed_total",
	help: "Total number of jobs processed from queue",
	labelNames: ["status"],
	registers: [register],
});

// ============================================================================
// Database Metrics
// ============================================================================

/**
 * Database query duration histogram
 * Tracks database query performance
 */
export const dbQueryDuration = new Histogram({
	name: "tcad_scraper_db_query_duration_seconds",
	help: "Database query duration in seconds",
	labelNames: ["operation", "table"],
	buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
	registers: [register],
});

/**
 * Database connection pool gauge
 * Tracks active database connections
 */
export const dbConnectionsActive = new Gauge({
	name: "tcad_scraper_db_connections_active",
	help: "Current number of active database connections",
	registers: [register],
});

/**
 * Database query counter
 * Tracks total number of database queries
 */
export const dbQueriesTotal = new Counter({
	name: "tcad_scraper_db_queries_total",
	help: "Total number of database queries",
	labelNames: ["operation", "table", "status"],
	registers: [register],
});

// ============================================================================
// Cache Metrics
// ============================================================================

/**
 * Cache operations counter
 * Tracks cache hits and misses
 */
export const cacheOperations = new Counter({
	name: "tcad_scraper_cache_operations_total",
	help: "Total number of cache operations",
	labelNames: ["operation", "status"], // operation: get/set/del, status: hit/miss/success/error
	registers: [register],
});

/**
 * Cache hit rate gauge
 * Tracks current cache hit rate percentage
 */
export const cacheHitRate = new Gauge({
	name: "tcad_scraper_cache_hit_rate",
	help: "Cache hit rate percentage",
	registers: [register],
});

/**
 * Cache size gauge
 * Tracks current number of items in cache
 */
export const cacheSize = new Gauge({
	name: "tcad_scraper_cache_size",
	help: "Current number of items in cache",
	registers: [register],
});

// ============================================================================
// External Service Metrics
// ============================================================================

/**
 * TCAD API requests counter
 * Tracks requests to TCAD website
 */
export const tcadRequestsTotal = new Counter({
	name: "tcad_scraper_tcad_requests_total",
	help: "Total number of requests to TCAD website",
	labelNames: ["endpoint", "status"],
	registers: [register],
});

/**
 * Claude AI API requests counter
 * Tracks requests to Claude AI API
 */
export const claudeRequestsTotal = new Counter({
	name: "tcad_scraper_claude_requests_total",
	help: "Total number of requests to Claude AI API",
	labelNames: ["status"],
	registers: [register],
});

/**
 * Claude AI API duration histogram
 * Tracks Claude AI response times
 */
export const claudeRequestDuration = new Histogram({
	name: "tcad_scraper_claude_request_duration_seconds",
	help: "Claude AI request duration in seconds",
	labelNames: ["status"],
	buckets: [0.5, 1, 2, 3, 5, 10, 15, 20, 30],
	registers: [register],
});

// ============================================================================
// Token Refresh Metrics
// ============================================================================

/**
 * Token refresh counter
 * Tracks TCAD token refresh operations
 */
export const tokenRefreshTotal = new Counter({
	name: "tcad_scraper_token_refresh_total",
	help: "Total number of token refresh operations",
	labelNames: ["status"], // success, failure
	registers: [register],
});

/**
 * Token age gauge
 * Tracks time since last successful token refresh
 */
export const tokenAge = new Gauge({
	name: "tcad_scraper_token_age_seconds",
	help: "Time since last successful token refresh in seconds",
	registers: [register],
});

// ============================================================================
// Error Metrics
// ============================================================================

/**
 * Application errors counter
 * Tracks all application errors by type
 */
export const errorsTotal = new Counter({
	name: "tcad_scraper_errors_total",
	help: "Total number of application errors",
	labelNames: ["type", "source"], // type: validation/scraper/database/etc, source: controller/service/etc
	registers: [register],
});

// ============================================================================
// Code Complexity Metrics
// ============================================================================

/**
 * Cyclomatic complexity gauge
 * Tracks average cyclomatic complexity across the codebase
 */
export const codeComplexityCyclomatic = new Gauge({
	name: "tcad_scraper_code_complexity_cyclomatic",
	help: "Average cyclomatic complexity of functions",
	registers: [register],
});

/**
 * Maximum cyclomatic complexity gauge
 * Tracks the highest cyclomatic complexity value in the codebase
 */
export const codeComplexityMaxCyclomatic = new Gauge({
	name: "tcad_scraper_code_complexity_max_cyclomatic",
	help: "Maximum cyclomatic complexity of any single function",
	registers: [register],
});

/**
 * Total lines of code gauge
 * Tracks total lines of code (including blank lines and comments)
 */
export const codeComplexityTotalLines = new Gauge({
	name: "tcad_scraper_code_complexity_total_lines",
	help: "Total lines of code in the codebase",
	registers: [register],
});

/**
 * Code lines gauge (excluding comments and blank lines)
 * Tracks actual code lines
 */
export const codeComplexityCodeLines = new Gauge({
	name: "tcad_scraper_code_complexity_code_lines",
	help: "Lines of actual code (excluding comments and blank lines)",
	registers: [register],
});

/**
 * Comment lines gauge
 * Tracks number of comment lines
 */
export const codeComplexityCommentLines = new Gauge({
	name: "tcad_scraper_code_complexity_comment_lines",
	help: "Lines of comments in the codebase",
	registers: [register],
});

/**
 * Total files gauge
 * Tracks number of source files
 */
export const codeComplexityTotalFiles = new Gauge({
	name: "tcad_scraper_code_complexity_total_files",
	help: "Total number of source files",
	registers: [register],
});

/**
 * Total functions gauge
 * Tracks number of functions/methods
 */
export const codeComplexityTotalFunctions = new Gauge({
	name: "tcad_scraper_code_complexity_total_functions",
	help: "Total number of functions and methods",
	registers: [register],
});

/**
 * Total classes gauge
 * Tracks number of classes
 */
export const codeComplexityTotalClasses = new Gauge({
	name: "tcad_scraper_code_complexity_total_classes",
	help: "Total number of classes",
	registers: [register],
});

/**
 * Maximum function lines gauge
 * Tracks the largest function by line count
 */
export const codeComplexityMaxFunctionLines = new Gauge({
	name: "tcad_scraper_code_complexity_max_function_lines",
	help: "Maximum number of lines in any single function",
	registers: [register],
});

/**
 * File lines gauge
 * Tracks lines per file (for identifying large files)
 */
export const codeComplexityFileLines = new Gauge({
	name: "tcad_scraper_code_complexity_file_lines",
	help: "Number of lines per file",
	labelNames: ["file"],
	registers: [register],
});

/**
 * Maintainability index gauge
 * Tracks code maintainability score (0-100, higher is better)
 */
export const codeComplexityMaintainability = new Gauge({
	name: "tcad_scraper_code_complexity_maintainability_index",
	help: "Code maintainability index (0-100, higher is better)",
	registers: [register],
});

/**
 * Technical debt ratio gauge
 * Tracks ratio of technical debt (time to fix vs time to build from scratch)
 */
export const codeComplexityTechnicalDebtRatio = new Gauge({
	name: "tcad_scraper_code_complexity_technical_debt_ratio",
	help: "Technical debt ratio as percentage",
	registers: [register],
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
	return register.metrics();
}

/**
 * Get metric registry
 */
export function getRegistry(): Registry {
	return register;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
	register.resetMetrics();
}

/**
 * Update queue metrics
 * Call this periodically to update queue size gauges
 */
export async function updateQueueMetrics(
	waiting: number,
	active: number,
	completed: number,
	failed: number,
): Promise<void> {
	queueSize.set({ status: "waiting" }, waiting);
	queueSize.set({ status: "active" }, active);
	queueSize.set({ status: "completed" }, completed);
	queueSize.set({ status: "failed" }, failed);

	activeScrapeJobs.set(active);
}

/**
 * Update cache metrics
 * Call this periodically to update cache statistics
 */
export function updateCacheMetrics(
	hits: number,
	misses: number,
	size: number,
): void {
	const total = hits + misses;
	const hitRate = total > 0 ? (hits / total) * 100 : 0;

	cacheHitRate.set(hitRate);
	cacheSize.set(size);
}

/**
 * Record HTTP request
 */
export function recordHttpRequest(
	method: string,
	route: string,
	statusCode: number,
	durationSeconds: number,
): void {
	httpRequestsTotal.inc({ method, route, status_code: statusCode });
	httpRequestDuration.observe(
		{ method, route, status_code: statusCode },
		durationSeconds,
	);
}

/**
 * Record scrape job completion
 */
export function recordScrapeJob(
	status: "completed" | "failed",
	durationSeconds: number,
	propertiesCount?: number,
): void {
	scrapeJobsTotal.inc({ status });
	scrapeJobDuration.observe({ status }, durationSeconds);

	if (propertiesCount !== undefined && status === "completed") {
		propertiesScrapedTotal.inc({}, propertiesCount);
	}
}

/**
 * Record database query
 */
export function recordDbQuery(
	operation: string,
	table: string,
	status: "success" | "error",
	durationSeconds: number,
): void {
	dbQueriesTotal.inc({ operation, table, status });
	dbQueryDuration.observe({ operation, table }, durationSeconds);
}

/**
 * Record cache operation
 */
export function recordCacheOperation(
	operation: "get" | "set" | "del",
	status: "hit" | "miss" | "success" | "error",
): void {
	cacheOperations.inc({ operation, status });
}

/**
 * Record error
 */
export function recordError(type: string, source: string): void {
	errorsTotal.inc({ type, source });
}

/**
 * Update code complexity metrics
 * Call this periodically (e.g., hourly) to update codebase complexity metrics
 */
export interface CodeComplexityMetrics {
	avgCyclomatic: number;
	maxCyclomatic: number;
	totalLines: number;
	codeLines: number;
	commentLines: number;
	totalFiles: number;
	totalFunctions: number;
	totalClasses: number;
	maxFunctionLines: number;
	fileMetrics?: Array<{ file: string; lines: number }>;
	maintainabilityIndex?: number;
	technicalDebtRatio?: number;
}

export function updateCodeComplexityMetrics(
	metrics: CodeComplexityMetrics,
): void {
	codeComplexityCyclomatic.set(metrics.avgCyclomatic);
	codeComplexityMaxCyclomatic.set(metrics.maxCyclomatic);
	codeComplexityTotalLines.set(metrics.totalLines);
	codeComplexityCodeLines.set(metrics.codeLines);
	codeComplexityCommentLines.set(metrics.commentLines);
	codeComplexityTotalFiles.set(metrics.totalFiles);
	codeComplexityTotalFunctions.set(metrics.totalFunctions);
	codeComplexityTotalClasses.set(metrics.totalClasses);
	codeComplexityMaxFunctionLines.set(metrics.maxFunctionLines);

	// Update per-file metrics if provided
	if (metrics.fileMetrics) {
		// Reset file metrics
		codeComplexityFileLines.reset();
		// Set new values
		metrics.fileMetrics.forEach(({ file, lines }) => {
			codeComplexityFileLines.set({ file }, lines);
		});
	}

	// Update optional metrics if provided
	if (metrics.maintainabilityIndex !== undefined) {
		codeComplexityMaintainability.set(metrics.maintainabilityIndex);
	}

	if (metrics.technicalDebtRatio !== undefined) {
		codeComplexityTechnicalDebtRatio.set(metrics.technicalDebtRatio);
	}
}

logger.info("Prometheus metrics service initialized");

export default {
	getMetrics,
	getRegistry,
	resetMetrics,
	updateQueueMetrics,
	updateCacheMetrics,
	recordHttpRequest,
	recordScrapeJob,
	recordDbQuery,
	recordCacheOperation,
	recordError,
	updateCodeComplexityMetrics,
	// Export all metrics for direct access if needed
	httpRequestsTotal,
	httpRequestDuration,
	scrapeJobsTotal,
	scrapeJobDuration,
	propertiesScrapedTotal,
	activeScrapeJobs,
	queueSize,
	queueProcessingRate,
	dbQueryDuration,
	dbConnectionsActive,
	dbQueriesTotal,
	cacheOperations,
	cacheHitRate,
	cacheSize,
	tcadRequestsTotal,
	claudeRequestsTotal,
	claudeRequestDuration,
	tokenRefreshTotal,
	tokenAge,
	errorsTotal,
	codeComplexityCyclomatic,
	codeComplexityMaxCyclomatic,
	codeComplexityTotalLines,
	codeComplexityCodeLines,
	codeComplexityCommentLines,
	codeComplexityTotalFiles,
	codeComplexityTotalFunctions,
	codeComplexityTotalClasses,
	codeComplexityMaxFunctionLines,
	codeComplexityFileLines,
	codeComplexityMaintainability,
	codeComplexityTechnicalDebtRatio,
};
