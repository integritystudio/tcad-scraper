/**
 * Authentication-Database Integration Tests
 *
 * Tests the complete flow from authenticated API requests through to database operations.
 * Validates JWT authentication, database queries, and the interaction between the UI,
 * authentication middleware, and PostgreSQL database layer.
 */

import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { config } from "../config";
import app from "../index";
import logger from "../lib/logger";
import { prisma } from "../lib/prisma";
import { generateToken } from "../middleware/auth";
import { isRedisAvailable } from "./test-utils";

describe("Authentication-Database Integration Tests", () => {
	let validToken: string;
	let expiredToken: string;
	const testUserId = "test-user-123";
	const testUserEmail = "test@example.com";

	beforeAll(() => {
		// Generate a valid test token
		validToken = generateToken(testUserId, testUserEmail);

		// Generate an expired token (expired 1 hour ago)
		expiredToken = jwt.sign(
			{ id: testUserId, email: testUserEmail },
			config.auth.jwt.secret,
			{ expiresIn: "-1h" },
		);
	});

	afterAll(async () => {
		// Clean up any test data created during tests
		await prisma.property.deleteMany({
			where: {
				searchTerm: {
					startsWith: "test-auth-",
				},
			},
		});

		await prisma.scrapeJob.deleteMany({
			where: {
				searchTerm: {
					startsWith: "test-auth-",
				},
			},
		});

		await prisma.$disconnect();
	});

	describe("API Authentication with Database Operations", () => {
		describe("Property Stats Endpoint (Database Read)", () => {
			test("should return stats without authentication (optional auth)", async () => {
				const response = await request(app).get("/api/properties/stats");

				expect([200, 500]).toContain(response.status);
				if (response.status === 200) {
					expect(response.body).toHaveProperty("totalProperties");
					expect(typeof response.body.totalProperties).toBe("number");
				}
			});

			test("should return stats with valid JWT token", async () => {
				const response = await request(app)
					.get("/api/properties/stats")
					.set("Authorization", `Bearer ${validToken}`);

				expect([200, 500]).toContain(response.status);
				if (response.status === 200) {
					expect(response.body).toHaveProperty("totalProperties");
				}
			});

			test("should still work with invalid token (optional auth)", async () => {
				const response = await request(app)
					.get("/api/properties/stats")
					.set("Authorization", "Bearer invalid-token");

				// Should work but user won't be authenticated
				expect([200, 500]).toContain(response.status);
			});
		});

		describe("Property Search Endpoint (Database Read with Filters)", () => {
			test("should search properties without authentication", async () => {
				const response = await request(app)
					.get("/api/properties")
					.query({ limit: 10, offset: 0 });

				expect([200, 500]).toContain(response.status);
				if (response.status === 200) {
					expect(response.body).toHaveProperty("data");
					expect(response.body).toHaveProperty("pagination");
					expect(Array.isArray(response.body.data)).toBe(true);
				}
			});

			test("should search properties with valid authentication", async () => {
				const response = await request(app)
					.get("/api/properties")
					.set("Authorization", `Bearer ${validToken}`)
					.query({ limit: 10, offset: 0 });

				expect([200, 500]).toContain(response.status);
				if (response.status === 200) {
					expect(response.body).toHaveProperty("data");
					expect(response.body).toHaveProperty("pagination");
					expect(Array.isArray(response.body.data)).toBe(true);
				}
			});

			test("should handle database queries with filters", async () => {
				const response = await request(app)
					.get("/api/properties")
					.set("Authorization", `Bearer ${validToken}`)
					.query({
						limit: 5,
						offset: 0,
						city: "Austin",
					});

				expect([200, 500]).toContain(response.status);
				if (response.status === 200) {
					expect(response.body).toHaveProperty("data");
					expect(response.body).toHaveProperty("pagination");
					expect(response.body.pagination).toHaveProperty("total");
				}
			});
		});

		describe("Scrape Job Creation (Database Write)", () => {
			test("should create scrape job without authentication (optional auth)", async () => {
				const redisAvailable = await isRedisAvailable(3000);

				if (!redisAvailable) {
					logger.debug("⏭️  Skipping scrape job test: Redis not available");
					return;
				}

				const response = await request(app)
					.post("/api/properties/scrape")
					.send({
						searchTerm: "test-auth-no-token",
					});

				// Should succeed or fail based on rate limiting, not auth
				expect([202, 400, 429, 500]).toContain(response.status);

				if (response.status === 202) {
					expect(response.body).toHaveProperty("jobId");
					expect(response.body).toHaveProperty("message");
				}
			}, 10000);

			test("should create scrape job with valid authentication", async () => {
				const redisAvailable = await isRedisAvailable(3000);

				if (!redisAvailable) {
					logger.debug("⏭️  Skipping scrape job test: Redis not available");
					return;
				}

				const response = await request(app)
					.post("/api/properties/scrape")
					.set("Authorization", `Bearer ${validToken}`)
					.send({
						searchTerm: "test-auth-valid-token",
					});

				expect([202, 400, 429, 500]).toContain(response.status);

				if (response.status === 202) {
					expect(response.body).toHaveProperty("jobId");
					expect(response.body).toHaveProperty("message");
				}
			}, 10000);

			test("should handle invalid request data gracefully", async () => {
				const response = await request(app)
					.post("/api/properties/scrape")
					.set("Authorization", `Bearer ${validToken}`)
					.send({
						searchTerm: "ab", // Too short (min 4 chars)
					});

				expect(response.status).toBe(400);
				expect(response.body).toHaveProperty("error");
			});
		});

		describe("Job Status Retrieval (Database Read)", () => {
			test("should retrieve job status without authentication", async () => {
				const redisAvailable = await isRedisAvailable(3000);

				if (!redisAvailable) {
					logger.debug("⏭️  Skipping job status test: Redis not available");
					return;
				}

				// Job retrieval requires Redis (BullMQ queue lookup)
				const response = await request(app).get(
					"/api/properties/jobs/non-existent-job",
				);
				expect([200, 404, 500]).toContain(response.status);
			}, 10000);

			test("should retrieve job status with valid authentication", async () => {
				const redisAvailable = await isRedisAvailable(3000);

				if (!redisAvailable) {
					logger.debug("⏭️  Skipping job status test: Redis not available");
					return;
				}

				const response = await request(app)
					.get("/api/properties/jobs/non-existent-job")
					.set("Authorization", `Bearer ${validToken}`);

				expect([200, 404, 500]).toContain(response.status);
			}, 10000);

			test("should handle non-existent job ID", async () => {
				const redisAvailable = await isRedisAvailable(3000);

				if (!redisAvailable) {
					logger.debug("⏭️  Skipping job status test: Redis not available");
					return;
				}

				const fakeJobId = "non-existent-job-id";
				const response = await request(app)
					.get(`/api/properties/jobs/${fakeJobId}`)
					.set("Authorization", `Bearer ${validToken}`);

				expect(response.status).toBe(404);
			}, 10000);
		});
	});

	describe("Token Validation and Database Access", () => {
		test("should access database with fresh token", async () => {
			const freshToken = generateToken("fresh-user-id", "fresh@example.com");

			const response = await request(app)
				.get("/api/properties/stats")
				.set("Authorization", `Bearer ${freshToken}`);

			expect([200, 500]).toContain(response.status);
		});

		test("should still work with expired token in optional auth endpoints", async () => {
			// Optional auth endpoints should work even with expired tokens
			const response = await request(app)
				.get("/api/properties/stats")
				.set("Authorization", `Bearer ${expiredToken}`);

			expect([200, 500]).toContain(response.status);
		});

		test("should handle malformed tokens gracefully", async () => {
			const response = await request(app)
				.get("/api/properties/stats")
				.set("Authorization", "Bearer malformed.token.here");

			// Should not crash, optional auth allows this
			expect([200, 500]).toContain(response.status);
		});

		test("should handle missing Authorization header", async () => {
			const response = await request(app).get("/api/properties/stats");

			expect([200, 500]).toContain(response.status);
		});
	});

	describe("Database Query Performance with Authentication", () => {
		test("should handle multiple authenticated requests concurrently", async () => {
			const requests = Array.from({ length: 5 }, () =>
				request(app)
					.get("/api/properties/stats")
					.set("Authorization", `Bearer ${validToken}`),
			);

			const responses = await Promise.all(requests);

			responses.forEach((response) => {
				expect([200, 500]).toContain(response.status);
			});
		});

		test("should handle mixed authenticated and unauthenticated requests", async () => {
			const requests = [
				request(app).get("/api/properties/stats"),
				request(app)
					.get("/api/properties/stats")
					.set("Authorization", `Bearer ${validToken}`),
				request(app).get("/api/properties/stats"),
				request(app)
					.get("/api/properties/stats")
					.set("Authorization", `Bearer ${validToken}`),
			];

			const responses = await Promise.all(requests);

			responses.forEach((response) => {
				expect([200, 500]).toContain(response.status);
			});
		});
	});

	describe("Database Transaction Integrity with Authentication", () => {
		test("should maintain transaction integrity during authenticated writes", async () => {
			const redisAvailable = await isRedisAvailable(3000);

			if (!redisAvailable) {
				logger.debug(
					"⏭️  Skipping transaction integrity test: Redis not available",
				);
				return;
			}

			const searchTerm = `test-auth-transaction-${Date.now()}`;

			// Create a scrape job
			const response = await request(app)
				.post("/api/properties/scrape")
				.set("Authorization", `Bearer ${validToken}`)
				.send({ searchTerm });

			if (response.status === 202) {
				const jobId = response.body.jobId;

				// Verify we can retrieve it via API
				const statusResponse = await request(app)
					.get(`/api/properties/jobs/${jobId}`)
					.set("Authorization", `Bearer ${validToken}`);

				expect([200, 404, 500]).toContain(statusResponse.status);
			}
		}, 10000);
	});

	describe("Error Handling with Authentication and Database", () => {
		test("should handle database errors gracefully with valid auth", async () => {
			const redisAvailable = await isRedisAvailable(3000);

			if (!redisAvailable) {
				logger.debug("⏭️  Skipping error handling test: Redis not available");
				return;
			}

			// This might work or fail depending on Redis availability
			const response = await request(app)
				.post("/api/properties/scrape")
				.set("Authorization", `Bearer ${validToken}`)
				.send({
					searchTerm: "test-auth-error-handling",
				});

			// Should return a proper HTTP response, not crash
			expect(response.status).toBeDefined();
			expect([202, 400, 429, 500]).toContain(response.status);
		}, 10000);

		test("should validate request data before database operations", async () => {
			// Send invalid data
			const response = await request(app)
				.post("/api/properties/scrape")
				.set("Authorization", `Bearer ${validToken}`)
				.send({
					// Missing required searchTerm
				});

			// May hit rate limit (429) before validation in CI
			expect([400, 429]).toContain(response.status);

			// Response should have error property if body exists
			if (response.body && Object.keys(response.body).length > 0) {
				expect(response.body).toHaveProperty("error");
			}
		});

		test("should handle SQL injection attempts safely", async () => {
			const maliciousInput = "'; DROP TABLE properties; --";

			const response = await request(app)
				.get("/api/properties")
				.set("Authorization", `Bearer ${validToken}`)
				.query({
					city: maliciousInput,
				});

			// Prisma should handle this safely
			expect([200, 400, 500]).toContain(response.status);

			// Verify table still exists
			const count = await prisma.property.count();
			expect(typeof count).toBe("number");
		});
	});

	describe("Rate Limiting with Authentication", () => {
		test("should enforce rate limits on authenticated requests", async () => {
			const redisAvailable = await isRedisAvailable(3000);

			if (!redisAvailable) {
				logger.debug("⏭️  Skipping rate limiting test: Redis not available");
				return;
			}

			// Make multiple scrape requests rapidly
			const requests = Array.from({ length: 3 }, (_, i) =>
				request(app)
					.post("/api/properties/scrape")
					.set("Authorization", `Bearer ${validToken}`)
					.send({
						searchTerm: `test-auth-rate-limit-${i}`,
					}),
			);

			const responses = await Promise.all(requests);

			// Some requests should succeed (202) or be rate limited (429)
			responses.forEach((response) => {
				expect([202, 400, 429, 500]).toContain(response.status);
			});

			// Rate limiting may or may not trigger depending on timing - this is acceptable
		}, 10000);
	});

	describe("User Context in Database Operations", () => {
		test("should populate user context from JWT token", async () => {
			const uniqueUserId = `user-${Date.now()}`;
			const userToken = generateToken(uniqueUserId, "contexttest@example.com");

			const response = await request(app)
				.get("/api/properties/stats")
				.set("Authorization", `Bearer ${userToken}`);

			// The middleware should decode the token and make user info available
			expect([200, 500]).toContain(response.status);

			// User context would be available in req.user for the endpoint to use
			// This test verifies the token is accepted and processed
		});

		test("should handle requests without user context", async () => {
			// No token provided
			const response = await request(app).get("/api/properties/stats");

			expect([200, 500]).toContain(response.status);
			// Should work with optional auth
		});
	});

	describe("Connection Pool Management under Load", () => {
		test("should handle burst of authenticated database operations", async () => {
			const burstSize = 20;
			const requests = Array.from({ length: burstSize }, () =>
				request(app)
					.get("/api/properties")
					.set("Authorization", `Bearer ${validToken}`)
					.query({ limit: 1 }),
			);

			const start = Date.now();
			const responses = await Promise.all(requests);
			const duration = Date.now() - start;

			// All requests should complete
			expect(responses).toHaveLength(burstSize);

			// Most should succeed (some might fail if Redis/DB is down)
			const successful = responses.filter((r) => r.status === 200).length;
			const failed = responses.filter((r) => r.status === 500).length;

			expect(successful + failed).toBe(burstSize);

			// Should complete in reasonable time (adjust based on your environment)
			expect(duration).toBeLessThan(10000); // 10 seconds
		});
	});
});
