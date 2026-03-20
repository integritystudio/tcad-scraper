/**
 * Zod validation schemas and derived types for the Workers API.
 * Ported from server/src/types/property.types.ts with no functional changes.
 */

import { z } from "zod";
import { DEFAULT_QUERY_LIMIT } from "../utils/constants";

const MIN_TERM_LENGTH = 4;

export const scrapeRequestSchema = z.object({
  searchTerm: z
    .string()
    .min(MIN_TERM_LENGTH, `Search term must be at least ${MIN_TERM_LENGTH} characters`)
    .max(100),
  userId: z.string().optional(),
});

export const propertyFilterSchema = z.object({
  searchTerm: z.string().optional(),
  city: z.string().optional(),
  propType: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(1000).default(DEFAULT_QUERY_LIMIT),
  offset: z.coerce.number().min(0).default(0),
});

export const naturalLanguageSearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const monitorRequestSchema = z.object({
  searchTerm: z.string().min(1),
  frequency: z.enum(["hourly", "daily", "weekly"]).default("daily"),
});

export type ScrapeRequestBody = z.infer<typeof scrapeRequestSchema>;
export type PropertyFilters = z.infer<typeof propertyFilterSchema>;
export type NaturalLanguageSearchBody = z.infer<typeof naturalLanguageSearchSchema>;
export type HistoryQueryParams = z.infer<typeof historyQuerySchema>;
export type MonitorRequestBody = z.infer<typeof monitorRequestSchema>;

export type AnswerType = "count" | "statistical" | "descriptive";

export interface AnswerStatistics {
  avgValue?: number;
  totalValue?: number;
  priceRange?: { min: number; max: number };
  topCity?: { name: string; count: number };
  propertyTypes?: Array<{ type: string; count: number }>;
}
