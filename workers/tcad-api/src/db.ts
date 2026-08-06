import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";

/**
 * Create a PrismaClient bound to Cloudflare D1.
 * Must be called per-request — Workers are stateless.
 */
export function createPrisma(db: D1Database): PrismaClient {
	const adapter = new PrismaD1(db);
	return new PrismaClient({ adapter });
}
