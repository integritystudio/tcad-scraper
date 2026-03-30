/**
 * ScraperWorkflow — Cloudflare Workflow replacing Bull queue processor.
 * Ported from server/src/queues/scraper.queue.ts.
 *
 * Steps:
 *  1. get-token     — fetch auth token from KV or token worker
 *  2. fetch-props   — paginated TCAD API calls
 *  3. deduplicate   — remove duplicate propertyIds
 *  4. upsert        — bulk upsert to D1 via micro-chunked prepared statements
 *  5. analytics     — update search_term_analytics
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "../bindings";
import { createPrisma } from "../db";
import { TCAD_API_URL, UPSERT_CHUNK_SIZE, UPSERT_MICRO_CHUNK_SIZE } from "../utils/constants";
import type { PropertyData, ScrapeParams } from "../types/property.types";
import { fetchResultSchema, upsertResultSchema } from "../types/property.types";

export class ScraperWorkflow extends WorkflowEntrypoint<Env, ScrapeParams> {
  async run(event: WorkflowEvent<ScrapeParams>, step: WorkflowStep) {
    const { searchTerm, year } = event.payload;

    // Step 1: Create job record + get auth token
    const { jobId, token } = await step.do("get-token", async () => {
      const prisma = createPrisma(this.env.DB);
      const job = await prisma.scrapeJob.create({
        data: {
          searchTerm,
          status: "processing",
          startedAt: new Date().toISOString(),
        },
      });

      // Try KV cache first, fall back to token worker
      // Phase 3: const cached = await this.env.TOKEN_CACHE.get("tcad-token");
      const res = await fetch(this.env.TOKEN_WORKER_URL, {
        headers: { Authorization: `Bearer ${this.env.TOKEN_WORKER_SECRET}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Token worker returned ${res.status}`);
      const { token } = (await res.json()) as { token: string; expiresIn: number };
      // Phase 3: await this.env.TOKEN_CACHE.put("tcad-token", token, { expirationTtl: expiresIn - 30 });

      return { jobId: job.id, token };
    });

    // Step 2: Fetch properties from TCAD API (paginated, stored in KV)
    const fetchResult = await step.do("fetch-properties", {
      retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
      timeout: "120 seconds",
    }, async () => {
      const properties = await fetchTCADProperties(token, searchTerm, year);
      const kvKey = `scrape:${jobId}:properties`;
      await this.env.RESPONSE_CACHE.put(kvKey, JSON.stringify(properties), { expirationTtl: 3600 });
      return fetchResultSchema.parse({
        kvKey,
        count: properties.length,
        totalApiResults: properties.reduce((sum, p) => sum + (p.propertyId ? 1 : 0), 0),
      });
    });

    // Step 3: Deduplicate (retrieve from KV)
    const properties = await step.do("deduplicate", async () => {
      const stored = await this.env.RESPONSE_CACHE.get(fetchResult.kvKey);
      if (!stored) throw new Error(`KV key ${fetchResult.kvKey} not found`);
      const rawProperties = JSON.parse(stored) as PropertyData[];
      const map = new Map<string, PropertyData>();
      for (const prop of rawProperties) {
        if (prop.propertyId) map.set(prop.propertyId, prop);
      }
      return Array.from(map.values());
    });

    // Step 4: Upsert to database (chunked)
    const upsertResult = await step.do("upsert-properties", async () => {
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

    // Step 5: Update job record + analytics
    await step.do("update-analytics", async () => {
      const prisma = createPrisma(this.env.DB);
      const now = new Date().toISOString();

      await prisma.scrapeJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          resultCount: upsertResult.savedCount,
          totalApiResults: upsertResult.totalApiResults,
          updatedCount: upsertResult.updatedCount,
          newPropertyIds: JSON.stringify(upsertResult.newPropertyIds),
          completedAt: now,
        },
      });

      // Upsert search term analytics
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
    });

    return upsertResult;
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

async function fetchTCADProperties(
  token: string,
  searchTerm: string,
  year: number,
): Promise<PropertyData[]> {
  const allProperties: PropertyData[] = [];
  const pageSize = 1000;
  let totalCount = 0;
  const maxPages = 100;
  const rateLimitDelayMs = 1000;

  for (let page = 1; page <= maxPages; page++) {
    const url = `${TCAD_API_URL}?page=${page}&pageSize=${pageSize}`;
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
      signal: AbortSignal.timeout(30_000),
    });

    if (res.status === 401) {
      throw new Error("TOKEN_EXPIRED");
    }

    if (res.status === 500 || res.status === 502 || res.status === 503) {
      console.warn(`TCAD API returned ${res.status} for "${searchTerm}" page ${page}`);
      return allProperties;
    }

    if (!res.ok) {
      throw new Error(`TCAD API returned ${res.status}`);
    }

    const data = (await res.json()) as {
      totalProperty?: { propertyCount?: number };
      results?: TCADResult[];
    };

    if (page === 1) {
      totalCount = data.totalProperty?.propertyCount ?? 0;
    }
    const results = data.results ?? [];

    for (const r of results) {
      allProperties.push({
        propertyId: String(r.pid ?? ""),
        name: r.displayName ?? "",
        propType: r.propType ?? "",
        city: r.city ?? null,
        propertyAddress: r.streetPrimary ?? "",
        assessedValue: parseNumericValue(r.marketValue),
        appraisedValue: parseNumericValue(r.appraisedValue) ?? 0,
        geoId: r.geoID ?? null,
        description: r.legalDescription ?? null,
      });
    }

    if (results.length < pageSize || allProperties.length >= totalCount) break;

    // Rate limit delay between pagination requests
    if (page < maxPages) {
      await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs));
    }
  }

  return allProperties;
}

function parseNumericValue(val: string | number | undefined | null): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const cleaned = val.replace(/[,$]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

// ── D1 bulk upsert (replaces PostgreSQL $queryRawUnsafe) ────────────

/**
 * D1 bulk upsert — replaces PostgreSQL $queryRawUnsafe approach.
 *
 * Constraints:
 *  - D1 max 100 bound params per query
 *  - 14 columns per row = max 7 rows per statement (7 x 14 = 98)
 *  - No xmax for insert/update detection — use pre-query EXISTS check
 *
 * Strategy:
 *  1. Query existing property_ids for this batch to detect new vs updated
 *  2. Execute INSERT...ON CONFLICT in 7-row micro-chunks via db.batch()
 *  3. Return new/updated counts based on pre-query diff
 */
async function bulkUpsert(
  db: D1Database,
  chunk: PropertyData[],
  searchTerm: string,
  year: number,
): Promise<{ savedCount: number; updatedCount: number; newPropertyIds: string[] }> {
  const now = new Date().toISOString();

  // Step 1: Find which property_ids already exist (for new vs update tracking)
  const existingIds = new Set<string>();
  const idChunks = chunkArray(chunk.map(p => p.propertyId), 50);
  for (const idChunk of idChunks) {
    const placeholders = idChunk.map(() => "?").join(", ");
    const result = await db
      .prepare(`SELECT property_id FROM properties WHERE year = ? AND property_id IN (${placeholders})`)
      .bind(year, ...idChunk)
      .all<{ property_id: string }>();
    for (const row of result.results) {
      existingIds.add(row.property_id);
    }
  }

  // Step 2: Upsert in micro-chunks of 7 rows
  const microChunks = chunkArray(chunk, UPSERT_MICRO_CHUNK_SIZE);
  const statements: D1PreparedStatement[] = [];

  for (const micro of microChunks) {
    const placeholders = micro
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");

    const params: (string | number | null)[] = [];
    for (const prop of micro) {
      params.push(
        prop.propertyId,
        prop.name,
        prop.propType,
        prop.city,
        prop.propertyAddress,
        prop.assessedValue,
        prop.appraisedValue ?? 0,
        prop.geoId,
        prop.description,
        searchTerm,
        year,
        now,
        now,
        now,
      );
    }

    statements.push(
      db.prepare(`
        INSERT INTO properties (
          property_id, name, prop_type, city, property_address,
          assessed_value, appraised_value, geo_id, description,
          search_term, year, scraped_at, created_at, updated_at
        )
        VALUES ${placeholders}
        ON CONFLICT (property_id, year) DO UPDATE SET
          name = excluded.name,
          prop_type = excluded.prop_type,
          city = excluded.city,
          property_address = excluded.property_address,
          assessed_value = excluded.assessed_value,
          appraised_value = excluded.appraised_value,
          geo_id = excluded.geo_id,
          description = excluded.description,
          search_term = excluded.search_term,
          scraped_at = excluded.scraped_at,
          updated_at = excluded.updated_at
      `).bind(...params)
    );
  }

  // D1 batch() executes all statements in a single transaction
  if (statements.length > 0) {
    await db.batch(statements);
  }

  // Step 3: Calculate new vs updated from pre-query diff
  const newPropertyIds = chunk
    .map(p => p.propertyId)
    .filter(id => !existingIds.has(id));

  return {
    savedCount: newPropertyIds.length,
    updatedCount: chunk.length - newPropertyIds.length,
    newPropertyIds,
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
