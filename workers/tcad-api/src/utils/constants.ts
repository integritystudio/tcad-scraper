/**
 * Worker constants — subset of server/src/utils/constants.ts
 * that are needed in the Cloudflare Worker context.
 */

// ── TCAD year ───────────────────────────────────────────────────────
export const DEFAULT_TCAD_YEAR = 2025;

// ── Default limits ──────────────────────────────────────────────────
export const DEFAULT_QUERY_LIMIT = 100;

// ── TCAD API ────────────────────────────────────────────────────────
export const TCAD_API_URL =
	"https://prod-container.trueprodigyapi.com/public/property/searchfulltext";

// ── Batch upsert ────────────────────────────────────────────────────
export const UPSERT_CHUNK_SIZE = 50;

// ── D1 upsert micro-chunking ──────────────────────────────────────
// D1 has a hard limit of 100 bound parameters per query.
// With 15 columns per property row (includes id), max 6 rows per statement (6 × 15 = 90).
const D1_MAX_BOUND_PARAMS = 100;
export const UPSERT_COLUMNS = 15;
export const UPSERT_MICRO_CHUNK_SIZE = Math.floor(
	D1_MAX_BOUND_PARAMS / UPSERT_COLUMNS,
);

// ── Cache TTL ───────────────────────────────────────────────────────
export const RESPONSE_CACHE_TTL_SECONDS = 300;
export const TOKEN_CACHE_TTL_SECONDS = 270;

// ── Formatting ──────────────────────────────────────────────────────
export const PERCENT_MULTIPLIER = 100;
export const COST_DECIMAL_PLACES = 6;
