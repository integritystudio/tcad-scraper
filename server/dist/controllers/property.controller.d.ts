import { Request, Response } from 'express';
import type { ScrapeRequestBody, PropertyFilters, NaturalLanguageSearchBody, HistoryQueryParams, MonitorRequestBody } from '../types/property.types';
export declare class PropertyController {
    /**
     * POST /api/properties/scrape - Trigger a new scrape job
     */
    scrapeProperties(req: Request<{}, {}, ScrapeRequestBody>, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /api/properties/jobs/:jobId - Get job status
     */
    getJobStatus(req: Request<{
        jobId: string;
    }>, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /api/properties - Get properties from database with filters
     * Cached for 5 minutes per unique filter combination
     */
    getProperties(req: Request<{}, {}, {}, PropertyFilters>, res: Response): Promise<void>;
    /**
     * GET /api/properties/search/test - Test Claude API connection
     */
    testClaudeConnection(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/properties/search - Natural language search powered by Claude
     */
    naturalLanguageSearch(req: Request<{}, {}, NaturalLanguageSearchBody>, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /api/properties/history - Get scrape job history
     */
    getScrapeHistory(req: Request<{}, {}, {}, HistoryQueryParams>, res: Response): Promise<void>;
    /**
     * GET /api/properties/stats - Get statistics
     * Cached for 10 minutes (expensive aggregation queries)
     */
    getStats(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/properties/monitor - Add a search term to monitor
     */
    addMonitoredSearch(req: Request<{}, {}, MonitorRequestBody>, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /api/properties/monitor - Get monitored search terms
     */
    getMonitoredSearches(req: Request, res: Response): Promise<void>;
    /**
     * Helper method to build Prisma where clause from filters
     */
    private buildWhereClause;
}
export declare const propertyController: PropertyController;
//# sourceMappingURL=property.controller.d.ts.map