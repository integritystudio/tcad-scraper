import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { PropertyController } from "../property.controller";

// Mock dependencies with proper structure
vi.mock("../../queues/scraper.queue", () => ({
	scraperQueue: {
		add: vi.fn(),
		getJob: vi.fn(),
		clean: vi.fn(),
	},
	canScheduleJob: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
	prisma: {
		property: {
			findMany: vi.fn(),
			count: vi.fn(),
			groupBy: vi.fn(),
		},
		scrapeJob: {
			findMany: vi.fn(),
			count: vi.fn(),
			create: vi.fn(),
		},
		monitoredSearch: {
			upsert: vi.fn(),
			findMany: vi.fn(),
		},
	},
	prismaReadOnly: {
		property: {
			findMany: vi.fn(),
			count: vi.fn(),
			groupBy: vi.fn(),
		},
		scrapeJob: {
			findMany: vi.fn(),
			count: vi.fn(),
		},
		monitoredSearch: {
			findMany: vi.fn(),
		},
	},
}));

vi.mock("../../lib/claude.service", () => ({
	claudeSearchService: {
		parseNaturalLanguageQuery: vi.fn(),
	},
}));

vi.mock("../../lib/redis-cache.service", () => ({
	cacheService: {
		getOrSet: vi.fn(),
		get: vi.fn(),
		set: vi.fn(),
		invalidatePattern: vi.fn(),
	},
}));

describe("PropertyController", () => {
	let controller: PropertyController;
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let jsonMock: Mock;
	let statusMock: Mock;

	// Import mocked modules
	let scraperQueue: Record<string, ReturnType<typeof vi.fn>>;
	let canScheduleJob: ReturnType<typeof vi.fn>;
	let prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
	let prismaReadOnly: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
	let claudeSearchService: Record<string, ReturnType<typeof vi.fn>>;
	let cacheService: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(async () => {
		// Clear all mocks
		vi.clearAllMocks();

		// Set up response mocks
		jsonMock = vi.fn();
		statusMock = vi.fn().mockReturnValue({ json: jsonMock });

		mockReq = {
			body: {},
			params: {},
			query: {},
			headers: {},
		};

		mockRes = {
			status: statusMock,
			json: jsonMock,
		};

		// Import mocked modules
		const scraperQueueModule = await import("../../queues/scraper.queue");
		scraperQueue = scraperQueueModule.scraperQueue;
		canScheduleJob = scraperQueueModule.canScheduleJob;

		const prismaModule = await import("../../lib/prisma");
		prisma = prismaModule.prisma;
		prismaReadOnly = prismaModule.prismaReadOnly;

		const claudeModule = await import("../../lib/claude.service");
		claudeSearchService = claudeModule.claudeSearchService;

		const cacheModule = await import("../../lib/redis-cache.service");
		cacheService = cacheModule.cacheService;

		// Create controller instance
		controller = new PropertyController();
	});

	describe("scrapeProperties", () => {
		it("should queue a scrape job successfully", async () => {
			const searchTerm = "Smith";
			mockReq.body = { searchTerm };

			// Mock canScheduleJob to allow
			canScheduleJob.mockResolvedValue(true);

			// Mock queue add
			const mockJobId = "job-123";
			scraperQueue.add = vi.fn().mockResolvedValue({
				id: mockJobId,
			});

			await controller.scrapeProperties(
				mockReq as Request,
				mockRes as Response,
			);

			expect(canScheduleJob).toHaveBeenCalledWith(searchTerm);
			expect(scraperQueue.add).toHaveBeenCalledWith(
				"scrape-properties",
				{ searchTerm },
				{ delay: 0, attempts: 3 },
			);
			expect(statusMock).toHaveBeenCalledWith(202);
			expect(jsonMock).toHaveBeenCalledWith({
				jobId: mockJobId,
				message: "Scrape job queued successfully",
			});
		});

		it("should return 429 when rate limited", async () => {
			const searchTerm = "Smith";
			mockReq.body = { searchTerm };

			// Mock canScheduleJob to deny
			canScheduleJob.mockResolvedValue(false);

			await controller.scrapeProperties(
				mockReq as Request,
				mockRes as Response,
			);

			expect(canScheduleJob).toHaveBeenCalledWith(searchTerm);
			expect(scraperQueue.add).not.toHaveBeenCalled();
			expect(statusMock).toHaveBeenCalledWith(429);
			expect(jsonMock).toHaveBeenCalledWith({
				error:
					"Rate limit exceeded. Please wait before scraping the same search term again.",
			});
		});
	});

	describe("getJobStatus", () => {
		it("should return job status for completed job", async () => {
			const jobId = "job-123";
			mockReq.params = { jobId };

			const mockJob = {
				id: jobId,
				timestamp: Date.now(),
				finishedOn: Date.now() + 5000,
				getState: vi.fn().mockResolvedValue("completed"),
				progress: vi.fn().mockReturnValue(100),
				returnvalue: { count: 42 },
				failedReason: null,
			};

			scraperQueue.getJob = vi.fn().mockResolvedValue(mockJob);

			await controller.getJobStatus(mockReq as Request, mockRes as Response);

			expect(scraperQueue.getJob).toHaveBeenCalledWith(jobId);
			expect(jsonMock).toHaveBeenCalledWith({
				id: jobId,
				status: "completed",
				progress: 100,
				resultCount: 42,
				error: null,
				createdAt: expect.any(Date),
				completedAt: expect.any(Date),
			});
		});

		it("should return job status for failed job", async () => {
			const jobId = "job-456";
			mockReq.params = { jobId };

			const mockJob = {
				id: jobId,
				timestamp: Date.now(),
				finishedOn: null,
				getState: vi.fn().mockResolvedValue("failed"),
				progress: vi.fn().mockReturnValue(50),
				returnvalue: null,
				failedReason: "Network timeout",
			};

			scraperQueue.getJob = vi.fn().mockResolvedValue(mockJob);

			await controller.getJobStatus(mockReq as Request, mockRes as Response);

			expect(jsonMock).toHaveBeenCalledWith({
				id: jobId,
				status: "failed",
				progress: 50,
				resultCount: undefined,
				error: "Network timeout",
				createdAt: expect.any(Date),
				completedAt: null,
			});
		});

		it("should return 404 when job not found", async () => {
			const jobId = "nonexistent";
			mockReq.params = { jobId };

			scraperQueue.getJob = vi.fn().mockResolvedValue(null);

			await controller.getJobStatus(mockReq as Request, mockRes as Response);

			expect(statusMock).toHaveBeenCalledWith(404);
			expect(jsonMock).toHaveBeenCalledWith({ error: "Job not found" });
		});
	});

	describe("getProperties", () => {
		it("should return cached properties when available", async () => {
			const filters = { limit: 10, offset: 0 };
			mockReq.query = filters;

			const mockResult = {
				data: [
					{
						id: "1",
						propertyId: "PROP-1",
						name: "John Smith",
						propertyAddress: "123 Main St",
						appraisedValue: 500000,
					},
				],
				pagination: {
					total: 1,
					limit: 10,
					offset: 0,
					hasMore: false,
				},
			};

			// Mock cacheService to return cached data
			cacheService.getOrSet = vi.fn().mockResolvedValue(mockResult);

			await controller.getProperties(mockReq as Request, mockRes as Response);

			expect(cacheService.getOrSet).toHaveBeenCalled();
			expect(jsonMock).toHaveBeenCalledWith(mockResult);
		});

		it("should fetch from database on cache miss", async () => {
			const filters = { limit: 10, offset: 0 };
			mockReq.query = filters;

			const mockProperties = [
				{
					id: "1",
					propertyId: "PROP-1",
					name: "John Smith",
					propType: "R",
					city: "AUSTIN",
					propertyAddress: "123 Main St",
					assessedValue: 480000,
					appraisedValue: 500000,
					geoId: "GEO123",
					description: "Residential Property",
					searchTerm: "Smith",
					year: 2025,
					scrapedAt: new Date("2025-01-01T00:00:00.000Z"),
					createdAt: new Date("2025-01-01T00:00:00.000Z"),
					updatedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
			];

			// Mock cacheService to execute the callback (cache miss)
			cacheService.getOrSet.mockImplementation(
				async (_key: string, callback: () => Promise<unknown>) => {
					return await callback();
				},
			);

			// Mock Prisma queries
			prismaReadOnly.property.findMany.mockResolvedValue(mockProperties);
			prismaReadOnly.property.count.mockResolvedValue(1);

			await controller.getProperties(mockReq as Request, mockRes as Response);

			expect(prismaReadOnly.property.findMany).toHaveBeenCalledWith({
				where: {},
				skip: 0,
				take: 10,
				orderBy: { scrapedAt: "desc" },
			});
			expect(prismaReadOnly.property.count).toHaveBeenCalledWith({
				where: {},
			});
		});

		it("should apply filters correctly", async () => {
			const filters = {
				searchTerm: "Smith",
				city: "AUSTIN",
				propType: "R",
				minValue: 100000,
				maxValue: 500000,
				limit: 10,
				offset: 0,
			};
			mockReq.query = filters;

			cacheService.getOrSet.mockImplementation(
				async (_key: string, callback: () => Promise<unknown>) => {
					return await callback();
				},
			);

			prismaReadOnly.property.findMany.mockResolvedValue([]);
			prismaReadOnly.property.count.mockResolvedValue(0);

			await controller.getProperties(mockReq as Request, mockRes as Response);

			// Verify filters were applied
			const whereClause =
				prismaReadOnly.property.findMany.mock.calls[0][0].where;
			expect(whereClause.city).toBe("AUSTIN");
			expect(whereClause.propType).toBe("R");
			expect(whereClause.appraisedValue).toEqual({
				gte: 100000,
				lte: 500000,
			});
			expect(whereClause.OR).toBeDefined();
		});
	});

	describe("testClaudeConnection", () => {
		it("should test Claude API connection successfully", async () => {
			const mockResult = {
				whereClause: { city: "AUSTIN" },
				orderBy: { scrapedAt: "desc" },
				explanation: "Looking for properties in Austin",
			};

			claudeSearchService.parseNaturalLanguageQuery = vi
				.fn()
				.mockResolvedValue(mockResult);

			await controller.testClaudeConnection(
				mockReq as Request,
				mockRes as Response,
			);

			expect(
				claudeSearchService.parseNaturalLanguageQuery,
			).toHaveBeenCalledWith("properties in Austin");
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				message: "Claude API connection successful",
				testQuery: "properties in Austin",
				result: mockResult,
			});
		});
	});

	describe("naturalLanguageSearch", () => {
		it("should perform natural language search successfully", async () => {
			const query = "properties in Austin worth more than $500k";
			mockReq.body = { query, limit: 100, offset: 0 };

			const mockClaudeResponse = {
				whereClause: {
					city: "AUSTIN",
					appraisedValue: { gte: 500000 },
				},
				orderBy: { appraisedValue: "desc" },
				explanation: "Properties in Austin with value > $500k",
			};

			const mockProperties = [
				{
					id: "1",
					propertyId: "PROP-1",
					name: "Luxury Estate",
					propType: "R",
					city: "AUSTIN",
					propertyAddress: "100 Rich St",
					assessedValue: 720000,
					appraisedValue: 750000,
					geoId: "GEO456",
					description: "Luxury Residential Property",
					searchTerm: "properties in Austin worth more than $500k",
					year: 2025,
					scrapedAt: new Date("2025-01-01T00:00:00.000Z"),
					createdAt: new Date("2025-01-01T00:00:00.000Z"),
					updatedAt: new Date("2025-01-01T00:00:00.000Z"),
				},
			];

			claudeSearchService.parseNaturalLanguageQuery.mockResolvedValue(
				mockClaudeResponse,
			);

			prismaReadOnly.property.findMany.mockResolvedValue(mockProperties);
			prismaReadOnly.property.count.mockResolvedValue(1);

			await controller.naturalLanguageSearch(
				mockReq as Request,
				mockRes as Response,
			);

			expect(
				claudeSearchService.parseNaturalLanguageQuery,
			).toHaveBeenCalledWith(query);
			expect(prismaReadOnly.property.findMany).toHaveBeenCalledWith({
				where: mockClaudeResponse.whereClause,
				orderBy: mockClaudeResponse.orderBy,
				skip: 0,
				take: 100,
			});

			// Expect transformed snake_case data
			expect(jsonMock).toHaveBeenCalledWith({
				data: [
					{
						id: "1",
						property_id: "PROP-1",
						name: "Luxury Estate",
						prop_type: "R",
						city: "AUSTIN",
						property_address: "100 Rich St",
						assessed_value: 720000,
						appraised_value: 750000,
						geo_id: "GEO456",
						description: "Luxury Residential Property",
						search_term: "properties in Austin worth more than $500k",
						year: 2025,
						scraped_at: "2025-01-01T00:00:00.000Z",
						created_at: "2025-01-01T00:00:00.000Z",
						updated_at: "2025-01-01T00:00:00.000Z",
					},
				],
				pagination: {
					total: 1,
					limit: 100,
					offset: 0,
					hasMore: false,
				},
				query: {
					original: query,
					explanation: mockClaudeResponse.explanation,
				},
			});
		});

		it("should return 400 when query is missing", async () => {
			mockReq.body = {};

			await controller.naturalLanguageSearch(
				mockReq as Request,
				mockRes as Response,
			);

			expect(statusMock).toHaveBeenCalledWith(400);
			expect(jsonMock).toHaveBeenCalledWith({
				error: "Query is required and must be a string",
			});
		});

		it("should return 400 when query is not a string", async () => {
			mockReq.body = { query: 123 };

			await controller.naturalLanguageSearch(
				mockReq as Request,
				mockRes as Response,
			);

			expect(statusMock).toHaveBeenCalledWith(400);
			expect(jsonMock).toHaveBeenCalledWith({
				error: "Query is required and must be a string",
			});
		});
	});

	describe("getScrapeHistory", () => {
		it("should return scrape job history", async () => {
			mockReq.query = { limit: 20, offset: 0 };

			const mockJobs = [
				{
					id: "job-1",
					searchTerm: "Smith",
					status: "completed",
					resultCount: 42,
					startedAt: new Date(),
				},
			];

			prismaReadOnly.scrapeJob.findMany.mockResolvedValue(mockJobs);
			prismaReadOnly.scrapeJob.count.mockResolvedValue(1);

			await controller.getScrapeHistory(
				mockReq as Request,
				mockRes as Response,
			);

			expect(prismaReadOnly.scrapeJob.findMany).toHaveBeenCalledWith({
				orderBy: { startedAt: "desc" },
				skip: 0,
				take: 20,
			});
			expect(jsonMock).toHaveBeenCalledWith({
				data: mockJobs,
				pagination: {
					total: 1,
					limit: 20,
					offset: 0,
					hasMore: false,
				},
			});
		});
	});

	describe("getStats", () => {
		it("should return statistics with cache", async () => {
			const mockStats = {
				totalProperties: 1000,
				totalJobs: 50,
				recentJobs: 10,
				cityDistribution: [
					{ city: "AUSTIN", _count: 500 },
					{ city: "LAKEWAY", _count: 300 },
				],
				propertyTypeDistribution: [
					{ propType: "R", _count: 800, _avg: { appraisedValue: 400000 } },
					{ propType: "P", _count: 200, _avg: { appraisedValue: 150000 } },
				],
			};

			cacheService.getOrSet = vi.fn().mockResolvedValue(mockStats);

			await controller.getStats(mockReq as Request, mockRes as Response);

			expect(cacheService.getOrSet).toHaveBeenCalled();
			expect(jsonMock).toHaveBeenCalledWith(mockStats);
		});

		it("should fetch statistics from database on cache miss", async () => {
			cacheService.getOrSet.mockImplementation(
				async (_key: string, callback: () => Promise<unknown>) => {
					return await callback();
				},
			);

			prismaReadOnly.property.count.mockResolvedValue(1000);
			prismaReadOnly.property.groupBy
				.mockResolvedValueOnce([{ city: "AUSTIN", _count: 500 }]) // cityStats
				.mockResolvedValueOnce([
					{ propType: "R", _count: 800, _avg: { appraisedValue: 400000 } },
				]); // typeStats

			prismaReadOnly.scrapeJob.count
				.mockResolvedValueOnce(50) // totalJobs
				.mockResolvedValueOnce(10); // recentJobs

			await controller.getStats(mockReq as Request, mockRes as Response);

			expect(prismaReadOnly.property.count).toHaveBeenCalled();
			expect(prismaReadOnly.scrapeJob.count).toHaveBeenCalledTimes(2);
			expect(prismaReadOnly.property.groupBy).toHaveBeenCalledTimes(2);
		});
	});

	describe("addMonitoredSearch", () => {
		it("should add a new monitored search", async () => {
			const searchTerm = "Smith";
			const frequency = "daily";
			mockReq.body = { searchTerm, frequency };

			const mockMonitoredSearch = {
				id: "monitor-1",
				searchTerm,
				frequency,
				active: true,
				createdAt: new Date(),
			};

			prisma.monitoredSearch.upsert.mockResolvedValue(mockMonitoredSearch);

			await controller.addMonitoredSearch(
				mockReq as Request,
				mockRes as Response,
			);

			expect(prisma.monitoredSearch.upsert).toHaveBeenCalledWith({
				where: { searchTerm },
				update: { active: true, frequency },
				create: { searchTerm, frequency },
			});
			expect(jsonMock).toHaveBeenCalledWith({
				message: "Search term added to monitoring",
				data: mockMonitoredSearch,
			});
		});

		it("should return 400 when search term is missing", async () => {
			mockReq.body = {};

			await controller.addMonitoredSearch(
				mockReq as Request,
				mockRes as Response,
			);

			expect(statusMock).toHaveBeenCalledWith(400);
			expect(jsonMock).toHaveBeenCalledWith({
				error: "Search term is required",
			});
		});
	});

	describe("getMonitoredSearches", () => {
		it("should return active monitored searches", async () => {
			const mockMonitoredSearches = [
				{
					id: "monitor-1",
					searchTerm: "Smith",
					frequency: "daily",
					active: true,
					createdAt: new Date(),
				},
				{
					id: "monitor-2",
					searchTerm: "Johnson",
					frequency: "weekly",
					active: true,
					createdAt: new Date(),
				},
			];

			prismaReadOnly.monitoredSearch.findMany.mockResolvedValue(
				mockMonitoredSearches,
			);

			await controller.getMonitoredSearches(
				mockReq as Request,
				mockRes as Response,
			);

			expect(prismaReadOnly.monitoredSearch.findMany).toHaveBeenCalledWith({
				where: { active: true },
				orderBy: { createdAt: "desc" },
			});
			expect(jsonMock).toHaveBeenCalledWith({
				data: mockMonitoredSearches,
			});
		});
	});
});
