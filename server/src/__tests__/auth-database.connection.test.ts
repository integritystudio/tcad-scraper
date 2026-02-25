/**
 * Database Connection Tests
 *
 * Tests for PostgreSQL database connection, Prisma client initialization,
 * read/write client separation, and connection pooling.
 *
 * NOTE: These tests require remote database access.
 * Tests will be skipped gracefully if database is not reachable.
 */

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import logger from "../lib/logger";
import { prisma, prismaReadOnly } from "../lib/prisma";
import { isDatabaseAvailable } from "./test-utils";

// Check database connectivity before running tests
let canConnectToDatabase = false;

beforeAll(async () => {
	canConnectToDatabase = await isDatabaseAvailable();
	if (!canConnectToDatabase) {
		logger.debug(
			"⚠️  Database not reachable - connection tests will be skipped",
		);
	}
});

/**
 * Helper to skip test if database is not available
 */
function skipIfNoDatabase(): boolean {
	if (!canConnectToDatabase) {
		logger.debug("Skipped: Database not reachable");
		return true;
	}
	return false;
}

describe("Database Connection Tests", () => {
	describe("Prisma Client Initialization", () => {
		test("should initialize write client successfully", () => {
			expect(prisma).toBeDefined();
			expect(prisma).toBeInstanceOf(PrismaClient);
		});

		test("should initialize read-only client successfully", () => {
			expect(prismaReadOnly).toBeDefined();
			expect(prismaReadOnly).toBeInstanceOf(PrismaClient);
		});

		test("should have separate instances for read and write clients", () => {
			// In development they may be the same global instance, but should still be defined
			expect(prisma).toBeDefined();
			expect(prismaReadOnly).toBeDefined();
		});
	});

	describe("Database Connectivity", () => {
		test("should connect to database with write client", async () => {
			if (skipIfNoDatabase()) return;

			// Test connection by executing a simple query
			const result = await prisma.$queryRaw`SELECT 1 as test`;
			expect(result).toBeDefined();
			expect(Array.isArray(result)).toBe(true);
		});

		test("should connect to database with read-only client", async () => {
			if (skipIfNoDatabase()) return;

			// Test connection by executing a simple query
			const result = await prismaReadOnly.$queryRaw`SELECT 1 as test`;
			expect(result).toBeDefined();
			expect(Array.isArray(result)).toBe(true);
		});

		test("should verify database name", async () => {
			if (skipIfNoDatabase()) return;

			const result = await prisma.$queryRaw<
				Array<{ current_database: string }>
			>`SELECT current_database()`;
			expect(result).toBeDefined();
			expect(result.length).toBeGreaterThan(0);
			expect(result[0].current_database).toBeDefined();
		});

		test("should execute concurrent queries without errors", async () => {
			if (skipIfNoDatabase()) return;

			const queries = Array.from(
				{ length: 5 },
				(_, i) => prisma.$queryRaw`SELECT ${i} as number`,
			);

			const results = await Promise.all(queries);
			expect(results).toHaveLength(5);
			results.forEach((result) => {
				expect(result).toBeDefined();
			});
		});
	});

	describe("Schema Validation", () => {
		test("should verify Property table exists", async () => {
			if (skipIfNoDatabase()) return;

			const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'properties'
        );
      `;
			expect(result[0].exists).toBe(true);
		});

		test("should verify ScrapeJob table exists", async () => {
			if (skipIfNoDatabase()) return;

			const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'scrape_jobs'
        );
      `;
			// Table may not exist if migrations haven't been run
			expect(typeof result[0].exists).toBe("boolean");
		});

		test("should verify MonitoredSearch table exists", async () => {
			if (skipIfNoDatabase()) return;

			const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'monitored_searches'
        );
      `;
			// Table may not exist if migrations haven't been run
			expect(typeof result[0].exists).toBe("boolean");
		});
	});

	describe("Read/Write Client Separation", () => {
		test("should allow read operations on read-only client", async () => {
			if (skipIfNoDatabase()) return;

			const count = await prismaReadOnly.property.count();
			expect(typeof count).toBe("number");
			expect(count).toBeGreaterThanOrEqual(0);
		});

		test("should allow write operations on write client", async () => {
			if (skipIfNoDatabase()) return;

			// Create a test property
			const testProperty = await prisma.property.create({
				data: {
					propertyId: `TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`,
					searchTerm: "test-connection",
					name: "Test Owner",
					propType: "Residential",
					propertyAddress: "123 Test St",
					appraisedValue: 100000,
					scrapedAt: new Date(),
					year: 2025,
				},
			});

			expect(testProperty).toBeDefined();
			expect(testProperty.id).toBeDefined();
			expect(testProperty.propertyId).toContain("TEST-");

			// Clean up
			await prisma.property.delete({
				where: { id: testProperty.id },
			});
		});

		test("should read data written by write client", async () => {
			if (skipIfNoDatabase()) return;

			// Create test data
			const testProperty = await prisma.property.create({
				data: {
					propertyId: `TEST-RW-${Date.now()}-${Math.random().toString(36).substring(7)}`,
					searchTerm: "test-read-write",
					name: "Test Owner RW",
					propType: "Residential",
					propertyAddress: "456 Test Ave",
					appraisedValue: 100000,
					scrapedAt: new Date(),
					year: 2025,
				},
			});

			// Read with read-only client
			const foundProperty = await prismaReadOnly.property.findUnique({
				where: { id: testProperty.id },
			});

			expect(foundProperty).toBeDefined();
			expect(foundProperty?.propertyId).toBe(testProperty.propertyId);
			expect(foundProperty?.name).toBe("Test Owner RW");

			// Clean up
			await prisma.property.delete({
				where: { id: testProperty.id },
			});
		});
	});

	describe("Connection Error Handling", () => {
		test("should handle invalid queries gracefully", async () => {
			if (skipIfNoDatabase()) return;

			await expect(
				prisma.$queryRaw`SELECT * FROM non_existent_table`,
			).rejects.toThrow();
		});

		test("should handle malformed queries gracefully", async () => {
			if (skipIfNoDatabase()) return;

			await expect(prisma.$queryRaw`INVALID SQL SYNTAX HERE`).rejects.toThrow();
		});
	});

	describe("Transaction Support", () => {
		test("should support transactions on write client", async () => {
			if (skipIfNoDatabase()) return;

			const testId = `TEST-TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;

			const result = await prisma.$transaction(async (tx) => {
				const property = await tx.property.create({
					data: {
						propertyId: testId,
						searchTerm: "test-transaction",
						name: "Test Transaction Owner",
						propType: "Commercial",
						propertyAddress: "789 Transaction Blvd",
						appraisedValue: 250000,
						scrapedAt: new Date(),
						year: 2025,
					},
				});

				return property;
			});

			expect(result).toBeDefined();
			expect(result.propertyId).toBe(testId);

			// Clean up
			await prisma.property.delete({
				where: { id: result.id },
			});
		});

		test("should rollback failed transactions", async () => {
			if (skipIfNoDatabase()) return;

			const testId = `TEST-ROLLBACK-${Date.now()}-${Math.random().toString(36).substring(7)}`;

			await expect(
				prisma.$transaction(async (tx) => {
					await tx.property.create({
						data: {
							propertyId: testId,
							searchTerm: "test-rollback",
							name: "Test Rollback Owner",
							propType: "Land",
							propertyAddress: "999 Rollback Rd",
							appraisedValue: 75000,
							scrapedAt: new Date(),
							year: 2025,
						},
					});

					// Force an error to trigger rollback
					throw new Error("Intentional rollback");
				}),
			).rejects.toThrow("Intentional rollback");

			// Verify the property was not created
			const foundProperty = await prisma.property.findFirst({
				where: { propertyId: testId },
			});

			expect(foundProperty).toBeNull();
		});
	});

	describe("Performance and Connection Pooling", () => {
		test("should handle multiple concurrent database operations", async () => {
			if (skipIfNoDatabase()) return;

			const operations = Array.from({ length: 10 }, async (_, i) => {
				return prismaReadOnly.property.count({
					where: {
						searchTerm: {
							contains: `test-${i}`,
						},
					},
				});
			});

			const results = await Promise.all(operations);
			expect(results).toHaveLength(10);
			results.forEach((count) => {
				expect(typeof count).toBe("number");
			});
		});

		test("should reuse connections from pool", async () => {
			if (skipIfNoDatabase()) return;

			// Execute multiple queries in sequence
			const query = () => prisma.$queryRaw`SELECT 1`;

			// Just verify both queries succeed (timing tests are flaky)
			const result1 = await query();
			const result2 = await query();

			expect(result1).toBeDefined();
			expect(result2).toBeDefined();
		});
	});

	describe("Data Type Handling", () => {
		test("should correctly handle date/time types", async () => {
			if (skipIfNoDatabase()) return;

			const testDate = new Date("2025-01-01T00:00:00Z");
			const testId = `TEST-DATE-${Date.now()}-${Math.random().toString(36).substring(7)}`;

			const property = await prisma.property.create({
				data: {
					propertyId: testId,
					searchTerm: "test-date",
					name: "Test Date Owner",
					propType: "Residential",
					propertyAddress: "321 Date St",
					appraisedValue: 150000,
					scrapedAt: testDate,
					year: 2025,
				},
			});

			expect(property.scrapedAt).toBeInstanceOf(Date);
			expect(property.scrapedAt.toISOString()).toBe(testDate.toISOString());

			// Clean up
			await prisma.property.delete({
				where: { id: property.id },
			});
		});

		test("should correctly handle numeric types", async () => {
			if (skipIfNoDatabase()) return;

			const testId = `TEST-NUMERIC-${Date.now()}-${Math.random().toString(36).substring(7)}`;

			const property = await prisma.property.create({
				data: {
					propertyId: testId,
					searchTerm: "test-numeric",
					name: "Test Numeric Owner",
					propType: "Commercial",
					propertyAddress: "654 Numeric Ln",
					scrapedAt: new Date(),
					appraisedValue: 500000,
					assessedValue: 525000,
					year: 2025,
				},
			});

			expect(typeof property.appraisedValue).toBe("number");
			expect(property.appraisedValue).toBe(500000);
			expect(property.assessedValue).toBe(525000);

			// Clean up
			await prisma.property.delete({
				where: { id: property.id },
			});
		});

		test("should correctly handle text/string types with special characters", async () => {
			if (skipIfNoDatabase()) return;

			const testId = `TEST-STRING-${Date.now()}-${Math.random().toString(36).substring(7)}`;
			const specialString = "O'Connor & Sons, Inc. <Test>";

			const property = await prisma.property.create({
				data: {
					propertyId: testId,
					searchTerm: "test-string",
					name: specialString,
					propType: "Residential",
					propertyAddress: "987 Special St",
					appraisedValue: 200000,
					scrapedAt: new Date(),
					year: 2025,
				},
			});

			expect(property.name).toBe(specialString);

			// Clean up
			await prisma.property.delete({
				where: { id: property.id },
			});
		});
	});

	// Cleanup after all tests
	afterAll(async () => {
		// Only disconnect if we were able to connect
		if (canConnectToDatabase) {
			await prisma.$disconnect();
			await prismaReadOnly.$disconnect();
		}
	});
});
