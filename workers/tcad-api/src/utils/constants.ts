/**
 * Worker-specific constants. Values shared with the rest of the repo
 * live in utils/constants.ts at the repo root.
 */

// ── TCAD API ────────────────────────────────────────────────────────
export const TCAD_API_URL =
	"https://prod-container.trueprodigyapi.com/public/property/searchfulltext";

// ── Batch upsert ────────────────────────────────────────────────────
// Rows per existing-id probe + batch() call. Must stay ≤ 99 so the
// SELECT ... WHERE property_id IN (...) probe fits D1's 100-param limit.
export const UPSERT_CHUNK_SIZE = 50;

// ── D1 upsert micro-chunking ──────────────────────────────────────
// D1 has a hard limit of 100 bound parameters per query.
// 88 inserted columns per property row since the full TCAD capture
// (migration 0003; id is a client-generated UUID — the column has no SQL
// default), so max 1 row per statement. Still one D1 subrequest per
// batch() call of UPSERT_CHUNK_SIZE statements, so the subrequest budget
// is unchanged.
export const D1_MAX_BOUND_PARAMS = 100;
export const UPSERT_COLUMNS = 88;
export const UPSERT_MICRO_CHUNK_SIZE = Math.floor(
	D1_MAX_BOUND_PARAMS / UPSERT_COLUMNS,
);

// ── Cache TTL ───────────────────────────────────────────────────────
export const RESPONSE_CACHE_TTL_SECONDS = 300;
export const TOKEN_CACHE_TTL_SECONDS = 270;
