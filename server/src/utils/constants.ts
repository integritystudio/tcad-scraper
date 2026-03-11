/**
 * Server-side numeric constants
 *
 * Eliminates magic numbers across the server codebase.
 * Shared constants are imported from root utils/constants.ts
 * and re-exported so server code can import from one place.
 */

import { DEFAULT_RETRY_DELAY_MS } from "../../../utils/constants";

// ── Re-exported from root utils/constants.ts ────────────────────────
export {
  COST_DECIMAL_PLACES,
  DEFAULT_LOOKBACK_DAYS,
  DEFAULT_QUERY_LIMIT,
  DEFAULT_RATE_LIMIT_DELAY_MS,
  DEFAULT_RETRY_DELAY_MS,
  MIN_TERM_LENGTH,
  MS_PER_MINUTE,
  PERCENT_MULTIPLIER,
  PROGRESS_LOG_INTERVAL,
  QUEUE_RETENTION_DAYS,
  REDIS_AVAILABILITY_TIMEOUT_MS,
  SCRAPE_JOB_RETENTION_DAYS,
  SECONDS_PER_MINUTE,
} from "../../../utils/constants";

// ── Server-only limits & intervals ──────────────────────────────────
export const FETCH_TIMEOUT_MS = 30_000;
export const FETCH_RETRIES = 1;
export const GATEWAY_TIMEOUT_MULTIPLIER = 5;
export const SHORT_RATE_LIMIT_DELAY_MS = 1000;
export const RATE_LIMIT_BACKOFF_MULTIPLIER = 2;
export const RATE_LIMIT_FIRST_PAGE_MULTIPLIER = 3;

export const CONTENT_LENGTH_UNKNOWN = "unknown";
export const BODY_PREVIEW_HEAD = 100;
export const BODY_PREVIEW_TAIL = 30;
export const DEFAULT_MAX_PAGES = 100;
export const PAGE_SIZES = [1000, 500, DEFAULT_MAX_PAGES, 50] as const;
export const MAX_PAGES = DEFAULT_MAX_PAGES;
export const RATE_LIMIT_DELAY_MS = SHORT_RATE_LIMIT_DELAY_MS;
export const FETCH_RETRY_DELAY_MS = DEFAULT_RETRY_DELAY_MS;

export const JITTER_FACTOR = 0.5;
export const TOKEN_FETCH_TIMEOUT_MS = 10_000;
export const MAX_CONSECUTIVE_ZERO_BATCHES = 5;
export const SCRAPE_JOB_ATTEMPTS = 5;
export const SCRAPE_BACKOFF_DELAY_MS = 5000;

export const API_URL =
  "https://prod-container.trueprodigyapi.com/public/property/searchfulltext";

export const RESPONSE_ERROR = {
  EMPTY: "EMPTY_RESPONSE",
  HTML: "HTML_RESPONSE",
  TRUNCATED: "TRUNCATED",
  PARSE_FAILED: "JSON_PARSE_FAILED",
} as const;

export const HTTP_ERROR = {
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  RATE_LIMITED: "RATE_LIMITED",
  GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT",
} as const;

export const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  GATEWAY_TIMEOUT: 504,
} as const;

/** Response content errors that are worth retrying (transient). */
export const RETRYABLE_ERRORS = [
  RESPONSE_ERROR.TRUNCATED,
  RESPONSE_ERROR.PARSE_FAILED,
  RESPONSE_ERROR.EMPTY,
] as const;

