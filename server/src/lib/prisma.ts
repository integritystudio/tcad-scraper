import { PrismaClient } from "@prisma/client";

declare global {
	// eslint-disable-next-line no-var
	var prisma: PrismaClient | undefined;
	// eslint-disable-next-line no-var
	var prismaReadOnly: PrismaClient | undefined;
}

const writeClient =
	global.prisma ||
	new PrismaClient({
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
	});

if (process.env.NODE_ENV !== "production") {
	global.prisma = writeClient;
}

const readClient =
	global.prismaReadOnly ||
	new PrismaClient({
		datasources: {
			db: {
				url: process.env.DATABASE_READ_ONLY_URL || process.env.DATABASE_URL,
			},
		},
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
	});

if (process.env.NODE_ENV !== "production") {
	global.prismaReadOnly = readClient;
}

// biome-ignore lint/suspicious/noRedeclare: Intentional shadowing of global declarations for Prisma singleton pattern
export const prisma = writeClient;
// biome-ignore lint/suspicious/noRedeclare: Intentional shadowing of global declarations for Prisma singleton pattern
export const prismaReadOnly = readClient;
