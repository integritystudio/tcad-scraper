/**
 * Server-side numeric constants
 *
 * Eliminates magic numbers across the server codebase.
 * Mirrors values from root utils/constants.ts for items
 * that are also used by non-server code.
 */

// ── Formatting ─────────────────────────────────────────────────────
export const PERCENT_MULTIPLIER = 100;
export const COST_DECIMAL_PLACES = 6;

// ── Default limits & intervals ─────────────────────────────────────
export const DEFAULT_LOOKBACK_DAYS = 7;
export const DEFAULT_QUERY_LIMIT = 100;
export const DEFAULT_RETRY_DELAY_MS = 2000;
export const DEFAULT_RATE_LIMIT_DELAY_MS = 5000;
export const FETCH_TIMEOUT_MS = 30_000;
export const FETCH_RETRIES = 1;
export const GATEWAY_TIMEOUT_MULTIPLIER = 5;
export const SHORT_RATE_LIMIT_DELAY_MS = 1000;
export const RATE_LIMIT_BACKOFF_MULTIPLIER = 2;
export const RATE_LIMIT_FIRST_PAGE_MULTIPLIER = 3;

export const PROGRESS_LOG_INTERVAL = 100;
export const CONTENT_LENGTH_UNKNOWN = "unknown";
export const BODY_PREVIEW_HEAD = 100;
export const BODY_PREVIEW_TAIL = 30;
export const DEFAULT_MAX_PAGES = 100;
export const PAGE_SIZES = [1000, 500, DEFAULT_MAX_PAGES, 50] as const;
export const MAX_PAGES = DEFAULT_MAX_PAGES;
export const RATE_LIMIT_DELAY_MS = SHORT_RATE_LIMIT_DELAY_MS;
export const FETCH_RETRY_DELAY_MS = DEFAULT_RETRY_DELAY_MS;

export const JITTER_FACTOR = 0.5;
// ── Term generation (mirrored from root utils/constants.ts) ────────
export const MIN_TERM_LENGTH = 4;

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
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  GATEWAY_TIMEOUT: 504,
} as const;

/** Response content errors that are worth retrying (transient). */
export const RETRYABLE_ERRORS = [
  RESPONSE_ERROR.TRUNCATED,
  RESPONSE_ERROR.PARSE_FAILED,
  RESPONSE_ERROR.EMPTY,
] as const;

