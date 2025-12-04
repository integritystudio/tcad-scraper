/**
 * Property Routes - Claude Search Tests
 */

import express from "express";
import request from "supertest";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	type Mock,
	test,
	vi,
} from "vitest";
import { claudeSearchService } from "../../lib/claude.service";

// Mock the Claude search service
vi.mock("../../lib/claude.service");

// Mock Redis cache service
vi.mock("../../lib/redis-cache.service", () => ({
	cacheService: {
		getOrSet: vi.fn((_key, fn) => fn()),
		get: vi.fn().mockResolvedValue(null),
		set: vi.fn().mockResolvedValue(undefined),
	},
}));

// Mock Queue
vi.mock("../../queues/scraper.queue", () => ({
	scraperQueue: {
		add: vi.fn().mockResolvedValue({ id: "123" }),
		getJob: vi.fn().mockResolvedValue(null),
	},
	canScheduleJob: vi.fn().mockResolvedValue(true),
}));

// Mock Prisma
vi.mock("../../lib/prisma", () => ({
	prisma: {
		property: {
			findMany: vi.fn().mockResolvedValue([]),
			count: vi.fn().mockResolvedValue(0),
		},
	},
	prismaReadOnly: {
		property: {
			findMany: vi.fn().mockResolvedValue([]),
			count: vi.fn().mockResolvedValue(0),
		},
	},
}));

import { errorHandler } from "../../middleware/error.middleware";
// Import after mocks
import { propertyRouter } from "../property.routes";

describe("Property Routes - Claude Search", () => {
	let app: express.Application;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use("/api/properties", propertyRouter);
		app.use(errorHandler);
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	describe("GET /api/properties/search/test", () => {
		test("should return success when Claude API is working", async () => {
			const mockResult = {
				whereClause: {
					city: { contains: "Austin", mode: "insensitive" },
				},
				explanation: "Searching for properties in Austin",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app).get("/api/properties/search/test");

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("success", true);
			expect(response.body).toHaveProperty(
				"message",
				"Claude API connection successful",
			);
			expect(response.body).toHaveProperty("testQuery", "properties in Austin");
			expect(response.body.result).toEqual(mockResult);
		});

		test("should return failure when Claude API fails", async () => {
			const mockError = new Error("API Error");
			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockRejectedValue(
				mockError,
			);

			const response = await request(app).get("/api/properties/search/test");

			expect(response.status).toBe(500);
			expect(response.body).toHaveProperty("error", "Internal server error");
			expect(response.body).toHaveProperty("message");
		});

		test("should handle authentication errors", async () => {
			const authError = new Error(
				"401 authentication_error: invalid x-api-key",
			);
			authError.name = "AuthenticationError";
			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockRejectedValue(
				authError,
			);

			const response = await request(app).get("/api/properties/search/test");

			expect(response.status).toBe(500);
			expect(response.body).toHaveProperty("error", "Internal server error");
			expect(response.body).toHaveProperty("message");
		});

		test("should handle model not found errors", async () => {
			const modelError = new Error(
				"404 not_found_error: model: claude-3-5-sonnet-20241022",
			);
			modelError.name = "NotFoundError";
			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockRejectedValue(
				modelError,
			);

			const response = await request(app).get("/api/properties/search/test");

			expect(response.status).toBe(500);
			expect(response.body).toHaveProperty("error", "Internal server error");
			expect(response.body).toHaveProperty("message");
		});
	});

	describe("POST /api/properties/search", () => {
		beforeEach(async () => {
			// Reset and configure Prisma mocks for each test
			const { prismaReadOnly } = await import("../../lib/prisma");
			prismaReadOnly.property.findMany.mockClear();
			prismaReadOnly.property.count.mockClear();

			prismaReadOnly.property.findMany.mockResolvedValue([
				{
					id: "1",
					propertyId: "PROP001",
					name: "John Doe",
					propType: "Residential",
					city: "Austin",
					propertyAddress: "123 Main St",
					assessedValue: 400000,
					appraisedValue: 500000,
					geoId: "GEO001",
					description: "Nice house",
					searchTerm: "Austin",
					scrapedAt: new Date(),
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]);
			prismaReadOnly.property.count.mockResolvedValue(1);
		});

		test("should return 400 when query is missing", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({});

			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty("error", "Invalid request data");
			expect(response.body.details).toBeDefined();
		});

		test("should return 400 when query is not a string", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: 123 });

			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty("error", "Invalid request data");
			expect(response.body.details).toBeDefined();
		});

		test("should successfully parse and execute natural language query", async () => {
			const mockResult = {
				whereClause: {
					city: { contains: "Austin", mode: "insensitive" },
				},
				orderBy: undefined,
				explanation: "Searching for properties in Austin",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "properties in Austin" });

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("data");
			expect(response.body).toHaveProperty("pagination");
			expect(response.body).toHaveProperty("query");
			expect(response.body.query.original).toBe("properties in Austin");
			expect(response.body.query.explanation).toBe(
				"Searching for properties in Austin",
			);
		});

		test("should handle complex queries with value filters", async () => {
			const mockResult = {
				whereClause: {
					city: "Austin",
					appraisedValue: { gte: 500000 },
				},
				orderBy: { appraisedValue: "desc" },
				explanation: "Searching for properties in Austin worth over $500,000",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "properties in Austin worth over 500k" });

			expect(response.status).toBe(200);
			expect(response.body.query.explanation).toBe(
				"Searching for properties in Austin worth over $500,000",
			);
		});

		test("should support pagination with limit parameter", async () => {
			const mockResult = {
				whereClause: { city: "Austin" },
				explanation: "Test",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app).post("/api/properties/search").send({
				query: "properties in Austin",
				limit: 50,
			});

			expect(response.status).toBe(200);
			expect(response.body.pagination.limit).toBe(50);
		});

		test("should support pagination with offset parameter", async () => {
			const mockResult = {
				whereClause: { city: "Austin" },
				explanation: "Test",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app).post("/api/properties/search").send({
				query: "properties in Austin",
				offset: 100,
			});

			expect(response.status).toBe(200);
			expect(response.body.pagination.offset).toBe(100);
		});

		test("should limit maximum results to 1000", async () => {
			// The validation middleware enforces max limit of 1000, so this test should expect 400
			const response = await request(app).post("/api/properties/search").send({
				query: "properties in Austin",
				limit: 5000, // Try to request more than max
			});

			expect(response.status).toBe(400);
			expect(response.body).toHaveProperty("error", "Invalid request data");
		});

		test("should use default limit of 100 when not specified", async () => {
			const mockResult = {
				whereClause: { city: "Austin" },
				explanation: "Test",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "properties in Austin" });

			expect(response.status).toBe(200);
			expect(response.body.pagination.limit).toBe(100);
		});

		test("should calculate hasMore correctly", async () => {
			const mockResult = {
				whereClause: { city: "Austin" },
				explanation: "Test",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const { prismaReadOnly } = await import("../../lib/prisma");
			prismaReadOnly.property.count.mockResolvedValue(250);

			const response = await request(app).post("/api/properties/search").send({
				query: "properties in Austin",
				limit: 100,
				offset: 0,
			});

			expect(response.status).toBe(200);
			expect(response.body.pagination.hasMore).toBe(true);
		});

		test("should handle errors gracefully", async () => {
			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockRejectedValue(
				new Error("Unexpected error"),
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "test query" });

			expect(response.status).toBe(500);
			expect(response.body).toHaveProperty("error", "Internal server error");
			expect(response.body).toHaveProperty("message");
		});

		test("should work with fallback when Claude fails", async () => {
			// Mock Claude to use fallback
			const fallbackResult = {
				whereClause: {
					OR: [
						{ name: { contains: "test", mode: "insensitive" } },
						{ propertyAddress: { contains: "test", mode: "insensitive" } },
						{ city: { contains: "test", mode: "insensitive" } },
						{ description: { contains: "test", mode: "insensitive" } },
					],
				},
				explanation:
					'Searching for "test" across property names, addresses, cities, and descriptions',
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				fallbackResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "test" });

			expect(response.status).toBe(200);
			expect(response.body.query.explanation).toContain('Searching for "test"');
		});
	});

	describe("Query Types", () => {
		beforeEach(async () => {
			const { prismaReadOnly } = await import("../../lib/prisma");
			prismaReadOnly.property.findMany.mockClear();
			prismaReadOnly.property.count.mockClear();
			prismaReadOnly.property.findMany.mockResolvedValue([]);
			prismaReadOnly.property.count.mockResolvedValue(0);
		});

		test("should handle city-based queries", async () => {
			const mockResult = {
				whereClause: { city: { contains: "Round Rock", mode: "insensitive" } },
				explanation: "Searching for properties in Round Rock",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "homes in Round Rock" });

			expect(response.status).toBe(200);
			expect(
				claudeSearchService.parseNaturalLanguageQuery,
			).toHaveBeenCalledWith("homes in Round Rock");
		});

		test("should handle owner name queries", async () => {
			const mockResult = {
				whereClause: { name: { contains: "Smith", mode: "insensitive" } },
				explanation: "Searching for properties owned by Smith",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "properties owned by Smith" });

			expect(response.status).toBe(200);
		});

		test("should handle property type queries", async () => {
			const mockResult = {
				whereClause: {
					propType: { contains: "Commercial", mode: "insensitive" },
				},
				explanation: "Searching for commercial properties",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "commercial properties" });

			expect(response.status).toBe(200);
		});

		test("should handle address-based queries", async () => {
			const mockResult = {
				whereClause: {
					propertyAddress: { contains: "Congress", mode: "insensitive" },
				},
				explanation: "Searching for properties with 'Congress' in the address",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "properties on Congress Ave" });

			expect(response.status).toBe(200);
		});

		test("should handle value range queries", async () => {
			const mockResult = {
				whereClause: {
					appraisedValue: { gte: 300000, lte: 600000 },
				},
				orderBy: { appraisedValue: "asc" },
				explanation:
					"Searching for properties with appraised value between $300,000 and $600,000",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "find properties appraised between 300k and 600k" });

			expect(response.status).toBe(200);
		});

		test("should handle combined complex queries", async () => {
			const mockResult = {
				whereClause: {
					city: "Austin",
					propType: { contains: "Residential", mode: "insensitive" },
					appraisedValue: { gte: 1000000 },
				},
				orderBy: { appraisedValue: "desc" },
				explanation:
					"Searching for residential properties in Austin worth over $1,000,000",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app).post("/api/properties/search").send({
				query: "residential properties in Austin worth over 1 million",
			});

			expect(response.status).toBe(200);
		});
	});

	describe("Edge Cases", () => {
		beforeEach(async () => {
			const { prismaReadOnly } = await import("../../lib/prisma");
			prismaReadOnly.property.findMany.mockClear();
			prismaReadOnly.property.count.mockClear();
			prismaReadOnly.property.findMany.mockResolvedValue([]);
			prismaReadOnly.property.count.mockResolvedValue(0);
		});

		test("should handle empty string query", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "" });

			expect(response.status).toBe(400);
		});

		test("should handle null query", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: null });

			expect(response.status).toBe(400);
		});

		test("should handle undefined query", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({});

			expect(response.status).toBe(400);
		});

		test("should handle very long queries", async () => {
			const longQuery = "properties ".repeat(100);
			const mockResult = {
				whereClause: { city: "Austin" },
				explanation: "Test",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: longQuery });

			expect(response.status).toBe(200);
		});

		test("should handle special characters", async () => {
			const mockResult = {
				whereClause: {
					propertyAddress: { contains: "O'Connor", mode: "insensitive" },
				},
				explanation: "Test",
			};

			(claudeSearchService.parseNaturalLanguageQuery as Mock).mockResolvedValue(
				mockResult,
			);

			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "properties on O'Connor St" });

			expect(response.status).toBe(200);
		});
	});
});
