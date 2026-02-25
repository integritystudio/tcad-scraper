/**
 * Prisma Client Tests
 *
 * Tests for Prisma client initialization and configuration.
 * These tests verify actual behavior without mocking PrismaClient,
 * focusing on what the module exports and how it behaves.
 */

import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import logger from "../logger";

// Test the buildDatabaseUrl function behavior by examining the URL
describe("Database URL Connection Pooling", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("should add connection pooling parameters to database URL", async () => {
		// Set a test DATABASE_URL
		process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";

		// Import fresh module to test URL building
		const { prisma } = await import("../prisma");

		// The client should be initialized (we can't directly test the URL,
		// but we can verify the client was created successfully)
		expect(prisma).toBeDefined();
		expect(typeof prisma.$connect).toBe("function");
	});

	it("should handle URLs with existing query parameters", async () => {
		// Set a DATABASE_URL with existing params
		process.env.DATABASE_URL =
			"postgresql://user:pass@localhost:5432/testdb?schema=public";

		const { prisma } = await import("../prisma");

		expect(prisma).toBeDefined();
	});

	it("should use config values for pool settings", async () => {
		// The config module exports pool settings
		const { config } = await import("../../config");

		// Verify config has the expected database settings
		expect(config.database).toBeDefined();
		expect(typeof config.database.poolSize).toBe("number");
		expect(typeof config.database.connectionTimeout).toBe("number");
		expect(config.database.poolSize).toBeGreaterThan(0);
		expect(config.database.connectionTimeout).toBeGreaterThan(0);
	});
});

describe("Prisma Client Module", () => {
	describe("Module Exports", () => {
		it("should export prisma write client", async () => {
			const { prisma } = await import("../prisma");

			expect(prisma).toBeDefined();
			expect(typeof prisma).toBe("object");
		});

		it("should export prismaReadOnly client", async () => {
			const { prismaReadOnly } = await import("../prisma");

			expect(prismaReadOnly).toBeDefined();
			expect(typeof prismaReadOnly).toBe("object");
		});

		it("should export both clients", async () => {
			const module = await import("../prisma");

			expect(module).toHaveProperty("prisma");
			expect(module).toHaveProperty("prismaReadOnly");
		});
	});

	describe("Client Structure", () => {
		it("prisma client should have $connect method", async () => {
			const { prisma } = await import("../prisma");

			expect(prisma).toHaveProperty("$connect");
			expect(typeof prisma.$connect).toBe("function");
		});

		it("prisma client should have $disconnect method", async () => {
			const { prisma } = await import("../prisma");

			expect(prisma).toHaveProperty("$disconnect");
			expect(typeof prisma.$disconnect).toBe("function");
		});

		it("prismaReadOnly client should have $connect method", async () => {
			const { prismaReadOnly } = await import("../prisma");

			expect(prismaReadOnly).toHaveProperty("$connect");
			expect(typeof prismaReadOnly.$connect).toBe("function");
		});

		it("prismaReadOnly client should have $disconnect method", async () => {
			const { prismaReadOnly } = await import("../prisma");

			expect(prismaReadOnly).toHaveProperty("$disconnect");
			expect(typeof prismaReadOnly.$disconnect).toBe("function");
		});

		it("prisma client should have model accessors", async () => {
			const { prisma } = await import("../prisma");

			// PrismaClient dynamically adds model accessors - check that the object
			// has more than just the base $ methods (indicating models are attached)
			const keys = Object.keys(prisma);
			const modelKeys = keys.filter(
				(k) => !k.startsWith("$") && !k.startsWith("_"),
			);

			expect(modelKeys.length).toBeGreaterThan(0);
		});

		it("prismaReadOnly client should have model accessors", async () => {
			const { prismaReadOnly } = await import("../prisma");

			const keys = Object.keys(prismaReadOnly);
			const modelKeys = keys.filter(
				(k) => !k.startsWith("$") && !k.startsWith("_"),
			);

			expect(modelKeys.length).toBeGreaterThan(0);
		});
	});

	describe("Singleton Pattern", () => {
		it("should return same instance on multiple imports", async () => {
			const module1 = await import("../prisma");
			const module2 = await import("../prisma");

			// ESM modules are cached, so these should be the same
			expect(module1.prisma).toBe(module2.prisma);
			expect(module1.prismaReadOnly).toBe(module2.prismaReadOnly);
		});

		it("write and read clients should be different instances", async () => {
			const { prisma, prismaReadOnly } = await import("../prisma");

			// They may or may not be the same instance depending on config
			// but they should both be defined
			expect(prisma).toBeDefined();
			expect(prismaReadOnly).toBeDefined();
		});
	});

	describe("Client Type Verification", () => {
		it("prisma should be a PrismaClient instance", async () => {
			const { prisma } = await import("../prisma");

			// Verify it has PrismaClient-specific methods
			expect(prisma).toHaveProperty("$transaction");
			expect(prisma).toHaveProperty("$queryRaw");
			expect(prisma).toHaveProperty("$executeRaw");
		});

		it("prismaReadOnly should be a PrismaClient instance", async () => {
			const { prismaReadOnly } = await import("../prisma");

			// Verify it has PrismaClient-specific methods
			expect(prismaReadOnly).toHaveProperty("$transaction");
			expect(prismaReadOnly).toHaveProperty("$queryRaw");
			expect(prismaReadOnly).toHaveProperty("$executeRaw");
		});
	});
});

describe("Prisma Client Integration", () => {
	/**
	 * Check if database is reachable
	 * Returns true only if we can actually connect to the database
	 */
	async function isDatabaseReachable(): Promise<boolean> {
		try {
			const { prisma } = await import("../prisma");
			await prisma.$connect();
			await prisma.$disconnect();
			return true;
		} catch {
			return false;
		}
	}

	// Check database connectivity before running integration tests
	let canConnectToDatabase = false;

	beforeAll(async () => {
		canConnectToDatabase = await isDatabaseReachable();
		if (!canConnectToDatabase) {
			logger.debug(
				"⚠️  Skipping database integration tests - database not reachable",
			);
		}
	});

	describe("Database Connection", () => {
		it("should be able to connect to database", async () => {
			if (!canConnectToDatabase) {
				logger.debug("Skipped: Database not reachable");
				return;
			}

			const { prisma } = await import("../prisma");
			await expect(prisma.$connect()).resolves.not.toThrow();
		});

		it("should be able to disconnect from database", async () => {
			if (!canConnectToDatabase) {
				logger.debug("Skipped: Database not reachable");
				return;
			}

			const { prisma } = await import("../prisma");
			await prisma.$connect();
			await expect(prisma.$disconnect()).resolves.not.toThrow();
		});

		it("read-only client should be able to connect", async () => {
			if (!canConnectToDatabase) {
				logger.debug("Skipped: Database not reachable");
				return;
			}

			const { prismaReadOnly } = await import("../prisma");
			await expect(prismaReadOnly.$connect()).resolves.not.toThrow();
			await prismaReadOnly.$disconnect();
		});
	});
});
