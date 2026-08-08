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
const HISTORY_BASE_URL = `${API_BASE}/history`;

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

interface HistoryPage {
	data: HistoryJob[];
	pagination?: { hasMore: boolean };
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function toEpochMs(value: string): number {
	const ms = /^\d+$/.test(value) ? Number(value) : Date.parse(value);
	// NaN would compare false against the recency cutoff and count a
	// malformed startedAt as a fresh terminal job; treat it as stale instead
	return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Poll the Workers /history endpoint until every term in `terms` has a job
 * started after `enqueuedAtMs` in a terminal status (completed/failed), or
 * DRAIN_TIMEOUT_MS elapses.
 *
 * Each poll cycle paginates through /history (ordered newest-first) until all
 * pending terms are found or a job older than the enqueue cutoff is reached.
 * This prevents false timeouts when >100 jobs complete between polls and the
 * batch's jobs scroll past the single-page window.
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

		// Paginate through /history (newest-first) until all pending terms are
		// found or we reach a job that predates our enqueue (no point going further).
		let offset = 0;
		let fetchError = false;

		while (true) {
			let page: HistoryPage;
			try {
				const url = `${HISTORY_BASE_URL}?limit=${HISTORY_FETCH_LIMIT}&offset=${offset}`;
				const res = await fetch(url);
				if (!res.ok) {
					logger.error(
						`  History poll failed: HTTP ${res.status} ${res.statusText}`,
					);
					fetchError = true;
					break;
				}
				page = (await res.json()) as HistoryPage;
			} catch (error) {
				logger.error(`  History poll failed: ${getErrorMessage(error)}`);
				fetchError = true;
				break;
			}

			let reachedCutoff = false;
			for (const job of page.data) {
				if (toEpochMs(job.startedAt) < cutoffMs) {
					// All subsequent jobs are older than our enqueue; stop paging.
					reachedCutoff = true;
					break;
				}
				if (!TERMINAL_STATUSES.has(job.status)) continue;
				pending.delete(job.searchTerm.toLowerCase());
			}

			if (pending.size === 0 || reachedCutoff || !page.pagination?.hasMore)
				break;
			offset += HISTORY_FETCH_LIMIT;
		}

		if (fetchError) continue;

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
	/** Array of search terms to enqueue */
	terms: string[];
}

/** Attempts per term before giving up on a transient failure. */
export const ENQUEUE_MAX_ATTEMPTS = 3;
/** First retry delay; doubles per attempt. */
const ENQUEUE_RETRY_BASE_MS = 1_000;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_FLOOR = 500;

/**
 * Whether a failed response is worth another attempt. 5xx and 429 are the
 * edge or the Worker being briefly unavailable; a 4xx is deterministic
 * (400 validation, 401 bad API key) and retrying it just triples the noise.
 */
function isTransientStatus(status: number): boolean {
	return status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR_FLOOR;
}

/**
 * Enqueue terms one at a time; returns the terms that were accepted (HTTP 2xx).
 *
 * `year` is sent per request so a backfill can target a roll year other than
 * the Worker's TCAD_YEAR var. Omit it to let the Worker apply its own default
 * (which is what every pre-2026 caller relied on).
 *
 * Transient failures are retried with exponential backoff because a dropped
 * term is not a slowdown — it is a permanent gap. Callers increasingly pass a
 * set chosen for *coverage* (optimize-coverage.ts), where each term is the
 * unique best cover for a block of properties, so losing one to a momentary
 * 503 leaves properties that no other term in the plan will reach. A term that
 * exhausts its attempts is reported as such, distinctly from a single failure,
 * so it is greppable in a run that spans thousands of log lines.
 */
export async function enqueueBatch(
	terms: string[],
	logger: EnqueueLogger = console,
	year?: number,
): Promise<string[]> {
	const enqueued: string[] = [];
	const exhausted: string[] = [];

	for (const term of terms) {
		for (let attempt = 1; attempt <= ENQUEUE_MAX_ATTEMPTS; attempt++) {
			const isLastAttempt = attempt === ENQUEUE_MAX_ATTEMPTS;
			let retryable: boolean;

			try {
				const res = await fetch(SCRAPE_URL, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": API_KEY,
					},
					body: JSON.stringify(
						year === undefined
							? { searchTerm: term }
							: { searchTerm: term, year },
					),
				});

				if (res.ok) {
					enqueued.push(term);
					break;
				}

				retryable = isTransientStatus(res.status);
				logger.error(
					`  Failed to enqueue "${term}" (attempt ${attempt}/${ENQUEUE_MAX_ATTEMPTS}): HTTP ${res.status} ${res.statusText}`,
				);
			} catch (error) {
				// Network-level failure (DNS, socket, timeout) — always transient.
				retryable = true;
				logger.error(
					`  Failed to enqueue "${term}" (attempt ${attempt}/${ENQUEUE_MAX_ATTEMPTS}): ${getErrorMessage(error)}`,
				);
			}

			if (!retryable) break;
			if (isLastAttempt) {
				exhausted.push(term);
				break;
			}
			await sleep(ENQUEUE_RETRY_BASE_MS * 2 ** (attempt - 1));
		}
	}

	if (exhausted.length > 0) {
		logger.error(
			`  Enqueue exhausted ${ENQUEUE_MAX_ATTEMPTS} attempts for ${exhausted.length} term(s): ${exhausted.join(", ")}`,
		);
	}
	return enqueued;
}
