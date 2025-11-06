import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

export const scrapeRequestSchema = z.object({
  searchTerm: z.string().min(4, 'Search term must be at least 4 characters').max(100),
  userId: z.string().optional(),
});

export const propertyFilterSchema = z.object({
  searchTerm: z.string().optional(),
  city: z.string().optional(),
  propType: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
});

export const naturalLanguageSearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const monitorRequestSchema = z.object({
  searchTerm: z.string().min(1),
  frequency: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
});

// ============================================================================
// TypeScript Types (Inferred from Zod Schemas)
// ============================================================================

export type ScrapeRequestBody = z.infer<typeof scrapeRequestSchema>;
export type PropertyFilters = z.infer<typeof propertyFilterSchema>;
export type NaturalLanguageSearchBody = z.infer<typeof naturalLanguageSearchSchema>;
export type HistoryQueryParams = z.infer<typeof historyQuerySchema>;
export type MonitorRequestBody = z.infer<typeof monitorRequestSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface JobStatusResponse {
  id: string;
  status: string;
  progress: number;
  resultCount?: number;
  error?: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface StatsResponse {
  totalProperties: number;
  totalJobs: number;
  recentJobs: number;
  cityDistribution: Array<{
    city: string;
    _count: number;
  }>;
  propertyTypeDistribution: Array<{
    propType: string;
    _count: number;
    _avg: {
      appraisedValue: number | null;
    };
  }>;
}
