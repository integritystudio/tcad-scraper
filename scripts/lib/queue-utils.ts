/** Shared queue helpers for backfill scripts. Uses Cloudflare Workers API for enqueueing. */

import { getErrorMessage } from "./error-helpers";

export const POLL_INTERVAL_MS = 15_000;
export const BATCH_SIZE = 20;
/** Give up waiting on a batch after this long; unfinished terms are logged. */
export const DRAIN_TIMEOUT_MS = 10 * 60_000;
/** Tolerance for clock skew between this machine and the Workers runtime. */
const CLOCK_SKEW_TOLERANCE_MS = 30_000;
/** /history page size (API max is 100). */
const HISTORY_FETCH_LIMIT = 100;

const apiKeyFromEnv = process.env.TCAD_API_KEY;
const API_BASE = "https://api.alephatx.info/api/properties";
const SCRAPE_URL = `${API_BASE}/scrape`;
const HISTORY_URL = `${API_BASE}/history?limit=${HISTORY_FETCH_LIMIT}`;

if (!apiKeyFromEnv) {
	console.error("ERROR: TCAD_API_KEY not set");
	process.exit(1);
}
const API_KEY: string = apiKeyFromEnv;

export interface EnqueueLogger {
	error: (msg: string, ...meta: unknown[]) => unknown;
}

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

interface HistoryJob {
	searchTerm: string;
	status: string;
	startedAt: string; // ISO 8601 (epoch-ms string on pre-migration responses)
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function toEpochMs(value: string): number {
	return /^\d+$/.test(value) ? Number(value) : Date.parse(value);
}

/**
 * Poll the Workers /history endpoint until every term in `terms` has a job
 * started after `enqueuedAtMs` in a terminal status (completed/failed), or
 * DRAIN_TIMEOUT_MS elapses.
 *
 * POST /scrape only sends a queue message — the job row is created with
 * status "processing" when the ScraperWorkflow starts. A term with no
 * matching row yet is still sitting in the queue (or its message was
 * dropped); the timeout covers both.
 */
export async function waitForQueueDrain(
	terms: string[],
	enqueuedAtMs: number,
	logger: EnqueueLogger = console,
): Promise<void> {
	if (terms.length === 0) return;

	// Track lowercased for matching, but report the caller's original casing
	const originals = new Map(terms.map((t) => [t.toLowerCase(), t]));
	const pending = new Set(originals.keys());
	const cutoffMs = enqueuedAtMs - CLOCK_SKEW_TOLERANCE_MS;
	const deadline = Date.now() + DRAIN_TIMEOUT_MS;

	console.log(
		`  Waiting for ${pending.size} jobs (poll ${POLL_INTERVAL_MS / 1000}s, timeout ${DRAIN_TIMEOUT_MS / 60_000}m)...`,
	);

	while (Date.now() < deadline) {
		await sleep(POLL_INTERVAL_MS);

		let jobs: HistoryJob[];
		try {
			const res = await fetch(HISTORY_URL);
			if (!res.ok) {
				logger.error(
					`  History poll failed: HTTP ${res.status} ${res.statusText}`,
				);
				continue;
			}
			jobs = ((await res.json()) as { data: HistoryJob[] }).data;
		} catch (error) {
			logger.error(`  History poll failed: ${getErrorMessage(error)}`);
			continue;
		}

		for (const job of jobs) {
			if (!TERMINAL_STATUSES.has(job.status)) continue;
			if (toEpochMs(job.startedAt) < cutoffMs) continue;
			pending.delete(job.searchTerm.toLowerCase());
		}

		if (pending.size === 0) {
			console.log(`  All ${terms.length} batch jobs finished.`);
			return;
		}
		console.log(
			`  ${terms.length - pending.size}/${terms.length} jobs finished...`,
		);
	}

	const unfinished = [...pending].map((key) => originals.get(key) ?? key);
	logger.error(
		`  Drain timeout after ${DRAIN_TIMEOUT_MS / 60_000}m; unfinished: ${unfinished.join(", ")}`,
	);
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

/** Enqueue terms one at a time; returns the terms that were accepted (HTTP 2xx). */
export async function enqueueBatch(
	terms: string[],
	_userId: string,
	logger: EnqueueLogger = console,
): Promise<string[]> {
	const enqueued: string[] = [];
	for (const term of terms) {
		try {
			const res = await fetch(SCRAPE_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": API_KEY,
				},
				body: JSON.stringify({ searchTerm: term }),
			});

			if (res.ok) {
				enqueued.push(term);
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
