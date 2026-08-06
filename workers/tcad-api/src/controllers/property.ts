/**
 * Property controller — ported from server/src/controllers/property.controller.ts
 * Key changes: Express req/res → Hono context, per-request Prisma, no Bull queue (Phase 2).
 */

import type { Prisma } from "@prisma/client";
import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { apiKeyAuth, validateBody, validateQuery } from "../middleware/auth";
import type {
	AnswerStatistics,
	AnswerType,
	PropertyFilters,
} from "../types/property.types";
import {
	historyQuerySchema,
	monitorRequestSchema,
	naturalLanguageSearchSchema,
	propertyFilterSchema,
	scrapeRequestSchema,
} from "../types/property.types";
import { DEFAULT_QUERY_LIMIT } from "../utils/constants";
import { epochToISO, nowEpoch } from "../utils/epoch-dates";
import { transformPropertyToSnakeCase } from "../utils/property-transformers";

// TODO: Update to 2026 when TCAD publishes 2026 appraised values
const DISPLAY_YEAR = 2025;

const app = new Hono<AppEnv>();

// POST /scrape — queue a scrape job (Phase 2: uses Workflows; stub for now)
app.post(
	"/scrape",
	apiKeyAuth,
	validateBody(scrapeRequestSchema),
	async (c) => {
		const { searchTerm } = c.get("validatedBody") as { searchTerm: string };
		const year = parseInt(c.env.TCAD_YEAR, 10) || 2025;

		await c.env.SCRAPER_QUEUE.send({ searchTerm, year });

		return c.json(
			{ message: "Scrape job queued successfully", searchTerm },
			202,
		);
	},
);

// GET /jobs/:jobId — get job status (Phase 2: query ScrapeJob table)
app.get("/jobs/:jobId", async (c) => {
	const prisma = c.get("prisma");
	const jobId = c.req.param("jobId");

	const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
	if (!job) {
		return c.json({ error: "Job not found" }, 404);
	}

	return c.json({
		id: job.id,
		status: job.status,
		progress: job.status === "completed" ? 100 : 0,
		resultCount: job.resultCount,
		error: job.error,
		createdAt: epochToISO(job.startedAt),
		completedAt: job.completedAt ? epochToISO(job.completedAt) : null,
	});
});

// GET / — list properties with filters (cached in Phase 3)
app.get("/", validateQuery(propertyFilterSchema), async (c) => {
	const prisma = c.get("prisma");
	const filters = c.get("validatedQuery") as PropertyFilters;
	const where = buildWhereClause(filters);

	const [properties, total] = await Promise.all([
		prisma.property.findMany({
			where,
			skip: filters.offset,
			take: filters.limit,
			orderBy: { scrapedAt: "desc" },
		}),
		prisma.property.count({ where }),
	]);

	return c.json({
		data: properties.map(transformPropertyToSnakeCase),
		pagination: {
			total,
			limit: filters.limit,
			offset: filters.offset,
			hasMore: filters.offset + filters.limit < total,
		},
	});
});

// POST /search — natural language search (Claude AI)
app.post("/search", validateBody(naturalLanguageSearchSchema), async (c) => {
	const prisma = c.get("prisma");
	const {
		query,
		limit = DEFAULT_QUERY_LIMIT,
		offset = 0,
	} = c.get("validatedBody") as {
		query: string;
		limit?: number;
		offset?: number;
	};

	// Import claude service dynamically to keep this file focused
	const { parseNaturalLanguageQuery, sanitizeWhereClause } = await import(
		"../lib/claude.service"
	);

	let whereClause: Prisma.PropertyWhereInput;
	let orderBy: Prisma.PropertyOrderByWithRelationInput | undefined;
	let explanation: string | undefined;
	let answer: string | undefined;
	let answerType: string | undefined;

	try {
		const parsed = await parseNaturalLanguageQuery(
			query,
			c.env.ANTHROPIC_API_KEY,
			c.env.OPENAI_API_KEY,
		);
		whereClause = sanitizeWhereClause(
			parsed.whereClause,
		) as Prisma.PropertyWhereInput;
		orderBy = parsed.orderBy;
		explanation = parsed.explanation;
		answer = parsed.answer;
		answerType = parsed.answerType;
	} catch {
		return c.json(
			{
				error: "AI service unavailable",
				message: "Unable to process natural language query.",
			},
			503,
		);
	}

	const yearFilteredClause = { ...whereClause, year: DISPLAY_YEAR };

	try {
		const [properties, total] = await Promise.all([
			prisma.property.findMany({
				where: yearFilteredClause,
				orderBy: orderBy || { scrapedAt: "desc" },
				skip: offset,
				take: Math.min(limit, 1000),
			}),
			prisma.property.count({ where: yearFilteredClause }),
		]);

		let statistics: AnswerStatistics | undefined;
		let formattedAnswer: string | undefined;

		if (answer) {
			const [aggregates, cityStats, typeStats] = await Promise.all([
				prisma.property.aggregate({
					where: yearFilteredClause,
					_avg: { appraisedValue: true },
					_sum: { appraisedValue: true },
					_min: { appraisedValue: true },
					_max: { appraisedValue: true },
				}),
				prisma.property.groupBy({
					by: ["city"],
					where: { ...yearFilteredClause, city: { not: null } },
					_count: true,
					orderBy: { _count: { city: "desc" } },
					take: 1,
				}),
				prisma.property.groupBy({
					by: ["propType"],
					where: yearFilteredClause,
					_count: true,
					orderBy: { _count: { propType: "desc" } },
					take: 5,
				}),
			]);

			statistics = {
				avgValue: aggregates._avg.appraisedValue ?? undefined,
				totalValue: aggregates._sum.appraisedValue ?? undefined,
				priceRange:
					aggregates._min.appraisedValue !== null &&
					aggregates._max.appraisedValue !== null
						? {
								min: aggregates._min.appraisedValue,
								max: aggregates._max.appraisedValue,
							}
						: undefined,
				topCity:
					cityStats.length > 0 && cityStats[0].city
						? { name: cityStats[0].city, count: cityStats[0]._count }
						: undefined,
				propertyTypes: typeStats.map((t) => ({
					type: t.propType,
					count: t._count,
				})),
			};

			formattedAnswer = answer
				.replace("{count}", total.toLocaleString())
				.replace(
					"{totalValue}",
					statistics.totalValue
						? new Intl.NumberFormat("en-US", {
								style: "currency",
								currency: "USD",
								maximumFractionDigits: 0,
							}).format(statistics.totalValue)
						: "$0",
				);
		}

		return c.json({
			data: properties.map(transformPropertyToSnakeCase),
			pagination: {
				total,
				limit: Math.min(limit, 1000),
				offset,
				hasMore: offset + properties.length < total,
			},
			query: {
				original: query,
				explanation,
				answer: formattedAnswer,
				answerType: answerType as AnswerType | undefined,
				statistics,
			},
		});
	} catch {
		return c.json({ error: "Database query failed" }, 503);
	}
});

// GET /search/test — test Claude AI connection
app.get("/search/test", async (c) => {
	const { parseNaturalLanguageQuery } = await import("../lib/claude.service");
	const testQuery = "properties in Austin";
	const result = await parseNaturalLanguageQuery(
		testQuery,
		c.env.ANTHROPIC_API_KEY,
		c.env.OPENAI_API_KEY,
	);
	return c.json({
		success: true,
		message: "Claude API connection successful",
		testQuery,
		result,
	});
});

// GET /history — scrape job history
app.get("/history", validateQuery(historyQuerySchema), async (c) => {
	const prisma = c.get("prisma");
	const { limit = 20, offset = 0 } = c.get("validatedQuery") as {
		limit?: number;
		offset?: number;
	};

	const [jobs, total] = await Promise.all([
		prisma.scrapeJob.findMany({
			orderBy: { startedAt: "desc" },
			skip: offset,
			take: limit,
		}),
		prisma.scrapeJob.count(),
	]);

	return c.json({
		data: jobs.map((job) => ({
			...job,
			startedAt: epochToISO(job.startedAt),
			completedAt: job.completedAt ? epochToISO(job.completedAt) : null,
		})),
		pagination: { total, limit, offset, hasMore: offset + limit < total },
	});
});

// GET /stats — property statistics
app.get("/stats", async (c) => {
	const prisma = c.get("prisma");
	const yearFilter = { year: DISPLAY_YEAR };

	const [totalProperties, totalJobs, recentJobs, cityStats, typeStats] =
		await Promise.all([
			prisma.property.count({ where: yearFilter }),
			prisma.scrapeJob.count(),
			prisma.scrapeJob.count({
				where: { startedAt: { gte: String(Date.now() - 24 * 60 * 60 * 1000) } },
			}),
			prisma.property.groupBy({
				by: ["city"],
				_count: true,
				where: { ...yearFilter, city: { not: null } },
				orderBy: { _count: { city: "desc" } },
				take: 10,
			}),
			prisma.property.groupBy({
				by: ["propType"],
				_count: true,
				where: yearFilter,
				_avg: { appraisedValue: true },
				orderBy: { _count: { propType: "desc" } },
			}),
		]);

	return c.json({
		totalProperties,
		totalJobs,
		recentJobs,
		cityDistribution: cityStats,
		propertyTypeDistribution: typeStats,
	});
});

// POST /monitor — add monitored search
app.post(
	"/monitor",
	apiKeyAuth,
	validateBody(monitorRequestSchema),
	async (c) => {
		const prisma = c.get("prisma");
		const { searchTerm, frequency = "daily" } = c.get("validatedBody") as {
			searchTerm: string;
			frequency?: string;
		};

		const now = nowEpoch();
		const monitoredSearch = await prisma.monitoredSearch.upsert({
			where: { searchTerm },
			update: { active: true, frequency, updatedAt: now },
			create: { searchTerm, frequency, createdAt: now, updatedAt: now },
		});

		return c.json({
			message: "Search term added to monitoring",
			data: monitoredSearch,
		});
	},
);

// GET /monitor — list monitored searches
app.get("/monitor", async (c) => {
	const prisma = c.get("prisma");
	const monitoredSearches = await prisma.monitoredSearch.findMany({
		where: { active: true },
		orderBy: { createdAt: "desc" },
	});
	return c.json({ data: monitoredSearches });
});

function buildWhereClause(filters: PropertyFilters): Prisma.PropertyWhereInput {
	const where: Prisma.PropertyWhereInput = { year: DISPLAY_YEAR };

	if (filters.searchTerm) {
		where.OR = [
			{ searchTerm: { contains: filters.searchTerm } },
			{ name: { contains: filters.searchTerm } },
			{ propertyAddress: { contains: filters.searchTerm } },
		];
	}

	if (filters.city) where.city = filters.city;
	if (filters.propType) where.propType = filters.propType;

	if (filters.minValue || filters.maxValue) {
		where.appraisedValue = {};
		if (filters.minValue) where.appraisedValue.gte = filters.minValue;
		if (filters.maxValue) where.appraisedValue.lte = filters.maxValue;
	}

	return where;
}

export { app as propertyRoutes };
