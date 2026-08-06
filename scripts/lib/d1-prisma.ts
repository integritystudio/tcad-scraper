/**
 * Prisma client for scripts, backed by production Cloudflare D1 over HTTP.
 *
 * Replaces the legacy `server/src/lib/prisma` (PostgreSQL) import — production
 * data lives in D1 since March 2026. D1 gotchas that apply to every query:
 *  - Date columns are epoch-millisecond STRINGS ("1711773684000"), never Date
 *    objects or ISO strings. Compare with epoch strings (13-digit, so string
 *    comparison orders correctly).
 *  - SQL is SQLite dialect: LIKE is already ASCII case-insensitive (no ILIKE),
 *    no ::casts, no NOW()/INTERVAL.
 */

import { createD1HttpPrisma } from "../../workers/tcad-api/scripts-client";

// Derived from the factory so no bare "@prisma/client" import is needed here
// (the generated client lives in workers/tcad-api/node_modules, not the root).
type PrismaClient = ReturnType<typeof createD1HttpPrisma>;

function connect(): PrismaClient {
	const token = process.env.CLOUDFLARE_D1_TOKEN;
	if (!token) {
		console.error(
			"ERROR: CLOUDFLARE_D1_TOKEN not set. Run via: doppler run -- npx tsx <script>",
		);
		process.exit(1);
	}
	return createD1HttpPrisma({
		token,
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
		databaseId: process.env.CLOUDFLARE_DATABASE_ID,
	});
}

let client: PrismaClient | undefined;

/**
 * Lazy proxy: the client (and its CLOUDFLARE_D1_TOKEN check) is only created
 * on first use, so importing this module is side-effect-free for tests.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
	get(_target, prop) {
		client ??= connect();
		const value = Reflect.get(client, prop);
		return typeof value === "function" ? value.bind(client) : value;
	},
});

/** Epoch-ms string for "now minus `ms`", matching D1 date column encoding. */
export function epochAgo(ms: number): string {
	return String(Date.now() - ms);
}
