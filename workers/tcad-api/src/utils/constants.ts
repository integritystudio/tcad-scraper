/**
 * Worker constants — subset of server/src/utils/constants.ts
 * that are needed in the Cloudflare Worker context.
 */

// ── TCAD year ───────────────────────────────────────────────────────
export const DEFAULT_TCAD_YEAR = 2025;

// ── Default limits ──────────────────────────────────────────────────
export const DEFAULT_QUERY_LIMIT = 100;
export const DEFAULT_RETRY_DELAY_MS = 2000;

// ── HTTP status codes ───────────────────────────────────────────────
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  GATEWAY_TIMEOUT: 504,
} as const;

// ── TCAD API ────────────────────────────────────────────────────────
export const TCAD_API_URL =
  "https://prod-container.trueprodigyapi.com/public/property/searchfulltext";

export const FETCH_TIMEOUT_MS = 30_000;
export const PAGE_SIZES = [1000, 500, 100, 50] as const;
export const MAX_PAGES = 100;

// ── Batch upsert ────────────────────────────────────────────────────
export const UPSERT_CHUNK_SIZE = 500;

// ── D1 upsert micro-chunking ──────────────────────────────────────
// D1 has a hard limit of 100 bound parameters per query.
// With 14 columns per property row, max 7 rows per statement (7 × 14 = 98).
const D1_MAX_BOUND_PARAMS = 100;
export const UPSERT_COLUMNS = 14;
export const UPSERT_MICRO_CHUNK_SIZE = Math.floor(D1_MAX_BOUND_PARAMS / UPSERT_COLUMNS);

// ── Cache TTL ───────────────────────────────────────────────────────
export const RESPONSE_CACHE_TTL_SECONDS = 300;
export const TOKEN_CACHE_TTL_SECONDS = 270;

// ── Formatting ──────────────────────────────────────────────────────
export const PERCENT_MULTIPLIER = 100;
export const COST_DECIMAL_PLACES = 6;
