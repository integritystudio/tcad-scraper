/**
 * TCAD API Client — pure Node.js fetch, no Playwright dependency.
 *
 * Replicates the browser-injected script logic from tcad-scraper.ts
 * so scrape jobs can run on hosts without a Chromium binary.
 */

import logger from "./logger";
import { getErrorMessage } from "../utils/error-helpers";
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
  // TCAD API returns marketValue, not assessedValue
  marketValue?: string | number;
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
const FETCH_RETRIES = 1;
const FETCH_RETRY_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 30_000;
const JITTER_FACTOR = 0.5;

const RESPONSE_ERROR = {
  EMPTY: "EMPTY_RESPONSE",
  HTML: "HTML_RESPONSE",
  TRUNCATED: "TRUNCATED",
  PARSE_FAILED: "JSON_PARSE_FAILED",
} as const;

const HTTP_ERROR = {
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  RATE_LIMITED: "RATE_LIMITED",
  GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT",
} as const;

const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  GATEWAY_TIMEOUT: 504,
} as const;

/** Delay multipliers for rate-limit and gateway-timeout back-off. */
const RATE_LIMIT_BACKOFF_MULTIPLIER = 2;
const RATE_LIMIT_FIRST_PAGE_MULTIPLIER = 3;
const GATEWAY_TIMEOUT_MULTIPLIER = 5;

const CONTENT_LENGTH_UNKNOWN = "unknown";
const BODY_PREVIEW_HEAD = 100;
const BODY_PREVIEW_TAIL = 30;

/** Response content errors that are worth retrying (transient). */
const RETRYABLE_ERRORS = [
  RESPONSE_ERROR.TRUNCATED,
  RESPONSE_ERROR.PARSE_FAILED,
  RESPONSE_ERROR.EMPTY,
] as const;

function sanitizeLogField(value: string, maxLen = 200): string {
  return value.slice(0, maxLen).replace(/[\r\n\t]/g, " ");
}

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

function isRetryableError(msg: string): boolean {
  return RETRYABLE_ERRORS.some((prefix) => msg.startsWith(prefix));
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const msg = getErrorMessage(err);
  const cause = (err as TypeError & { cause?: Error }).cause;
  const causeMsg = cause ? getErrorMessage(cause) : "";
  return (
    msg.includes("fetch failed") ||
    causeMsg.includes("ECONNRESET") ||
    causeMsg.includes("ECONNREFUSED") ||
    causeMsg.includes("UND_ERR")
  );
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
  const fetchStart = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: buildBody(tcadYear, searchTerm),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const fetchMs = Date.now() - fetchStart;

  if (!res.ok) {
    if (res.status === HTTP_STATUS.UNAUTHORIZED) throw new Error(`HTTP ${HTTP_STATUS.UNAUTHORIZED} ${HTTP_ERROR.TOKEN_EXPIRED}`);
    if (res.status === HTTP_STATUS.CONFLICT) throw new Error(`HTTP ${HTTP_STATUS.CONFLICT} ${HTTP_ERROR.RATE_LIMITED}`);
    if (res.status === HTTP_STATUS.GATEWAY_TIMEOUT) throw new Error(`HTTP ${HTTP_STATUS.GATEWAY_TIMEOUT} ${HTTP_ERROR.GATEWAY_TIMEOUT}`);
    throw new Error(`HTTP ${res.status}`);
  }

  const contentLength = res.headers.get("content-length") ?? CONTENT_LENGTH_UNKNOWN;
  const raw = await res.text();
  const trimmed = raw.trim();

  // P1: Content-Length mismatch detection (byte-accurate)
  if (contentLength !== CONTENT_LENGTH_UNKNOWN) {
    const declaredBytes = parseInt(contentLength, 10);
    const actualBytes = Buffer.byteLength(raw, "utf-8");
    if (!isNaN(declaredBytes) && actualBytes < declaredBytes) {
      throw new Error(
        `${RESPONSE_ERROR.TRUNCATED} (page=${page}, pageSize=${pageSize}, declaredBytes=${declaredBytes}, actualBytes=${actualBytes}, fetchMs=${fetchMs})`,
      );
    }
  }

  if (trimmed.length === 0) {
    throw new Error(
      `${RESPONSE_ERROR.EMPTY} (page=${page}, pageSize=${pageSize}, rawLen=${raw.length}, fetchMs=${fetchMs})`,
    );
  }

  // Detect HTML error pages (TCAD sometimes returns HTML on server errors)
  if (trimmed.startsWith("<")) {
    const preview = trimmed.slice(0, BODY_PREVIEW_HEAD).replace(/[\r\n\t]/g, " ");
    throw new Error(
      `${RESPONSE_ERROR.HTML} (page=${page}, pageSize=${pageSize}, len=${trimmed.length}, fetchMs=${fetchMs}, preview=${preview})`,
    );
  }

  if (isTruncated(trimmed)) {
    throw new Error(
      `${RESPONSE_ERROR.TRUNCATED} (page=${page}, pageSize=${pageSize}, len=${trimmed.length}, fetchMs=${fetchMs}, last=${trimmed.slice(-BODY_PREVIEW_TAIL)})`,
    );
  }

  try {
    const data = JSON.parse(trimmed) as {
      totalProperty?: { propertyCount?: number };
      results?: TCADPropertyResult[];
    };
    return { data, raw: trimmed };
  } catch (parseErr) {
    logger.warn(
      {
        page,
        pageSize,
        searchTerm: sanitizeLogField(searchTerm),
        bodyLen: trimmed.length,
        contentLength,
        fetchMs,
        bodyFirst: sanitizeLogField(trimmed.slice(0, BODY_PREVIEW_HEAD)),
        bodyLast: sanitizeLogField(trimmed.slice(-BODY_PREVIEW_TAIL)),
        parseError: (parseErr as Error).message,
      },
      "JSON parse failed",
    );
    throw new Error(
      `${RESPONSE_ERROR.PARSE_FAILED} (page=${page}, pageSize=${pageSize}, len=${trimmed.length}, fetchMs=${fetchMs}, ` +
      `contentLength=${contentLength}, first=${sanitizeLogField(trimmed.slice(0, BODY_PREVIEW_HEAD))}, last=${sanitizeLogField(trimmed.slice(-BODY_PREVIEW_TAIL))}, err=${(parseErr as Error).message})`,
    );
  }
}

// ── Retry wrapper ─────────────────────────────────────────────────────

async function fetchPageWithRetry(
  token: string,
  searchTerm: string,
  tcadYear: number | string,
  page: number,
  pageSize: number,
): Promise<ReturnType<typeof fetchPage>> {
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const result = await fetchPage(token, searchTerm, tcadYear, page, pageSize);
      if (attempt > 0) {
        logger.info(
          { page, pageSize, searchTerm: sanitizeLogField(searchTerm), attempt },
          "Fetch retry succeeded",
        );
      }
      return result;
    } catch (err) {
      const msg = getErrorMessage(err);
      const retryable = isRetryableError(msg) || isNetworkError(err);

      if (!retryable || attempt >= FETCH_RETRIES) {
        throw err;
      }

      const jitter = Math.random() * FETCH_RETRY_DELAY_MS * JITTER_FACTOR;
      const delay = FETCH_RETRY_DELAY_MS + jitter;
      logger.warn(
        { page, pageSize, searchTerm: sanitizeLogField(searchTerm), attempt, delayMs: Math.round(delay), errorMsg: sanitizeLogField(msg) },
        "Retrying fetch (same page size)",
      );
      await sleep(delay);
    }
  }
  // Unreachable — loop always throws or returns
  throw new Error("fetchPageWithRetry: unreachable");
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Fetch TCAD properties using native Node.js fetch.
 *
 * Mirrors the browser-injected script behaviour:
 * - Adaptive page sizes: tries 1000 → 500 → 100 → 50
 * - Per-fetch retry with jittered delay before page-size fallback
 * - Pagination with 1 s delay (max 100 pages)
 * - Truncation detection → fall back to smaller page size
 * - 401 → TOKEN_EXPIRED; 409 → wait + retry/downsize; 504 → wait + retry/downsize
 */
export async function fetchTCADProperties(
  token: string,
  searchTerm: string,
  tcadYear: number | string,
): Promise<TCADApiResponse> {
  const errors: string[] = [];

  for (const pageSize of PAGE_SIZES) {
    const allResults: TCADPropertyResult[] = [];
    let totalCount = 0;
    let downsized = false;
    let truncatedAtPage = -1;

    try {
      // First page
      const first = await fetchPageWithRetry(token, searchTerm, tcadYear, 1, pageSize);
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
          const next = await fetchPageWithRetry(token, searchTerm, tcadYear, page, pageSize);
          const pageResults = next.data.results ?? [];
          allResults.push(...pageResults);

          if (pageResults.length < pageSize || allResults.length >= totalCount) {
            break;
          }
        } catch (pageErr) {
          const msg = getErrorMessage(pageErr);

          if (
            msg.startsWith(RESPONSE_ERROR.TRUNCATED) ||
            msg.startsWith(RESPONSE_ERROR.PARSE_FAILED) ||
            msg.startsWith(RESPONSE_ERROR.EMPTY) ||
            msg.startsWith(RESPONSE_ERROR.HTML)
          ) {
            logger.warn(
              { page, pageSize, searchTerm: sanitizeLogField(searchTerm), errorMsg: sanitizeLogField(msg) },
              "Response error during pagination",
            );
            downsized = true;
            truncatedAtPage = page;
            errors.push(`pageSize=${pageSize}: ${msg}`);
            break; // fall through to try smaller page size
          }
          if (msg.includes(HTTP_ERROR.TOKEN_EXPIRED)) {
            throw new Error(`${HTTP_ERROR.TOKEN_EXPIRED}: Authorization token expired, needs refresh`);
          }
          if (msg.includes(String(HTTP_STATUS.CONFLICT)) || msg.includes(HTTP_ERROR.RATE_LIMITED)) {
            await sleep(RATE_LIMIT_DELAY_MS * RATE_LIMIT_BACKOFF_MULTIPLIER);
            // Retry same page
            page--;
            continue;
          }
          if (msg.includes(String(HTTP_STATUS.GATEWAY_TIMEOUT)) || msg.includes(HTTP_ERROR.GATEWAY_TIMEOUT)) {
            await sleep(RATE_LIMIT_DELAY_MS * GATEWAY_TIMEOUT_MULTIPLIER);
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

      // Mid-pagination truncation: return partial results instead of
      // discarding them and trying a smaller page size from scratch.
      if (allResults.length > 0) {
        logger.warn(
          { page: truncatedAtPage, pageSize, collected: allResults.length, totalCount, searchTerm: sanitizeLogField(searchTerm) },
          "Mid-pagination truncation, returning partial results",
        );
        return { totalCount, results: allResults, pageSize };
      }
    } catch (err) {
      const msg = getErrorMessage(err);

      if (
        msg.startsWith(RESPONSE_ERROR.TRUNCATED) ||
        msg.startsWith(RESPONSE_ERROR.PARSE_FAILED) ||
        msg.startsWith(RESPONSE_ERROR.EMPTY) ||
        msg.startsWith(RESPONSE_ERROR.HTML)
      ) {
        logger.warn(
          { pageSize, searchTerm: sanitizeLogField(searchTerm), errorMsg: sanitizeLogField(msg) },
          "First-page response error",
        );
        errors.push(`pageSize=${pageSize}: ${msg}`);
        continue; // try smaller page size
      }
      if (msg.includes(HTTP_ERROR.TOKEN_EXPIRED)) {
        throw new Error(`${HTTP_ERROR.TOKEN_EXPIRED}: Authorization token expired, needs refresh`);
      }
      if (msg.includes(String(HTTP_STATUS.CONFLICT)) || msg.includes(HTTP_ERROR.RATE_LIMITED)) {
        await sleep(RATE_LIMIT_DELAY_MS * RATE_LIMIT_FIRST_PAGE_MULTIPLIER);
        errors.push(`pageSize=${pageSize}: ${msg}`);
        continue; // try smaller page size
      }
      if (msg.includes(String(HTTP_STATUS.GATEWAY_TIMEOUT)) || msg.includes(HTTP_ERROR.GATEWAY_TIMEOUT)) {
        await sleep(RATE_LIMIT_DELAY_MS * GATEWAY_TIMEOUT_MULTIPLIER);
        errors.push(`pageSize=${pageSize}: ${msg}`);
        continue; // try smaller page size
      }
      throw err;
    }
  }

  throw new Error(
    `All page sizes failed (${errors.length} attempts). Errors: ${errors.join(" | ")}`,
  );
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
    // TCAD API returns marketValue; we store it as assessedValue
    assessedValue:
      typeof r.marketValue === "number"
        ? r.marketValue
        : parseFloat(String(r.marketValue || 0)),
    appraisedValue:
      typeof r.appraisedValue === "number"
        ? r.appraisedValue
        : parseFloat(String(r.appraisedValue || 0)),
    geoId: r.geoID ?? null,
    description: r.legalDescription ?? null,
  };
}
