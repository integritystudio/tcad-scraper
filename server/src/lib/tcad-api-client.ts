/**
 * TCAD API Client — pure Node.js fetch, no Playwright dependency.
 *
 * Replicates the browser-injected script logic from tcad-scraper.ts
 * so scrape jobs can run on hosts without a Chromium binary.
 */

import type { PropertyData } from "../types";

// ── Types ──────────────────────────────────────────────────────────────

export interface TCADApiResponse {
  totalCount: number;
  results: TCADPropertyResult[];
  pageSize: number;
}

export interface TCADPropertyResult {
  pid?: number;
  displayName?: string;
  propType?: string;
  city?: string;
  streetPrimary?: string;
  assessedValue?: string | number;
  appraisedValue?: string | number;
  geoID?: string;
  legalDescription?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

const API_URL =
  "https://prod-container.trueprodigyapi.com/public/property/searchfulltext";

const PAGE_SIZES = [1000, 500, 100, 50] as const;
const MAX_PAGES = 100;
const RATE_LIMIT_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTruncated(text: string): boolean {
  const last = text.trim().at(-1);
  return last !== "}" && last !== "]";
}

function buildBody(tcadYear: number | string, searchTerm: string): string {
  return JSON.stringify({
    pYear: { operator: "=", value: String(tcadYear) },
    fullTextSearch: { operator: "match", value: searchTerm },
  });
}

// ── Core fetch ─────────────────────────────────────────────────────────

async function fetchPage(
  token: string,
  searchTerm: string,
  tcadYear: number | string,
  page: number,
  pageSize: number,
): Promise<{ data: { totalProperty?: { propertyCount?: number }; results?: TCADPropertyResult[] }; raw: string }> {
  const url = `${API_URL}?page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: buildBody(tcadYear, searchTerm),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("HTTP 401 TOKEN_EXPIRED");
    if (res.status === 409) throw new Error("HTTP 409 RATE_LIMITED");
    if (res.status === 504) throw new Error("HTTP 504 GATEWAY_TIMEOUT");
    throw new Error(`HTTP ${res.status}`);
  }

  const raw = await res.text();
  const trimmed = raw.trim();

  if (trimmed.length > 0 && isTruncated(trimmed)) {
    throw new Error("TRUNCATED");
  }

  const data = JSON.parse(trimmed) as {
    totalProperty?: { propertyCount?: number };
    results?: TCADPropertyResult[];
  };
  return { data, raw: trimmed };
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Fetch TCAD properties using native Node.js fetch.
 *
 * Mirrors the browser-injected script behaviour:
 * - Adaptive page sizes: tries 1000 → 500 → 100 → 50
 * - Pagination with 1 s delay (max 100 pages)
 * - Truncation detection → fall back to smaller page size
 * - 401 → TOKEN_EXPIRED; 409 → wait + retry/downsize; 504 → wait + retry/downsize
 */
export async function fetchTCADProperties(
  token: string,
  searchTerm: string,
  tcadYear: number | string,
): Promise<TCADApiResponse> {
  let lastError = "";

  for (const pageSize of PAGE_SIZES) {
    const allResults: TCADPropertyResult[] = [];
    let totalCount = 0;
    let downsized = false;

    try {
      // First page
      const first = await fetchPage(token, searchTerm, tcadYear, 1, pageSize);
      totalCount = first.data.totalProperty?.propertyCount ?? 0;
      const firstResults = first.data.results ?? [];
      allResults.push(...firstResults);

      if (allResults.length >= totalCount || firstResults.length < pageSize) {
        return { totalCount, results: allResults, pageSize };
      }

      // Remaining pages
      for (let page = 2; page <= MAX_PAGES; page++) {
        if (allResults.length >= totalCount) break;

        await sleep(RATE_LIMIT_DELAY_MS);

        try {
          const next = await fetchPage(token, searchTerm, tcadYear, page, pageSize);
          const pageResults = next.data.results ?? [];
          allResults.push(...pageResults);

          if (pageResults.length < pageSize || allResults.length >= totalCount) {
            break;
          }
        } catch (pageErr) {
          const msg = (pageErr as Error).message;

          if (msg === "TRUNCATED" || msg.includes("JSON")) {
            downsized = true;
            lastError = msg;
            break; // fall through to try smaller page size
          }
          if (msg.includes("TOKEN_EXPIRED")) {
            throw new Error("TOKEN_EXPIRED: Authorization token expired, needs refresh");
          }
          if (msg.includes("409") || msg.includes("RATE_LIMITED")) {
            await sleep(RATE_LIMIT_DELAY_MS * 2);
            // Retry same page
            page--;
            continue;
          }
          if (msg.includes("504") || msg.includes("GATEWAY_TIMEOUT")) {
            await sleep(RATE_LIMIT_DELAY_MS * 5);
            // Retry same page
            page--;
            continue;
          }
          throw pageErr;
        }
      }

      if (!downsized) {
        return { totalCount, results: allResults, pageSize };
      }
    } catch (err) {
      const msg = (err as Error).message;

      if (msg === "TRUNCATED" || msg.includes("JSON")) {
        lastError = msg;
        continue; // try smaller page size
      }
      if (msg.includes("TOKEN_EXPIRED")) {
        throw new Error("TOKEN_EXPIRED: Authorization token expired, needs refresh");
      }
      if (msg.includes("409") || msg.includes("RATE_LIMITED")) {
        await sleep(RATE_LIMIT_DELAY_MS * 3);
        lastError = msg;
        continue; // try smaller page size
      }
      if (msg.includes("504") || msg.includes("GATEWAY_TIMEOUT")) {
        await sleep(RATE_LIMIT_DELAY_MS * 5);
        lastError = msg;
        continue; // try smaller page size
      }
      throw err;
    }
  }

  throw new Error(`All page sizes failed. Last: ${lastError}`);
}

/**
 * Map a single TCAD API result to PropertyData.
 */
export function mapTCADResultToPropertyData(r: TCADPropertyResult): PropertyData {
  return {
    propertyId: r.pid?.toString() ?? "",
    name: r.displayName ?? "",
    propType: r.propType ?? "",
    city: r.city ?? null,
    propertyAddress: r.streetPrimary ?? "",
    assessedValue:
      typeof r.assessedValue === "number"
        ? r.assessedValue
        : parseFloat(String(r.assessedValue || 0)),
    appraisedValue:
      typeof r.appraisedValue === "number"
        ? r.appraisedValue
        : parseFloat(String(r.appraisedValue || 0)),
    geoId: r.geoID ?? null,
    description: r.legalDescription ?? null,
  };
}
