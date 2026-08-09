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
import type {
	FetchPageResult,
	PropertyData,
	ScrapeParams,
} from "../types/property.types";
import {
	dedupeResultSchema,
	fetchPageResultSchema,
	fetchResultSchema,
	upsertResultSchema,
} from "../types/property.types";
import {
	DEDUPE_KV_CHUNK_SIZE,
	TCAD_API_URL,
	UPSERT_CHUNK_SIZE,
} from "../utils/constants";
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

/**
 * Update max_results and min_results using the raw TCAD response count for
 * this search. Prisma upserts can't express MAX/MIN across columns, so this
 * uses raw SQL (SQLite's scalar MAX/MIN accept multiple arguments).
 *
 * resultsThisSearch — the total property count TCAD reported (not the count
 * of newly-inserted rows, which is tracked separately as totalResults).
 *
 * Never throws for the same reason as recomputeDerivedStats.
 */
async function updateMinMaxResults(
	prisma: ReturnType<typeof createPrisma>,
	searchTerm: string,
	resultsThisSearch: number,
): Promise<void> {
	try {
		await prisma.$executeRaw`
			UPDATE search_term_analytics
			SET max_results = MAX(max_results, ${resultsThisSearch}),
			    min_results = MIN(COALESCE(min_results, ${resultsThisSearch}), ${resultsThisSearch})
			WHERE search_term = ${searchTerm}`;
	} catch (err) {
		console.error("Failed to update min/max results analytics", {
			searchTerm,
			error: getErrorMessage(err),
		});
	}
}

/** Marker carried by the 401 error so the run loop can recognise it. */
export const TOKEN_EXPIRED_MARKER = "TOKEN_EXPIRED";

/**
 * Whether a failed page step was a token expiry.
 *
 * Matches on the message rather than `instanceof NonRetryableError`: the error
 * crosses the Workflows step boundary, where it is serialised and rethrown, so
 * the prototype does not survive but the message does.
 */
export function isTokenExpiredError(err: unknown): boolean {
	return getErrorMessage(err).includes(TOKEN_EXPIRED_MARKER);
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
				data: { searchTerm, year, status: "processing", startedAt: nowEpoch() },
			});
			return { jobId: job.id };
		});

		try {
			// Step 2: Get auth token. Must be inside the try/catch — the job
			// row already exists at this point, so a failed fetch needs to
			// reach mark-failed instead of leaving it stuck in "processing"
			// until the 24h stale-job cron catches it.
			const fetchToken = async (): Promise<{ token: string }> => {
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
			};

			let token = (await step.do("get-token", fetchToken)).token;

			// Step 3: Fetch properties from TCAD API — one checkpointed step per
			// page (see class docstring for why). Each page is written to its
			// own KV key; the pagination cursor (page, totals) lives in plain
			// loop state, which Workflows replays deterministically from
			// already-cached step outputs.
			let totalPages = 0;
			let totalFetchedSoFar = 0;
			let totalApiResults = 0;
			let page = 1;
			/**
			 * Bumped each time the token is refreshed mid-run, so the retry's
			 * step names stay unique — Workflows keys checkpoints by name and
			 * would otherwise replay the failed attempt's cached result.
			 */
			let tokenGeneration = 0;

			const fetchPageStep = (label: string): Promise<FetchPageResult> =>
				step.do(
					label,
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

			while (page <= DEFAULT_QUERY_LIMIT) {
				// A TCAD token lives 5 minutes, which a wide term outruns:
				// "llc." needs 54 pages of ~1.9 MB each and failed outright on
				// TOKEN_EXPIRED, saving nothing (2026-08-08). The step's own
				// retries cannot help — they replay with the same captured
				// token — so the job mints a fresh one and re-runs the page
				// under a new step name. Without this, any term needing more
				// than one token's lifetime of pagination is unscrapeable, and
				// coverage is silently capped at whatever fits in 5 minutes.
				let pageResult: FetchPageResult;
				try {
					pageResult = await fetchPageStep(`fetch-page-${page}`);
				} catch (err) {
					if (!isTokenExpiredError(err)) throw err;
					tokenGeneration++;
					console.log(
						`Token expired on page ${page} of "${searchTerm}" — refreshing (generation ${tokenGeneration})`,
					);
					token = (
						await step.do(`refresh-token-${tokenGeneration}`, fetchToken)
					).token;
					pageResult = await fetchPageStep(
						`fetch-page-${page}-t${tokenGeneration}`,
					);
				}

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
			//
			// The pointer addresses several keys, not one: a KV *value* is itself
			// capped at 25 MiB, and the highest-match terms exceed it — "blvd"
			// serialized to 28.8 MB against the 2026 roll and failed the whole
			// job (incident 2026-08-08). Writing fixed-size row chunks keeps each
			// value an order of magnitude under the ceiling regardless of how
			// wide a term matches.
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
				const kvKeyPrefix = `scrape:${jobId}:deduped`;
				let chunkCount = 0;
				for (let i = 0; i < deduped.length; i += DEDUPE_KV_CHUNK_SIZE) {
					await this.env.RESPONSE_CACHE.put(
						`${kvKeyPrefix}:${chunkCount}`,
						JSON.stringify(deduped.slice(i, i + DEDUPE_KV_CHUNK_SIZE)),
						{ expirationTtl: 3600 },
					);
					chunkCount++;
				}
				return dedupeResultSchema.parse({
					kvKeyPrefix,
					chunkCount,
					count: deduped.length,
				});
			});

			// Step 5: Upsert to database (chunked)
			const upsertResult = await step.do("upsert-properties", async () => {
				let savedCount = 0;
				let updatedCount = 0;
				const newPropertyIds: string[] = [];

				for (let c = 0; c < dedupeResult.chunkCount; c++) {
					const chunkKey = `${dedupeResult.kvKeyPrefix}:${c}`;
					const stored = await this.env.RESPONSE_CACHE.get(chunkKey);
					if (!stored) throw new Error(`KV key ${chunkKey} not found`);
					const properties = JSON.parse(stored) as PropertyData[];

					for (let i = 0; i < properties.length; i += UPSERT_CHUNK_SIZE) {
						const chunk = properties.slice(i, i + UPSERT_CHUNK_SIZE);
						const result = await bulkUpsert(
							this.env.DB,
							chunk,
							searchTerm,
							year,
						);
						savedCount += result.savedCount;
						updatedCount += result.updatedCount;
						newPropertyIds.push(...result.newPropertyIds);
					}
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
						// Seed min/max on first write; updateMinMaxResults below
						// handles MAX(existing, new) for subsequent searches.
						maxResults: upsertResult.totalApiResults,
						minResults: upsertResult.totalApiResults,
						lastSearched: now,
						createdAt: now,
						updatedAt: now,
					},
				});
				// max_results / min_results can't be expressed as Prisma
				// increment/decrement, so update them via raw SQL after the upsert.
				// Safe to run after both create and update paths: after a create
				// the MAX/MIN of (seeded_value, seeded_value) is a no-op.
				await updateMinMaxResults(
					prisma,
					searchTerm,
					upsertResult.totalApiResults,
				);
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

// Every field TCAD returns (verified against live responses 2026-08-08).
// Numeric-looking values arrive inconsistently as string or number, so
// numeric fields are typed string | number and parsed on mapping.
interface TCADResult {
	pid?: number | null;
	pYear?: string | null; // duplicate of the search year — not captured
	pVersion?: number | null;
	pRollCorr?: number | null;
	propType?: string | null;
	pAccountID?: number | null;
	latitude?: string | number | null;
	longitude?: string | number | null;
	asCode?: string | null;
	block?: string | null;
	tract?: string | null;
	lot?: string | null;
	mhSpaceNum?: string | null;
	condoUnit?: string | null;
	additionalLegal?: string | null;
	legalAcreage?: string | number | null;
	autoBuildLegal?: number | null;
	geoID?: string | null;
	simpleGeo?: string | null;
	refID1?: string | null;
	refID2?: string | null;
	massCreatedFrom?: number | null;
	templateProperty?: number | null;
	templateDesc?: string | null;
	dba?: string | null;
	altDBA?: string | null;
	mortgageCoID?: string | number | null;
	mortgageCoAcctID?: string | number | null;
	effectiveSizeAcres?: string | number | null;
	legalDescription?: string | null;
	mapID?: string | null;
	mapsco?: string | null;
	propReference?: number | null;
	referenceDesc?: string | null;
	active?: string | null;
	inactive?: number | null;
	inactiveDt?: string | null;
	propCreateDt?: string | null;
	apprCompanyID?: string | number | null;
	marketArea?: string | null;
	useCd?: string | null;
	zoning?: string | null;
	sicCd?: string | null;
	landValue?: string | number | null;
	improvementValue?: string | number | null;
	marketValue?: string | number | null;
	landHomesitePct?: string | number | null;
	structureHomesitePct?: string | number | null;
	appraisedValue?: string | number | null;
	ownerID?: number | null;
	ownerPct?: string | number | null;
	name?: string | null;
	displayName?: string | null;
	nameSecondary?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	spouseFirstName?: string | null;
	spouseLastName?: string | null;
	confidentialName?: string | null;
	addrDeliveryLine?: string | null;
	addrUnitDesignator?: string | null;
	addrCity?: string | null;
	addrZip?: string | null;
	addrState?: string | null;
	webSuppression?: number | null;
	primarySitus?: number | null;
	streetNum?: string | number | null;
	streetName?: string | null;
	streetPrimary?: string | null;
	fullSitus?: string | null;
	streetPrefix?: string | null;
	streetSuffix?: string | null;
	streetSecondary?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | number | null;
	country?: string | null;
	international?: number | null;
	valueReady?: number | null;
	taxOfficeRef?: string | null;
	confidential?: number | null;
	arbHearing?: string | null;
	relativeScore?: number | null;
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
		// Non-retryable at the *step* level: the step would replay with the
		// same captured token and fail identically. The run loop catches this
		// marker, mints a fresh token, and re-runs the page under a new step
		// name — see TOKEN_EXPIRED_MARKER.
		throw new NonRetryableError(TOKEN_EXPIRED_MARKER);
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

	const rawBody = await res.text();
	let data: {
		totalProperty?: { propertyCount?: number };
		results?: TCADResult[];
	};
	try {
		const parsed: unknown = JSON.parse(rawBody);
		if (typeof parsed !== "object" || parsed === null) {
			throw new TypeError(`Parsed body is not an object: ${typeof parsed}`);
		}
		data = parsed as typeof data;
	} catch (err) {
		// TCAD occasionally returns 200 with an empty/malformed body (or,
		// rarer, valid-but-non-object JSON like `null`) instead of a
		// well-formed empty-results shape, typically for zero-match
		// terms — treat it like the 5xx branch above rather than throwing
		// (which burns 3 retries on a guaranteed-repeat failure and fails
		// the whole job; incident: "Sibu", 2026-08-07).
		console.warn(
			`TCAD API returned unparseable JSON for "${searchTerm}" page ${page}: ` +
				`${getErrorMessage(err)} (body: ${rawBody.slice(0, 200)})`,
		);
		return { properties: [], totalApiResults: null };
	}

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
		pVersion: parseNumericValue(r.pVersion),
		pRollCorr: parseNumericValue(r.pRollCorr),
		pAccountId: parseNumericValue(r.pAccountID),
		latitude: parseNumericValue(r.latitude),
		longitude: parseNumericValue(r.longitude),
		asCode: toStringOrNull(r.asCode),
		block: toStringOrNull(r.block),
		tract: toStringOrNull(r.tract),
		lot: toStringOrNull(r.lot),
		mhSpaceNum: toStringOrNull(r.mhSpaceNum),
		condoUnit: toStringOrNull(r.condoUnit),
		additionalLegal: toStringOrNull(r.additionalLegal),
		legalAcreage: parseNumericValue(r.legalAcreage),
		autoBuildLegal: parseNumericValue(r.autoBuildLegal),
		simpleGeo: toStringOrNull(r.simpleGeo),
		refId1: toStringOrNull(r.refID1),
		refId2: toStringOrNull(r.refID2),
		massCreatedFrom: parseNumericValue(r.massCreatedFrom),
		templateProperty: parseNumericValue(r.templateProperty),
		templateDesc: toStringOrNull(r.templateDesc),
		dba: toStringOrNull(r.dba),
		altDba: toStringOrNull(r.altDBA),
		mortgageCoId: toStringOrNull(r.mortgageCoID),
		mortgageCoAcctId: toStringOrNull(r.mortgageCoAcctID),
		effectiveSizeAcres: parseNumericValue(r.effectiveSizeAcres),
		mapId: toStringOrNull(r.mapID),
		mapsco: toStringOrNull(r.mapsco),
		propReference: parseNumericValue(r.propReference),
		referenceDesc: toStringOrNull(r.referenceDesc),
		active: toStringOrNull(r.active),
		inactive: parseNumericValue(r.inactive),
		inactiveDt: toEpochOrNull(r.inactiveDt),
		propCreateDt: toEpochOrNull(r.propCreateDt),
		apprCompanyId: toStringOrNull(r.apprCompanyID),
		marketArea: toStringOrNull(r.marketArea),
		useCd: toStringOrNull(r.useCd),
		zoning: toStringOrNull(r.zoning),
		sicCd: toStringOrNull(r.sicCd),
		landValue: parseNumericValue(r.landValue),
		improvementValue: parseNumericValue(r.improvementValue),
		landHomesitePct: parseNumericValue(r.landHomesitePct),
		structureHomesitePct: parseNumericValue(r.structureHomesitePct),
		ownerId: parseNumericValue(r.ownerID),
		ownerPct: parseNumericValue(r.ownerPct),
		ownerName: toStringOrNull(r.name),
		nameSecondary: toStringOrNull(r.nameSecondary),
		firstName: toStringOrNull(r.firstName),
		lastName: toStringOrNull(r.lastName),
		spouseFirstName: toStringOrNull(r.spouseFirstName),
		spouseLastName: toStringOrNull(r.spouseLastName),
		confidentialName: toStringOrNull(r.confidentialName),
		addrDeliveryLine: toStringOrNull(r.addrDeliveryLine),
		addrUnitDesignator: toStringOrNull(r.addrUnitDesignator),
		addrCity: toStringOrNull(r.addrCity),
		addrZip: toStringOrNull(r.addrZip),
		addrState: toStringOrNull(r.addrState),
		webSuppression: parseNumericValue(r.webSuppression),
		primarySitus: parseNumericValue(r.primarySitus),
		streetNum: toStringOrNull(r.streetNum),
		streetName: toStringOrNull(r.streetName),
		fullSitus: toStringOrNull(r.fullSitus),
		streetPrefix: toStringOrNull(r.streetPrefix),
		streetSuffix: toStringOrNull(r.streetSuffix),
		streetSecondary: toStringOrNull(r.streetSecondary),
		state: toStringOrNull(r.state),
		zip: toStringOrNull(r.zip),
		country: toStringOrNull(r.country),
		international: parseNumericValue(r.international),
		valueReady: parseNumericValue(r.valueReady),
		taxOfficeRef: toStringOrNull(r.taxOfficeRef),
		confidential: parseNumericValue(r.confidential),
		arbHearing: toStringOrNull(r.arbHearing),
		relativeScore: parseNumericValue(r.relativeScore),
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

/** Trimmed string or null — TCAD sends "" for many absent values. */
function toStringOrNull(
	val: string | number | undefined | null,
): string | null {
	if (val == null) return null;
	const s = String(val).trim();
	return s === "" ? null : s;
}

/**
 * TCAD datetime ("2022-03-10 13:16:43", no timezone — treated as UTC) to
 * an epoch-ms string per the D1 date convention (never store ISO 8601 TEXT).
 */
function toEpochOrNull(val: string | undefined | null): string | null {
	if (!val) return null;
	const ms = Date.parse(`${val.replace(" ", "T")}Z`);
	return Number.isNaN(ms) ? null : String(ms);
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
		buildUpsertStatements(chunk, searchTerm, year, now).map(({ sql, params }) =>
			db.prepare(sql).bind(...params),
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
