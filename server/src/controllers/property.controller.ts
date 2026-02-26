import type { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { claudeSearchService } from "../lib/claude.service";
import { prisma, prismaReadOnly } from "../lib/prisma";
import { cacheService } from "../lib/redis-cache.service";
import { canScheduleJob, scraperQueue } from "../queues/scraper.queue";
import type { ScrapeResponse } from "../types";
import type {
	AnswerStatistics,
	AnswerType,
	HistoryQueryParams,
	MonitorRequestBody,
	NaturalLanguageSearchBody,
	PropertyFilters,
	ScrapeRequestBody,
} from "../types/property.types";
import { transformPropertyToSnakeCase } from "../utils/property-transformers";

export class PropertyController {
	/**
	 * POST /api/properties/scrape - Trigger a new scrape job
	 */
	async scrapeProperties(
		req: Request<object, object, ScrapeRequestBody>,
		res: Response,
	) {
		const validatedData = req.body;

		// Check rate limiting
		const canSchedule = await canScheduleJob(validatedData.searchTerm);
		if (!canSchedule) {
			return res.status(429).json({
				error:
					"Rate limit exceeded. Please wait before scraping the same search term again.",
			});
		}

		// Add job to queue
		const job = await scraperQueue.add("scrape-properties", validatedData, {
			delay: 0,
			attempts: 3,
		});

		const response: ScrapeResponse = {
			jobId: job.id.toString(),
			message: "Scrape job queued successfully",
		};

		return res.status(202).json(response);
	}

	/**
	 * GET /api/properties/jobs/:jobId - Get job status
	 */
	async getJobStatus(
		req: Request<{ jobId: string }>,
		res: Response,
		_next: NextFunction,
	) {
		const { jobId } = req.params;

		const job = await scraperQueue.getJob(jobId);
		if (!job) {
			return res.status(404).json({ error: "Job not found" });
		}

		const state = await job.getState();
		const progress = job.progress();

		let result = null;
		if (state === "completed") {
			result = job.returnvalue;
		}

		let error = null;
		if (state === "failed") {
			error = job.failedReason;
		}

		return res.json({
			id: jobId,
			status: state,
			progress: typeof progress === "number" ? progress : 0,
			resultCount: result?.count,
			error,
			createdAt: new Date(job.timestamp),
			completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
		});
	}

	/**
	 * GET /api/properties - Get properties from database with filters
	 * Cached for 5 minutes per unique filter combination
	 */
	async getProperties(
		req: Request<object, object, object, PropertyFilters>,
		res: Response,
		_next: NextFunction,
	) {
		const filters = req.query as PropertyFilters;

		// Generate cache key based on filters
		const cacheKey = `properties:list:${JSON.stringify(filters)}`;

		// Try to get from cache first (cache-aside pattern)
		const result = await cacheService.getOrSet(
			cacheKey,
			async () => {
				const where = buildWhereClause(filters);

				const [properties, total] = await Promise.all([
					prismaReadOnly.property.findMany({
						where,
						skip: filters.offset,
						take: filters.limit,
						orderBy: { scrapedAt: "desc" },
					}),
					prismaReadOnly.property.count({ where }),
				]);

				return {
					data: properties.map(transformPropertyToSnakeCase),
					pagination: {
						total,
						limit: filters.limit,
						offset: filters.offset,
						hasMore: filters.offset + filters.limit < total,
					},
				};
			},
			300, // 5 minutes TTL
		);

		return res.json(result);
	}

	/**
	 * GET /api/properties/search/test - Test Claude API connection
	 */
	async testClaudeConnection(_req: Request, res: Response) {
		const testQuery = "properties in Austin";
		const result =
			await claudeSearchService.parseNaturalLanguageQuery(testQuery);

		return res.json({
			success: true,
			message: "Claude API connection successful",
			testQuery,
			result,
		});
	}

	/**
	 * POST /api/properties/search - Natural language search powered by Claude
	 */
	async naturalLanguageSearch(
		req: Request<object, object, NaturalLanguageSearchBody>,
		res: Response,
	) {
		const { query, limit = 100, offset = 0 } = req.body;

		if (!query || typeof query !== "string") {
			return res
				.status(400)
				.json({ error: "Query is required and must be a string" });
		}

		// Use Claude to parse the natural language query
		const { whereClause, orderBy, explanation, answer, answerType } =
			await claudeSearchService.parseNaturalLanguageQuery(query);

		// Query the database with the generated filters
		const [properties, total] = await Promise.all([
			prismaReadOnly.property.findMany({
				where: whereClause,
				orderBy: orderBy || { scrapedAt: "desc" },
				skip: offset,
				take: Math.min(limit, 1000),
			}),
			prismaReadOnly.property.count({ where: whereClause }),
		]);

		// Calculate statistics if an answer is requested
		let statistics: AnswerStatistics | undefined;
		let formattedAnswer: string | undefined;

		if (answer) {
			// Calculate aggregate statistics
			const [aggregates, cityStats, typeStats] = await Promise.all([
				prismaReadOnly.property.aggregate({
					where: whereClause,
					_avg: { appraisedValue: true },
					_sum: { appraisedValue: true },
					_min: { appraisedValue: true },
					_max: { appraisedValue: true },
				}),
				prismaReadOnly.property.groupBy({
					by: ["city"],
					where: { ...whereClause, city: { not: null } },
					_count: true,
					orderBy: { _count: { city: "desc" } },
					take: 1,
				}),
				prismaReadOnly.property.groupBy({
					by: ["propType"],
					where: whereClause,
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

			// Format the answer by replacing placeholders
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

		return res.json({
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
	}

	/**
	 * GET /api/properties/history - Get scrape job history
	 */
	async getScrapeHistory(
		req: Request<object, object, object, HistoryQueryParams>,
		res: Response,
		_next: NextFunction,
	) {
		const { limit = 20, offset = 0 } = req.query;

		const jobs = await prismaReadOnly.scrapeJob.findMany({
			orderBy: { startedAt: "desc" },
			skip: offset,
			take: limit,
		});

		const total = await prismaReadOnly.scrapeJob.count();

		return res.json({
			data: jobs,
			pagination: {
				total,
				limit,
				offset,
				hasMore: offset + limit < total,
			},
		});
	}

	/**
	 * GET /api/properties/stats - Get statistics
	 * Cached for 10 minutes (expensive aggregation queries)
	 */
	async getStats(_req: Request, res: Response) {
		const cacheKey = "properties:stats:all";

		// Cache stats for 10 minutes (600 seconds)
		const stats = await cacheService.getOrSet(
			cacheKey,
			async () => {
				const [totalProperties, totalJobs, recentJobs, cityStats, typeStats] =
					await Promise.all([
						prismaReadOnly.property.count(),
						prismaReadOnly.scrapeJob.count(),
						prismaReadOnly.scrapeJob.count({
							where: {
								startedAt: {
									gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
								},
							},
						}),
						prismaReadOnly.property.groupBy({
							by: ["city"],
							_count: true,
							where: {
								city: { not: null },
							},
							orderBy: {
								_count: {
									city: "desc",
								},
							},
							take: 10,
						}),
						prismaReadOnly.property.groupBy({
							by: ["propType"],
							_count: true,
							_avg: {
								appraisedValue: true,
							},
							orderBy: {
								_count: {
									propType: "desc",
								},
							},
						}),
					]);

				return {
					totalProperties,
					totalJobs,
					recentJobs,
					cityDistribution: cityStats,
					propertyTypeDistribution: typeStats,
				};
			},
			600, // 10 minutes TTL
		);

		return res.json(stats);
	}

	/**
	 * POST /api/properties/monitor - Add a search term to monitor
	 */
	async addMonitoredSearch(
		req: Request<object, object, MonitorRequestBody>,
		res: Response,
	) {
		const { searchTerm, frequency = "daily" } = req.body;

		if (!searchTerm) {
			return res.status(400).json({ error: "Search term is required" });
		}

		const monitoredSearch = await prisma.monitoredSearch.upsert({
			where: { searchTerm },
			update: { active: true, frequency },
			create: { searchTerm, frequency },
		});

		return res.json({
			message: "Search term added to monitoring",
			data: monitoredSearch,
		});
	}

	/**
	 * GET /api/properties/monitor - Get monitored search terms
	 */
	async getMonitoredSearches(_req: Request, res: Response) {
		const monitoredSearches = await prismaReadOnly.monitoredSearch.findMany({
			where: { active: true },
			orderBy: { createdAt: "desc" },
		});

		return res.json({ data: monitoredSearches });
	}

}

function buildWhereClause(
	filters: PropertyFilters,
): Prisma.PropertyWhereInput {
	const where: Prisma.PropertyWhereInput = {};

	if (filters.searchTerm) {
		where.OR = [
			{ searchTerm: { contains: filters.searchTerm, mode: "insensitive" } },
			{ name: { contains: filters.searchTerm, mode: "insensitive" } },
			{
				propertyAddress: {
					contains: filters.searchTerm,
					mode: "insensitive",
				},
			},
		];
	}

	if (filters.city) {
		where.city = filters.city;
	}

	if (filters.propType) {
		where.propType = filters.propType;
	}

	if (filters.minValue || filters.maxValue) {
		where.appraisedValue = {};
		if (filters.minValue) where.appraisedValue.gte = filters.minValue;
		if (filters.maxValue) where.appraisedValue.lte = filters.maxValue;
	}

	return where;
}

export const propertyController = new PropertyController();
