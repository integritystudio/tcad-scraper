/**
 * Zod validation schemas and derived types for the Workers API.
 * Ported from server/src/types/property.types.ts with no functional changes.
 */

import { z } from "zod";
import { DEFAULT_QUERY_LIMIT } from "../../../../utils/constants";

const MIN_TERM_LENGTH = 4;

export const scrapeRequestSchema = z.object({
	searchTerm: z
		.string()
		.min(
			MIN_TERM_LENGTH,
			`Search term must be at least ${MIN_TERM_LENGTH} characters`,
		)
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

export type AnswerType = "count" | "statistical" | "descriptive";

export interface AnswerStatistics {
	avgValue?: number;
	totalValue?: number;
	priceRange?: { min: number; max: number };
	topCity?: { name: string; count: number };
	propertyTypes?: Array<{ type: string; count: number }>;
}

// Workflow type schemas
export const propertyDataSchema = z.object({
	propertyId: z.string(),
	name: z.string(),
	propType: z.string(),
	city: z.string().nullable(),
	propertyAddress: z.string(),
	assessedValue: z.number().nullable(),
	appraisedValue: z.number(),
	geoId: z.string().nullable(),
	description: z.string().nullable(),
});

// One page's fetch result — checkpointed independently so a slow/failed page
// doesn't discard already-fetched pages (see scraper.workflow.ts fetch-page
// step). totalApiResults is only meaningful on page 1's response.
export const fetchPageResultSchema = z.object({
	kvKey: z.string(),
	pageCount: z.number(),
	totalApiResults: z.number(),
});

export const fetchResultSchema = z.object({
	totalPages: z.number(),
	totalApiResults: z.number(),
});

export const dedupeResultSchema = z.object({
	kvKey: z.string(),
	count: z.number(),
});

export const upsertResultSchema = z.object({
	savedCount: z.number(),
	updatedCount: z.number(),
	newPropertyIds: z.array(z.string()),
	totalApiResults: z.number(),
});

export const scrapeParamsSchema = z.object({
	searchTerm: z.string().min(1),
	year: z.number(),
	jobId: z.string().optional(),
});

export type PropertyData = z.infer<typeof propertyDataSchema>;
export type FetchPageResult = z.infer<typeof fetchPageResultSchema>;
export type FetchResult = z.infer<typeof fetchResultSchema>;
export type DedupeResult = z.infer<typeof dedupeResultSchema>;
export type UpsertResult = z.infer<typeof upsertResultSchema>;
export type ScrapeParams = z.infer<typeof scrapeParamsSchema>;
