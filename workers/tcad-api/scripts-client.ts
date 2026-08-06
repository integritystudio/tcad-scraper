/**
 * Node-only Prisma client factory for production D1, over the Cloudflare
 * HTTP API.
 *
 * Lives in this package (outside src/, so it is not bundled with the Worker)
 * so that `@prisma/client` resolves to the client generated from the
 * canonical D1 schema in prisma/schema.prisma. Consumed by repo-root scripts
 * via scripts/lib/d1-prisma.ts, which supplies the credentials from env
 * (CLOUDFLARE_D1_TOKEN — Doppler: integrity-studio/prd, the "tcad-d1-query"
 * token; the deploy CLOUDFLARE_API_TOKEN cannot query D1).
 */

import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";

const DEFAULT_ACCOUNT_ID = "b3868dd0fd5c0faa7d98aa325a9c2377";
const DEFAULT_DATABASE_ID = "451d4356-10d1-4c1d-adf9-4d4297636343"; // tcad-db

export interface D1HttpConfig {
	token: string;
	accountId?: string;
	databaseId?: string;
}

export function createD1HttpPrisma(cfg: D1HttpConfig): PrismaClient {
	const adapter = new PrismaD1({
		CLOUDFLARE_D1_TOKEN: cfg.token,
		CLOUDFLARE_ACCOUNT_ID: cfg.accountId ?? DEFAULT_ACCOUNT_ID,
		CLOUDFLARE_DATABASE_ID: cfg.databaseId ?? DEFAULT_DATABASE_ID,
	});

	return new PrismaClient({ adapter });
}
