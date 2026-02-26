/**
 * API Integration Tests
 *
 * Tests for API endpoints to ensure proper functionality and error handling
 *
 * Note: These are integration tests that require a running database and Redis.
 * They are skipped by default in CI. Run with --testPathPattern=api.test to include them.
 */

import type { PrismaClient } from "@prisma/client";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isDatabaseAvailable, isRedisAvailable } from "./test-utils";

// Check infrastructure availability before running
let skipApiTests = true;
const checkInfrastructure = async () => {
	const [redisOk, dbOk] = await Promise.all([
		isRedisAvailable(3000),
		isDatabaseAvailable(5000),
	]);
	skipApiTests = !redisOk || !dbOk;
	return !skipApiTests;
};

describe.skipIf(!(await checkInfrastructure()))("API Integration Tests", () => {
	let app: Express;
	let prisma: PrismaClient;

	beforeAll(async () => {
		// Import dependencies
		const prismaModule = await import("../lib/prisma");
		prisma = prismaModule.prisma;

		// Import app after environment is set up
		const appModule = await import("../index");
		app = appModule.default;

		// Clean up test database
		await prisma.property.deleteMany({});
		await prisma.scrapeJob.deleteMany({});
		await prisma.monitoredSearch.deleteMany({});
	});

	afterAll(async () => {
		if (prisma) {
			await prisma.$disconnect();
		}
	});

	describe("Health Check Endpoints", () => {
		it("GET /health - should return healthy status", async () => {
			const response = await request(app).get("/health").expect(200);

			expect(response.body).toHaveProperty("status", "healthy");
			expect(response.body).toHaveProperty("timestamp");
			expect(response.body).toHaveProperty("uptime");
			expect(response.body).toHaveProperty("environment");
		});

		it("GET /health/queue - should return queue status", async () => {
			const response = await request(app).get("/health/queue").expect(200);

			expect(response.body).toHaveProperty("status");
			expect(response.body).toHaveProperty("queue");
			expect(response.body.queue).toHaveProperty("name");
			expect(response.body.queue).toHaveProperty("waiting");
			expect(response.body.queue).toHaveProperty("active");
			expect(response.body.queue).toHaveProperty("completed");
			expect(response.body.queue).toHaveProperty("failed");
		});

		it("GET /health/token - should return token refresh status", async () => {
			const response = await request(app).get("/health/token").expect(200);

			expect(response.body).toHaveProperty("status");
			expect(response.body).toHaveProperty("tokenRefresh");
		});

		it("GET /health/cache - should return cache status", async () => {
			const response = await request(app).get("/health/cache").expect(200);

			expect(response.body).toHaveProperty("status");
			expect(response.body).toHaveProperty("cache");
			expect(response.body.cache).toHaveProperty("connected");
		});

		it("GET /health/sentry - should return sentry status", async () => {
			const response = await request(app).get("/health/sentry").expect(200);

			expect(response.body).toHaveProperty("status");
			expect(response.body).toHaveProperty("sentry");
		});
	});

	describe("Property Query Endpoints", () => {
		beforeAll(async () => {
			// Seed test data
			await prisma.property.createMany({
				data: [
					{
						propertyId: "TEST001",
						name: "Test Property 1",
						propType: "Residential",
						city: "Austin",
						propertyAddress: "123 Test St",
						appraisedValue: 300000,
						assessedValue: 280000,
						searchTerm: "test",
						scrapedAt: new Date(),
						year: 2026,
					},
					{
						propertyId: "TEST002",
						name: "Test Property 2",
						propType: "Commercial",
						city: "Round Rock",
						propertyAddress: "456 Test Ave",
						appraisedValue: 500000,
						assessedValue: 480000,
						searchTerm: "test",
						scrapedAt: new Date(),
						year: 2026,
					},
				],
			});
		});

		it("GET /api/properties - should return properties", async () => {
			const response = await request(app).get("/api/properties").expect(200);

			expect(response.body).toHaveProperty("data");
			expect(response.body).toHaveProperty("pagination");
			expect(Array.isArray(response.body.data)).toBe(true);
			expect(response.body.pagination).toHaveProperty("total");
			expect(response.body.pagination).toHaveProperty("limit");
			expect(response.body.pagination).toHaveProperty("offset");
			expect(response.body.pagination).toHaveProperty("hasMore");
		});

		it("GET /api/properties?city=Austin - should filter by city", async () => {
			const response = await request(app)
				.get("/api/properties?city=Austin")
				.expect(200);

			expect(response.body.data.length).toBeGreaterThan(0);
			expect(response.body.data[0].city).toBe("Austin");
		});

		it("GET /api/properties?minValue=400000 - should filter by min value", async () => {
			const response = await request(app)
				.get("/api/properties?minValue=400000")
				.expect(200);

			response.body.data.forEach((property: { appraised_value: number }) => {
				expect(property.appraised_value).toBeGreaterThanOrEqual(400000);
			});
		});

		it("GET /api/properties?limit=1 - should respect pagination", async () => {
			const response = await request(app)
				.get("/api/properties?limit=1")
				.expect(200);

			expect(response.body.data.length).toBeLessThanOrEqual(1);
			expect(response.body.pagination.limit).toBe(1);
		});

		it("GET /api/properties?limit=2000 - should not exceed max limit", async () => {
			const response = await request(app)
				.get("/api/properties?limit=2000")
				.expect(400);

			expect(response.body).toHaveProperty("error");
		});
	});

	describe("Scraping Endpoints", () => {
		it("POST /api/properties/scrape - should queue scrape job", async () => {
			const response = await request(app)
				.post("/api/properties/scrape")
				.send({ searchTerm: "TestOwner" })
				.expect(202);

			expect(response.body).toHaveProperty("jobId");
			expect(response.body).toHaveProperty("message");
			expect(response.body.message).toContain("queued");
		});

		it("POST /api/properties/scrape - should reject empty search term", async () => {
			const response = await request(app)
				.post("/api/properties/scrape")
				.send({ searchTerm: "" })
				.expect(400);

			expect(response.body).toHaveProperty("error");
		});

		it("POST /api/properties/scrape - should reject missing search term", async () => {
			const response = await request(app)
				.post("/api/properties/scrape")
				.send({})
				.expect(400);

			expect(response.body).toHaveProperty("error");
		});

		it("GET /api/properties/jobs/:jobId - should return job status", async () => {
			// First create a job
			const scrapeResponse = await request(app)
				.post("/api/properties/scrape")
				.send({ searchTerm: "TestStatus" })
				.expect(202);

			const jobId = scrapeResponse.body.jobId;

			// Then check its status
			const statusResponse = await request(app)
				.get(`/api/properties/jobs/${jobId}`)
				.expect(200);

			expect(statusResponse.body).toHaveProperty("id");
			expect(statusResponse.body).toHaveProperty("status");
			expect(statusResponse.body).toHaveProperty("progress");
		});

		it("GET /api/properties/jobs/invalid-id - should return 404", async () => {
			await request(app).get("/api/properties/jobs/99999999").expect(404);
		});

		it("GET /api/properties/history - should return scrape history", async () => {
			const response = await request(app)
				.get("/api/properties/history")
				.expect(200);

			expect(response.body).toHaveProperty("data");
			expect(response.body).toHaveProperty("pagination");
			expect(Array.isArray(response.body.data)).toBe(true);
		});
	});

	describe("Statistics Endpoints", () => {
		it("GET /api/properties/stats - should return statistics", async () => {
			const response = await request(app)
				.get("/api/properties/stats")
				.expect(200);

			expect(response.body).toHaveProperty("totalProperties");
			expect(response.body).toHaveProperty("totalJobs");
			expect(response.body).toHaveProperty("recentJobs");
			expect(response.body).toHaveProperty("cityDistribution");
			expect(response.body).toHaveProperty("propertyTypeDistribution");
			expect(Array.isArray(response.body.cityDistribution)).toBe(true);
			expect(Array.isArray(response.body.propertyTypeDistribution)).toBe(true);
		});
	});

	describe("Monitoring Endpoints", () => {
		it("POST /api/properties/monitor - should add monitored search", async () => {
			const response = await request(app)
				.post("/api/properties/monitor")
				.send({
					searchTerm: "MonitorTest",
					frequency: "daily",
				})
				.expect(200);

			expect(response.body).toHaveProperty("message");
			expect(response.body).toHaveProperty("data");
			expect(response.body.data.searchTerm).toBe("MonitorTest");
			expect(response.body.data.frequency).toBe("daily");
		});

		it("POST /api/properties/monitor - should reject invalid frequency", async () => {
			const response = await request(app)
				.post("/api/properties/monitor")
				.send({
					searchTerm: "InvalidFreq",
					frequency: "invalid",
				})
				.expect(400);

			expect(response.body).toHaveProperty("error");
		});

		it("GET /api/properties/monitor - should return monitored searches", async () => {
			const response = await request(app)
				.get("/api/properties/monitor")
				.expect(200);

			expect(response.body).toHaveProperty("data");
			expect(Array.isArray(response.body.data)).toBe(true);
		});
	});

	describe("Search Endpoints", () => {
		it("GET /api/properties/search/test - should test Claude connection", async () => {
			const response = await request(app)
				.get("/api/properties/search/test")
				.expect(200);

			expect(response.body).toHaveProperty("success");
			expect(response.body).toHaveProperty("message");
			expect(response.body).toHaveProperty("testQuery");
			expect(response.body).toHaveProperty("result");
		});

		it("POST /api/properties/search - should handle natural language search", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({
					query: "properties in Austin",
					limit: 10,
				})
				.expect(200);

			expect(response.body).toHaveProperty("data");
			expect(response.body).toHaveProperty("pagination");
			expect(response.body).toHaveProperty("query");
			expect(response.body.query).toHaveProperty("original");
			expect(response.body.query).toHaveProperty("explanation");
		});

		it("POST /api/properties/search - should reject empty query", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({
					query: "",
				})
				.expect(400);

			expect(response.body).toHaveProperty("error");
		});
	});

	describe("Error Handling", () => {
		it("GET /nonexistent-route - should return 404", async () => {
			const response = await request(app).get("/nonexistent-route").expect(404);

			expect(response.body).toHaveProperty("error");
		});

		it("POST /api/properties/scrape - should handle rate limiting", async () => {
			const searchTerm = "RateLimitTest";

			// Make multiple rapid requests
			const requests = Array(10)
				.fill(null)
				.map(() =>
					request(app).post("/api/properties/scrape").send({ searchTerm }),
				);

			const responses = await Promise.all(requests);

			// At least one should be rate limited
			const rateLimited = responses.some((r) => r.status === 429);
			expect(rateLimited).toBe(true);
		});
	});

	describe("Security Headers", () => {
		it("should include security headers", async () => {
			const response = await request(app).get("/health").expect(200);

			// Check for common security headers set by Helmet
			expect(response.headers).toHaveProperty("x-content-type-options");
			expect(response.headers["x-content-type-options"]).toBe("nosniff");
		});
	});

	describe("CORS", () => {
		it("should handle CORS preflight requests", async () => {
			const response = await request(app)
				.options("/api/properties")
				.set("Origin", "http://localhost:5173")
				.set("Access-Control-Request-Method", "GET")
				.expect(204);

			expect(response.headers).toHaveProperty("access-control-allow-origin");
		});
	});
});
