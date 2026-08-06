/** Shared queue helpers for backfill scripts. Uses Cloudflare Workers API for enqueueing. */

import { getErrorMessage } from "./error-helpers";

export const POLL_INTERVAL_MS = 15_000;
export const BATCH_SIZE = 20;

const apiKeyFromEnv = process.env.TCAD_API_KEY;
const API_URL = "https://api.alephatx.info/api/properties/scrape";

if (!apiKeyFromEnv) {
	console.error("ERROR: TCAD_API_KEY not set");
	process.exit(1);
}
const API_KEY: string = apiKeyFromEnv;

// Placeholder: Cloudflare Queues don't expose queue depth directly via public API.
// For now, just log and exit. In production, monitor via Cloudflare dashboard.
export async function waitForQueueDrain(): Promise<void> {
	console.log(
		"\n  Note: Queue depth monitoring requires Cloudflare API access.",
	);
	console.log(
		"  Check status via: cd workers/tcad-api && npx wrangler queues list",
	);
}

export interface EnqueueLogger {
	error: (msg: string, ...meta: unknown[]) => unknown;
}

export interface BatchEnqueueConfig {
	/** Display name for the batch (e.g., "Corporation", "Residential") */
	batchName: string;
	/** Emoji to display in logs (e.g., "🏛️", "🏠") */
	emoji: string;
	/** Array of search terms to enqueue */
	terms: string[];
	/** User ID for job attribution */
	userId: string;
	/** Job priority (default: undefined) */
	priority?: number;
	/** Additional log messages to display after initial logs */
	extraLogs?: () => void;
}

export async function enqueueBatch(
	terms: string[],
	_userId: string,
	logger: EnqueueLogger = console,
): Promise<number> {
	let enqueued = 0;
	for (const term of terms) {
		try {
			const res = await fetch(API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": API_KEY,
				},
				body: JSON.stringify({ searchTerm: term }),
			});

			if (res.ok) {
				enqueued++;
			} else {
				logger.error(
					`  Failed to enqueue "${term}": HTTP ${res.status} ${res.statusText}`,
				);
			}
		} catch (error) {
			logger.error(`  Failed to enqueue "${term}": ${getErrorMessage(error)}`);
		}
	}
	return enqueued;
}
