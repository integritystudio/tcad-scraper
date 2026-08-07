/**
 * ScraperWorkflow — Cloudflare Workflow replacing Bull queue processor.
 * Ported from server/src/queues/scraper.queue.ts.
 *
 * Steps:
 *  1. create-job      — create the ScrapeJob row
 *  2. get-token       — fetch auth token from KV or token worker
 *  3. fetch-page-N    — one checkpointed step per TCAD API page (see below)
 *  4. deduplicate     — remove duplicate propertyIds across all pages
 *  5. upsert          — bulk upsert to D1 via micro-chunked prepared statements
 *  6. analytics       — update search_term_analytics
 *
 * fetch-page-N is one step.do() call per page rather than a single step
 * wrapping the whole paginated fetch. A term needing many pages (e.g. a
 * broad entity word matching thousands of properties) can take several
 * minutes in total; a single-step design retries by restarting pagination
 * from page 1, so a term that consistently needs more than the step's
 * timeout budget fails identically on every retry (incident 2026-08-06:
 * "Trust" timed out at ~120s three times in a row). Checkpointing per page
 * means a retry only redoes the one slow/failed page.
 */

import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import {
	API_CLIENT_TIMEOUT_MS,
	DEFAULT_QUERY_LIMIT,
	MAX_QUERY_LIMIT as TCAD_PAGE_SIZE,
} from "../../../../utils/constants";
import { HttpStatus } from "../../../../utils/http-errors";
import { DURATION_MS, TIME_MS } from "../../../../utils/units";
import type { Env } from "../bindings";
import { createPrisma } from "../db";
import type { PropertyData, ScrapeParams } from "../types/property.types";
import {
	dedupeResultSchema,
	fetchPageResultSchema,
	fetchResultSchema,
	upsertResultSchema,
} from "../types/property.types";
import { TCAD_API_URL, UPSERT_CHUNK_SIZE } from "../utils/constants";
import { nowEpoch } from "../utils/epoch-dates";
import { getErrorMessage } from "../utils/error-helpers";
import { buildUpsertStatements } from "../utils/upsert-sql";

/**
 * Derive success_rate and avg_results_per_search from the just-incremented
 * counters (Prisma upserts can't compute across columns). Never throws: a
 * failure here at the end of a non-idempotent step would make the Workflows
 * retry re-run the counter increments, double-counting the search.
 */
async function recomputeDerivedStats(
	prisma: ReturnType<typeof createPrisma>,
	searchTerm: string,
): Promise<void> {
	try {
		await prisma.$executeRaw`
			UPDATE search_term_analytics
			SET success_rate = CAST(successful_searches AS REAL) / total_searches,
			    avg_results_per_search = CAST(total_results AS REAL) / total_searches
			WHERE search_term = ${searchTerm} AND total_searches > 0`;
	} catch (err) {
		console.error("Failed to recompute derived analytics stats", {
			searchTerm,
			error: getErrorMessage(err),
		});
	}
}

export class ScraperWorkflow extends WorkflowEntrypoint<Env, ScrapeParams> {
	async run(event: WorkflowEvent<ScrapeParams>, step: WorkflowStep) {
		const { searchTerm, year } = event.payload;

		// Step 1: Create the job record. Kept outside the try/catch below —
		// if this itself fails, no row exists yet, so there's nothing for
		// mark-failed to update.
		const { jobId } = await step.do("create-job", async () => {
			const prisma = createPrisma(this.env.DB);
			const job = await prisma.scrapeJob.create({
				data: { searchTerm, status: "processing", startedAt: nowEpoch() },
			});
			return { jobId: job.id };
		});

		try {
			// Step 2: Get auth token. Must be inside the try/catch — the job
			// row already exists at this point, so a failed fetch needs to
			// reach mark-failed instead of leaving it stuck in "processing"
			// until the 24h stale-job cron catches it.
			const { token } = await step.do("get-token", async () => {
				// Try KV cache first, fall back to token worker
				// Phase 3: const cached = await this.env.TOKEN_CACHE.get("tcad-token");
				const res = await fetch(this.env.TOKEN_WORKER_URL, {
					headers: { Authorization: `Bearer ${this.env.TOKEN_WORKER_SECRET}` },
					signal: AbortSignal.timeout(DURATION_MS.TEN_SECONDS),
				});
				if (!res.ok) throw new Error(`Token worker returned ${res.status}`);
				const { token } = (await res.json()) as {
					token: string;
					expiresIn: number;
				};
				// Phase 3: await this.env.TOKEN_CACHE.put("tcad-token", token, { expirationTtl: expiresIn - 30 });

				return { token };
			});

			// Step 3: Fetch properties from TCAD API — one checkpointed step per
			// page (see class docstring for why). Each page is written to its
			// own KV key; the pagination cursor (page, totals) lives in plain
			// loop state, which Workflows replays deterministically from
			// already-cached step outputs.
			let totalPages = 0;
			let totalFetchedSoFar = 0;
			let totalApiResults = 0;
			let page = 1;

			while (page <= DEFAULT_QUERY_LIMIT) {
				const pageResult = await step.do(
					`fetch-page-${page}`,
					{
						retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
						timeout: "45 seconds",
					},
					async () => {
						const { properties, totalApiResults: pageTotal } =
							await fetchTCADPropertiesPage(token, searchTerm, year, page);
						const kvKey = `scrape:${jobId}:page:${page}`;
						await this.env.RESPONSE_CACHE.put(
							kvKey,
							JSON.stringify(properties),
							{ expirationTtl: 3600 },
						);
						return fetchPageResultSchema.parse({
							kvKey,
							pageCount: properties.length,
							totalApiResults: pageTotal ?? 0,
						});
					},
				);

				totalPages++;
				totalFetchedSoFar += pageResult.pageCount;
				if (page === 1) totalApiResults = pageResult.totalApiResults;

				const hasMore =
					pageResult.pageCount >= TCAD_PAGE_SIZE &&
					totalFetchedSoFar < totalApiResults;
				if (!hasMore || page >= DEFAULT_QUERY_LIMIT) break;

				// Rate limit delay between pagination requests
				await new Promise((resolve) => setTimeout(resolve, TIME_MS.SECOND));
				page++;
			}

			const fetchResult = fetchResultSchema.parse({
				totalPages,
				totalApiResults,
			});

			// Step 4: Deduplicate (retrieve every page from KV, store result back
			// to KV). The deduped array must NOT be returned directly — Workflows
			// persists every step's return value as its checkpoint, capped at
			// 1MiB, and a common term's dedup output can exceed that (e.g.
			// "Chris" -> 9,658 rows, incident 2026-08-06). Route through KV
			// like the fetch-page steps do, returning only a pointer.
			const dedupeResult = await step.do("deduplicate", async () => {
				const map = new Map<string, PropertyData>();
				for (let p = 1; p <= fetchResult.totalPages; p++) {
					const pageKvKey = `scrape:${jobId}:page:${p}`;
					const stored = await this.env.RESPONSE_CACHE.get(pageKvKey);
					if (!stored) throw new Error(`KV key ${pageKvKey} not found`);
					const rawProperties = JSON.parse(stored) as PropertyData[];
					for (const prop of rawProperties) {
						if (prop.propertyId) map.set(prop.propertyId, prop);
					}
				}
				const deduped = Array.from(map.values());
				const kvKey = `scrape:${jobId}:deduped`;
				await this.env.RESPONSE_CACHE.put(kvKey, JSON.stringify(deduped), {
					expirationTtl: 3600,
				});
				return dedupeResultSchema.parse({ kvKey, count: deduped.length });
			});

			// Step 5: Upsert to database (chunked)
			const upsertResult = await step.do("upsert-properties", async () => {
				const stored = await this.env.RESPONSE_CACHE.get(dedupeResult.kvKey);
				if (!stored) throw new Error(`KV key ${dedupeResult.kvKey} not found`);
				const properties = JSON.parse(stored) as PropertyData[];

				let savedCount = 0;
				let updatedCount = 0;
				const newPropertyIds: string[] = [];

				for (let i = 0; i < properties.length; i += UPSERT_CHUNK_SIZE) {
					const chunk = properties.slice(i, i + UPSERT_CHUNK_SIZE);
					const result = await bulkUpsert(this.env.DB, chunk, searchTerm, year);
					savedCount += result.savedCount;
					updatedCount += result.updatedCount;
					newPropertyIds.push(...result.newPropertyIds);
				}

				return upsertResultSchema.parse({
					savedCount,
					updatedCount,
					newPropertyIds,
					totalApiResults: fetchResult.totalApiResults,
				});
			});

			// Step 6: Update job record + analytics
			await step.do("update-analytics", async () => {
				const prisma = createPrisma(this.env.DB);

				await prisma.scrapeJob.update({
					where: { id: jobId },
					data: {
						status: "completed",
						resultCount: upsertResult.savedCount,
						totalApiResults: upsertResult.totalApiResults,
						updatedCount: upsertResult.updatedCount,
						newPropertyIds: JSON.stringify(upsertResult.newPropertyIds),
						completedAt: nowEpoch(),
					},
				});

				// Upsert search term analytics
				const now = nowEpoch();
				await prisma.searchTermAnalytics.upsert({
					where: { searchTerm },
					update: {
						totalSearches: { increment: 1 },
						successfulSearches: { increment: 1 },
						totalResults: { increment: upsertResult.savedCount },
						lastSearched: now,
						updatedAt: now,
					},
					create: {
						searchTerm,
						termLength: searchTerm.length,
						totalSearches: 1,
						successfulSearches: 1,
						totalResults: upsertResult.savedCount,
						lastSearched: now,
						createdAt: now,
						updatedAt: now,
					},
				});
				await recomputeDerivedStats(prisma, searchTerm);
			});

			return upsertResult;
		} catch (err) {
			// Mark the job as failed so it doesn't stay stuck in "processing".
			// mark-failed can itself fail (e.g. a D1 outage) — if the whole
			// step throws, Workflows retries it, which would re-run the
			// analytics increment below and double-count the failure once
			// the job-status update has already landed. So the analytics
			// half is best-effort and swallows its own errors, keeping the
			// step's success/failure tied only to the critical status
			// update. If mark-failed exhausts its retries and still fails,
			// log both errors (rather than letting the mark-failed error
			// mask the real one) and fall through to the 24h stale-job
			// cron in index.ts as the last-resort cleanup.
			try {
				await step.do("mark-failed", async () => {
					const prisma = createPrisma(this.env.DB);
					await prisma.scrapeJob.update({
						where: { id: jobId },
						data: {
							status: "failed",
							error: getErrorMessage(err),
							completedAt: nowEpoch(),
						},
					});

					// Record the failure in analytics so successRate reflects
					// reality. Best-effort: must not throw, or a retry of this
					// step would re-run (and double-count) the increment below.
					try {
						const now = nowEpoch();
						await prisma.searchTermAnalytics.upsert({
							where: { searchTerm },
							update: {
								totalSearches: { increment: 1 },
								failedSearches: { increment: 1 },
								lastSearched: now,
								updatedAt: now,
							},
							create: {
								searchTerm,
								termLength: searchTerm.length,
								totalSearches: 1,
								failedSearches: 1,
								lastSearched: now,
								createdAt: now,
								updatedAt: now,
							},
						});
						await recomputeDerivedStats(prisma, searchTerm);
					} catch (analyticsErr) {
						console.error("Failed to record failure analytics", {
							jobId,
							searchTerm,
							error: getErrorMessage(analyticsErr),
						});
					}
				});
			} catch (markFailedErr) {
				console.error(
					'mark-failed step failed; job may stay stuck in "processing" until the stale-job cron catches it',
					{
						jobId,
						searchTerm,
						originalError: getErrorMessage(err),
						markFailedError: getErrorMessage(markFailedErr),
					},
				);
			}
			throw err;
		}
	}
}

// ── TCAD API fetch (simplified from tcad-api-client.ts) ──────────────

interface TCADResult {
	pid?: number;
	displayName?: string;
	propType?: string;
	city?: string;
	streetPrimary?: string;
	marketValue?: string | number;
	appraisedValue?: string | number;
	geoID?: string;
	legalDescription?: string;
}

/**
 * Fetch a single page of TCAD results. Split out from the old all-pages loop
 * so each page can be its own checkpointed Workflow step (see class
 * docstring) — the pagination cursor and stopping decision live in the
 * caller, not here.
 */
async function fetchTCADPropertiesPage(
	token: string,
	searchTerm: string,
	year: number,
	page: number,
): Promise<{ properties: PropertyData[]; totalApiResults: number | null }> {
	const url = `${TCAD_API_URL}?page=${page}&pageSize=${TCAD_PAGE_SIZE}`;
	const body = JSON.stringify({
		pYear: { operator: "=", value: String(year) },
		fullTextSearch: { operator: "match", value: searchTerm },
	});

	const res = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
			Authorization: token,
		},
		body,
		signal: AbortSignal.timeout(API_CLIENT_TIMEOUT_MS),
	});

	if (res.status === HttpStatus.UNAUTHORIZED) {
		// Retrying with the same (now-stale) token would fail identically —
		// skip the step's retry budget and fail straight to mark-failed.
		throw new NonRetryableError("TOKEN_EXPIRED");
	}

	if (
		res.status === HttpStatus.INTERNAL_SERVER_ERROR ||
		res.status === HttpStatus.BAD_GATEWAY ||
		res.status === HttpStatus.SERVICE_UNAVAILABLE
	) {
		console.warn(
			`TCAD API returned ${res.status} for "${searchTerm}" page ${page}`,
		);
		return { properties: [], totalApiResults: null };
	}

	if (!res.ok) {
		throw new Error(`TCAD API returned ${res.status}`);
	}

	const data = (await res.json()) as {
		totalProperty?: { propertyCount?: number };
		results?: TCADResult[];
	};

	const results = data.results ?? [];
	const properties = results.map((r) => ({
		propertyId: String(r.pid ?? ""),
		name: r.displayName ?? "",
		propType: r.propType ?? "",
		city: r.city ?? null,
		propertyAddress: r.streetPrimary ?? "",
		assessedValue: parseNumericValue(r.marketValue),
		appraisedValue: parseNumericValue(r.appraisedValue) ?? 0,
		geoId: r.geoID ?? null,
		description: r.legalDescription ?? null,
	}));

	return {
		properties,
		totalApiResults: data.totalProperty?.propertyCount ?? null,
	};
}

function parseNumericValue(
	val: string | number | undefined | null,
): number | null {
	if (val == null) return null;
	if (typeof val === "number") return val;
	const cleaned = val.replace(/[,$]/g, "");
	const parsed = parseFloat(cleaned);
	return Number.isNaN(parsed) ? null : parsed;
}

// ── D1 bulk upsert (replaces per-row Prisma upserts) ───────────────

/**
 * Bulk upsert via the raw D1 binding.
 *
 * PrismaD1 executes $transaction arrays one query at a time, so per-row
 * upserts cost one D1 subrequest each — a ~5,000-row term exceeds both the
 * 10-minute step timeout and the per-invocation subrequest budget (and once
 * the budget is gone, even mark-failed can't write). db.batch() of
 * multi-row INSERT ... ON CONFLICT statements is one subrequest per chunk.
 *
 * Strategy:
 *  1. Query existing property_ids for this chunk to detect new vs updated
 *  2. Execute micro-chunked multi-row upserts in a single batch()
 *  3. Return new/updated counts based on pre-query diff
 */
async function bulkUpsert(
	db: D1Database,
	chunk: PropertyData[],
	searchTerm: string,
	year: number,
): Promise<{
	savedCount: number;
	updatedCount: number;
	newPropertyIds: string[];
}> {
	// Step 1: Find which property_ids already exist
	const ids = chunk.map((p) => p.propertyId);
	const placeholders = ids.map(() => "?").join(", ");
	const existing = await db
		.prepare(
			`SELECT property_id FROM properties WHERE year = ? AND property_id IN (${placeholders})`,
		)
		.bind(year, ...ids)
		.all<{ property_id: string }>();
	const existingIds = new Set(existing.results.map((r) => r.property_id));

	// Step 2: Upsert via a single D1 batch of multi-row statements
	const now = nowEpoch();
	await db.batch(
		buildUpsertStatements(chunk, searchTerm, year, now).map(
			({ sql, params }) => db.prepare(sql).bind(...params),
		),
	);

	// Step 3: Calculate new vs updated from pre-query diff
	const newPropertyIds = ids.filter((id) => !existingIds.has(id));

	return {
		savedCount: newPropertyIds.length,
		updatedCount: chunk.length - newPropertyIds.length,
		newPropertyIds,
	};
}
