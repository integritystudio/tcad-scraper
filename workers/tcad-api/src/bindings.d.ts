import type { PrismaClient } from "@prisma/client";

/** Cloudflare Worker environment bindings */
export interface Env {
	// Database (D1 — replaces Hyperdrive → Render PostgreSQL)
	DB: D1Database;

	// Phase 2: Workflows + Queues
	SCRAPER_WORKFLOW: Workflow;
	SCRAPER_QUEUE: Queue;

	// Phase 3: KV namespaces
	TOKEN_CACHE: KVNamespace;
	RESPONSE_CACHE: KVNamespace;

	// Secrets (set via `wrangler secret put <NAME>`)
	API_KEY: string;
	ANTHROPIC_API_KEY: string;
	XAI_API_KEY?: string;
	SENTRY_DSN: string;
	TOKEN_WORKER_URL: string;
	TOKEN_WORKER_SECRET: string;

	// Variables (set in wrangler.toml [vars])
	TCAD_YEAR: string;
	FRONTEND_URL: string;

	// Sentry version metadata
	CF_VERSION_METADATA: WorkerVersionMetadata;
}

/** Hono context variables — typed keys for c.set()/c.get() */
export interface AppVariables {
	prisma: PrismaClient;
	user: { id: string; email?: string };
	validatedBody: unknown;
	validatedQuery: unknown;
}

/** Combined Hono app type */
export type AppEnv = { Bindings: Env; Variables: AppVariables };
