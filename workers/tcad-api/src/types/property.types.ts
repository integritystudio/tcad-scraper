/**
 * Zod validation schemas and derived types for the Workers API.
 * Ported from server/src/types/property.types.ts with no functional changes.
 */

import { z } from "zod";
import { MAX_QUERY_LIMIT } from "../../../../utils/constants";
import { FTS_MAX_PAGE_SIZE } from "../utils/constants";

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
	limit: z.coerce
		.number()
		.min(1)
		.max(MAX_QUERY_LIMIT)
		.default(FTS_MAX_PAGE_SIZE),
	offset: z.coerce.number().min(0).default(0),
});

export const naturalLanguageSearchSchema = z.object({
	query: z.string().min(1).max(500),
	limit: z.number().min(1).max(MAX_QUERY_LIMIT).optional(),
	offset: z.number().min(0).optional(),
});

// GET-variant of naturalLanguageSearchSchema: query-string params arrive as
// strings, so the numeric bounds coerce.
export const naturalLanguageSearchQuerySchema = z.object({
	query: z.string().min(1).max(500),
	limit: z.coerce.number().min(1).max(MAX_QUERY_LIMIT).optional(),
	offset: z.coerce.number().min(0).optional(),
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
	// Full TCAD raw-field capture (migration 0003). Date fields
	// (inactiveDt, propCreateDt) are epoch-ms strings per the D1 convention.
	pVersion: z.number().nullable(),
	pRollCorr: z.number().nullable(),
	pAccountId: z.number().nullable(),
	latitude: z.number().nullable(),
	longitude: z.number().nullable(),
	asCode: z.string().nullable(),
	block: z.string().nullable(),
	tract: z.string().nullable(),
	lot: z.string().nullable(),
	mhSpaceNum: z.string().nullable(),
	condoUnit: z.string().nullable(),
	additionalLegal: z.string().nullable(),
	legalAcreage: z.number().nullable(),
	autoBuildLegal: z.number().nullable(),
	simpleGeo: z.string().nullable(),
	refId1: z.string().nullable(),
	refId2: z.string().nullable(),
	massCreatedFrom: z.number().nullable(),
	templateProperty: z.number().nullable(),
	templateDesc: z.string().nullable(),
	dba: z.string().nullable(),
	altDba: z.string().nullable(),
	mortgageCoId: z.string().nullable(),
	mortgageCoAcctId: z.string().nullable(),
	effectiveSizeAcres: z.number().nullable(),
	mapId: z.string().nullable(),
	mapsco: z.string().nullable(),
	propReference: z.number().nullable(),
	referenceDesc: z.string().nullable(),
	active: z.string().nullable(),
	inactive: z.number().nullable(),
	inactiveDt: z.string().nullable(),
	propCreateDt: z.string().nullable(),
	apprCompanyId: z.string().nullable(),
	marketArea: z.string().nullable(),
	useCd: z.string().nullable(),
	zoning: z.string().nullable(),
	sicCd: z.string().nullable(),
	landValue: z.number().nullable(),
	improvementValue: z.number().nullable(),
	landHomesitePct: z.number().nullable(),
	structureHomesitePct: z.number().nullable(),
	ownerId: z.number().nullable(),
	ownerPct: z.number().nullable(),
	ownerName: z.string().nullable(),
	nameSecondary: z.string().nullable(),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	spouseFirstName: z.string().nullable(),
	spouseLastName: z.string().nullable(),
	confidentialName: z.string().nullable(),
	addrDeliveryLine: z.string().nullable(),
	addrUnitDesignator: z.string().nullable(),
	addrCity: z.string().nullable(),
	addrZip: z.string().nullable(),
	addrState: z.string().nullable(),
	webSuppression: z.number().nullable(),
	primarySitus: z.number().nullable(),
	streetNum: z.string().nullable(),
	streetName: z.string().nullable(),
	fullSitus: z.string().nullable(),
	streetPrefix: z.string().nullable(),
	streetSuffix: z.string().nullable(),
	streetSecondary: z.string().nullable(),
	state: z.string().nullable(),
	zip: z.string().nullable(),
	country: z.string().nullable(),
	international: z.number().nullable(),
	valueReady: z.number().nullable(),
	taxOfficeRef: z.string().nullable(),
	confidential: z.number().nullable(),
	arbHearing: z.string().nullable(),
	relativeScore: z.number().nullable(),
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
