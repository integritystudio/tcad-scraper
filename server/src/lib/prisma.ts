import { PrismaClient } from "@prisma/client";
import { config } from "../config";

declare global {
	// eslint-disable-next-line no-var
	var prisma: PrismaClient | undefined;
	// eslint-disable-next-line no-var
	var prismaReadOnly: PrismaClient | undefined;
}

/**
 * Build database URL with connection pooling parameters
 * Adds connection_limit and pool_timeout to prevent connection exhaustion
 */
function buildDatabaseUrl(baseUrl: string): string {
	const url = new URL(baseUrl);
	// Add connection pooling parameters
	url.searchParams.set("connection_limit", String(config.database.poolSize));
	url.searchParams.set("pool_timeout", "30"); // 30 seconds
	url.searchParams.set(
		"connect_timeout",
		String(Math.floor(config.database.connectionTimeout / 1000)),
	);
	return url.toString();
}

const writeClient =
	global.prisma ||
	new PrismaClient({
		datasources: {
			db: {
				url: buildDatabaseUrl(config.database.url),
			},
		},
		log: config.env.isDevelopment ? ["query", "error", "warn"] : ["error"],
	});

if (process.env.NODE_ENV !== "production") {
	global.prisma = writeClient;
}

const readClient =
	global.prismaReadOnly ||
	new PrismaClient({
		datasources: {
			db: {
				url: buildDatabaseUrl(
					config.database.readOnlyUrl || config.database.url,
				),
			},
		},
		log: config.env.isDevelopment ? ["query", "error", "warn"] : ["error"],
	});

if (process.env.NODE_ENV !== "production") {
	global.prismaReadOnly = readClient;
}

// biome-ignore lint/suspicious/noRedeclare: Intentional shadowing of global declarations for Prisma singleton pattern
export const prisma = writeClient;
// biome-ignore lint/suspicious/noRedeclare: Intentional shadowing of global declarations for Prisma singleton pattern
export const prismaReadOnly = readClient;
