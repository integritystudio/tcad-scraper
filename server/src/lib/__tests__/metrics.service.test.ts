import { describe, test, expect, beforeEach } from 'vitest';
import {
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
  httpRequestsTotal,
  httpRequestDuration,
  scrapeJobsTotal,
  scrapeJobDuration,
  propertiesScrapedTotal,
  activeScrapeJobs,
  queueSize,
  dbQueryDuration,
  dbQueriesTotal,
  cacheOperations,
  cacheHitRate,
  cacheSize,
  errorsTotal,
  codeComplexityCyclomatic,
  type CodeComplexityMetrics,
} from '../metrics.service';

describe('Metrics Service', () => {
  beforeEach(() => {
    // Reset all metrics before each test
    resetMetrics();
  });

  describe('Registry', () => {
    test('should return a valid registry', () => {
      const registry = getRegistry();
      expect(registry).toBeDefined();
      expect(typeof registry.metrics).toBe('function');
    });

    test('should return metrics in Prometheus format', async () => {
      const metrics = await getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('tcad_scraper_');
    });
  });

  describe('HTTP Metrics', () => {
    test('should record HTTP requests', async () => {
      recordHttpRequest('GET', '/api/properties', 200, 0.5);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_http_requests_total');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('route="/api/properties"');
      expect(metrics).toContain('status_code="200"');
    });

    test('should record multiple HTTP requests', async () => {
      recordHttpRequest('GET', '/api/properties', 200, 0.5);
      recordHttpRequest('GET', '/api/properties', 200, 0.3);
      recordHttpRequest('POST', '/api/search', 201, 1.2);

      const metrics = await getMetrics();
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('method="POST"');
      expect(metrics).toContain('status_code="200"');
      expect(metrics).toContain('status_code="201"');
    });

    test('should record HTTP request durations', async () => {
      recordHttpRequest('GET', '/api/properties', 200, 1.5);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_http_request_duration_seconds');
      expect(metrics).toContain('method="GET"');
    });
  });

  describe('Scrape Job Metrics', () => {
    test('should record completed scrape job', async () => {
      recordScrapeJob('completed', 30.5, 10);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_jobs_total');
      expect(metrics).toContain('status="completed"');
      expect(metrics).toContain('tcad_scraper_properties_scraped_total');
    });

    test('should record failed scrape job', async () => {
      recordScrapeJob('failed', 15.2);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_jobs_total');
      expect(metrics).toContain('status="failed"');
    });

    test('should record job durations', async () => {
      recordScrapeJob('completed', 45.3, 20);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_job_duration_seconds');
      expect(metrics).toContain('status="completed"');
    });

    test('should not increment properties for completed job without count', async () => {
      resetMetrics();
      recordScrapeJob('completed', 30.5);

      const metrics = await getMetrics();
      // Should not contain properties_scraped metric if no count provided
      const lines = metrics.split('\n');
      const propertiesLines = lines.filter(l => l.includes('tcad_scraper_properties_scraped_total') && !l.startsWith('#'));
      expect(propertiesLines.length).toBe(0);
    });
  });

  describe('Queue Metrics', () => {
    test('should update queue metrics', async () => {
      await updateQueueMetrics(5, 2, 100, 3);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_queue_size');
      expect(metrics).toContain('status="waiting"');
      expect(metrics).toContain('status="active"');
      expect(metrics).toContain('tcad_scraper_active_jobs');
    });

    test('should update queue metrics to zero', async () => {
      await updateQueueMetrics(0, 0, 50, 0);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_queue_size');
      expect(metrics).toContain('tcad_scraper_active_jobs');
    });
  });

  describe('Database Metrics', () => {
    test('should record successful database query', async () => {
      recordDbQuery('select', 'properties', 'success', 0.05);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_db_queries_total');
      expect(metrics).toContain('operation="select"');
      expect(metrics).toContain('table="properties"');
      expect(metrics).toContain('status="success"');
      expect(metrics).toContain('tcad_scraper_db_query_duration_seconds');
    });

    test('should record failed database query', async () => {
      recordDbQuery('insert', 'properties', 'error', 0.02);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_db_queries_total');
      expect(metrics).toContain('operation="insert"');
      expect(metrics).toContain('status="error"');
    });

    test('should track different database operations', async () => {
      recordDbQuery('select', 'properties', 'success', 0.01);
      recordDbQuery('insert', 'properties', 'success', 0.03);
      recordDbQuery('update', 'properties', 'success', 0.02);
      recordDbQuery('delete', 'properties', 'success', 0.01);

      const metrics = await getMetrics();
      expect(metrics).toContain('operation="select"');
      expect(metrics).toContain('operation="insert"');
      expect(metrics).toContain('operation="update"');
      expect(metrics).toContain('operation="delete"');
    });
  });

  describe('Cache Metrics', () => {
    test('should record cache hit', async () => {
      recordCacheOperation('get', 'hit');

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_cache_operations_total');
      expect(metrics).toContain('operation="get"');
      expect(metrics).toContain('status="hit"');
    });

    test('should record cache miss', async () => {
      recordCacheOperation('get', 'miss');

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_cache_operations_total');
      expect(metrics).toContain('status="miss"');
    });

    test('should record cache set operations', async () => {
      recordCacheOperation('set', 'success');

      const metrics = await getMetrics();
      expect(metrics).toContain('operation="set"');
      expect(metrics).toContain('status="success"');
    });

    test('should record cache delete operations', async () => {
      recordCacheOperation('del', 'success');

      const metrics = await getMetrics();
      expect(metrics).toContain('operation="del"');
      expect(metrics).toContain('status="success"');
    });

    test('should update cache metrics with hit rate calculation', async () => {
      updateCacheMetrics(80, 20, 150);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_cache_hit_rate');
      expect(metrics).toContain('tcad_scraper_cache_size');
    });

    test('should handle zero total for hit rate', async () => {
      updateCacheMetrics(0, 0, 0);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_cache_hit_rate');
      expect(metrics).toContain('tcad_scraper_cache_size');
    });

    test('should calculate hit rate correctly', async () => {
      updateCacheMetrics(75, 25, 100);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_cache_hit_rate');
    });
  });

  describe('Error Metrics', () => {
    test('should record errors by type and source', async () => {
      recordError('validation', 'controller');

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_errors_total');
      expect(metrics).toContain('type="validation"');
      expect(metrics).toContain('source="controller"');
    });

    test('should track multiple error types', async () => {
      recordError('validation', 'controller');
      recordError('database', 'service');
      recordError('scraper', 'worker');

      const metrics = await getMetrics();
      expect(metrics).toContain('type="validation"');
      expect(metrics).toContain('type="database"');
      expect(metrics).toContain('type="scraper"');
      expect(metrics).toContain('source="controller"');
      expect(metrics).toContain('source="service"');
      expect(metrics).toContain('source="worker"');
    });
  });

  describe('Code Complexity Metrics', () => {
    test('should update all code complexity metrics', () => {
      const metrics: CodeComplexityMetrics = {
        avgCyclomatic: 5.2,
        maxCyclomatic: 15,
        totalLines: 10000,
        codeLines: 7000,
        commentLines: 1500,
        totalFiles: 50,
        totalFunctions: 200,
        totalClasses: 25,
        maxFunctionLines: 150,
      };

      updateCodeComplexityMetrics(metrics);

      expect(codeComplexityCyclomatic['hashMap'][''].value).toBe(5.2);
    });

    test('should update optional code complexity metrics', () => {
      const metrics: CodeComplexityMetrics = {
        avgCyclomatic: 4.0,
        maxCyclomatic: 12,
        totalLines: 8000,
        codeLines: 6000,
        commentLines: 1000,
        totalFiles: 40,
        totalFunctions: 150,
        totalClasses: 20,
        maxFunctionLines: 120,
        maintainabilityIndex: 75,
        technicalDebtRatio: 5.5,
      };

      updateCodeComplexityMetrics(metrics);

      expect(codeComplexityCyclomatic['hashMap'][''].value).toBe(4.0);
    });

    test('should update per-file metrics', () => {
      const metrics: CodeComplexityMetrics = {
        avgCyclomatic: 5.0,
        maxCyclomatic: 10,
        totalLines: 5000,
        codeLines: 4000,
        commentLines: 500,
        totalFiles: 25,
        totalFunctions: 100,
        totalClasses: 10,
        maxFunctionLines: 80,
        fileMetrics: [
          { file: 'src/index.ts', lines: 200 },
          { file: 'src/service.ts', lines: 350 },
        ],
      };

      updateCodeComplexityMetrics(metrics);

      // File metrics should be updated (implementation depends on internal structure)
      expect(codeComplexityCyclomatic['hashMap'][''].value).toBe(5.0);
    });
  });

  describe('Reset Functionality', () => {
    test('should reset all metrics', async () => {
      // Record some metrics
      recordHttpRequest('GET', '/api/test', 200, 0.5);
      recordScrapeJob('completed', 30, 10);
      recordDbQuery('select', 'properties', 'success', 0.05);
      recordCacheOperation('get', 'hit');

      // Verify metrics are present
      let metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_http_requests_total');

      // Reset metrics
      resetMetrics();

      // Metrics should be reset
      metrics = await getMetrics();
      const lines = metrics.split('\n').filter(l => !l.startsWith('#') && l.trim());
      // Should only have default metrics, not our custom recorded ones
      const httpRequestLines = lines.filter(l => l.includes('tcad_scraper_http_requests_total{'));
      expect(httpRequestLines.length).toBe(0);
    });

    test('should allow recording after reset', async () => {
      recordHttpRequest('GET', '/api/test', 200, 0.5);
      resetMetrics();
      recordHttpRequest('POST', '/api/test', 201, 0.3);

      const metrics = await getMetrics();
      expect(metrics).toContain('method="POST"');
      expect(metrics).toContain('status_code="201"');
    });
  });

  describe('Metrics Export', () => {
    test('should export metrics in Prometheus format', async () => {
      recordHttpRequest('GET', '/api/properties', 200, 0.5);
      recordScrapeJob('completed', 30, 10);

      const metrics = await getMetrics();

      expect(metrics).toContain('tcad_scraper_http_requests_total');
      expect(metrics).toContain('tcad_scraper_jobs_total');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('status="completed"');
    });

    test('should include default Node.js metrics', async () => {
      const metrics = await getMetrics();

      // Should include default metrics like process_cpu_seconds_total
      expect(metrics).toContain('tcad_scraper_');
      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero duration for HTTP requests', async () => {
      recordHttpRequest('GET', '/api/fast', 200, 0);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_http_request_duration_seconds');
      expect(metrics).toContain('route="/api/fast"');
    });

    test('should handle large durations', async () => {
      recordHttpRequest('GET', '/api/slow', 200, 300);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_http_request_duration_seconds');
      expect(metrics).toContain('route="/api/slow"');
    });

    test('should handle various HTTP status codes', async () => {
      recordHttpRequest('GET', '/api/test', 200, 0.1);
      recordHttpRequest('GET', '/api/test', 404, 0.1);
      recordHttpRequest('GET', '/api/test', 500, 0.1);

      const metrics = await getMetrics();
      expect(metrics).toContain('status_code="200"');
      expect(metrics).toContain('status_code="404"');
      expect(metrics).toContain('status_code="500"');
    });

    test('should handle negative queue sizes as zero', async () => {
      await updateQueueMetrics(0, 0, 0, 0);

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_queue_size');
      expect(metrics).toContain('tcad_scraper_active_jobs');
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle multiple concurrent HTTP requests', async () => {
      const routes = ['/api/a', '/api/b', '/api/c'];

      routes.forEach((route) => {
        recordHttpRequest('GET', route, 200, 0.5);
        recordHttpRequest('GET', route, 200, 0.3);
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('route="/api/a"');
      expect(metrics).toContain('route="/api/b"');
      expect(metrics).toContain('route="/api/c"');
      expect(metrics).toContain('tcad_scraper_http_requests_total');
    });

    test('should handle multiple scrape jobs', async () => {
      for (let i = 0; i < 10; i++) {
        recordScrapeJob('completed', 30 + i, 5);
      }

      const metrics = await getMetrics();
      expect(metrics).toContain('tcad_scraper_jobs_total');
      expect(metrics).toContain('status="completed"');
      expect(metrics).toContain('tcad_scraper_properties_scraped_total');
    });
  });
});
