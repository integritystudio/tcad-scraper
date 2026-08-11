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

// ── Deduped-rows KV chunking ────────────────────────────────────────
// Rows per KV value in the workflow's deduplicate step. A single KV value is
// capped at 25 MiB; the full 88-column TCAD capture runs ~1.7 KB per row, so
// "blvd" (~17k rows for the 2026 roll) serialized to 28.8 MB and failed the
// job outright (incident 2026-08-08). 2,000 rows is ~3.4 MB — an order of
// magnitude of headroom, so a term matching several times wider than any seen
// so far still fits.
export const DEDUPE_KV_CHUNK_SIZE = 2_000;

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

// ── Query page size ─────────────────────────────────────────────────
// The FTS keyword fallback pages in SQL and hands the resulting ids to a
// data-fetch of `id IN (...) AND year = ?`, so a page cannot exceed D1's
// 100-param limit minus a slot for `year` plus one spare.
//
// This is also the default API page size (propertyFilterSchema.limit,
// runNaturalLanguageSearch) so the default never trips the fallback's clamp:
// at a default of 100 the fallback returned 98 rows while pagination still
// reported limit 100, leaving ranks 98-99 unreachable on every page.
const FTS_PAGE_ID_HEADROOM = 2;
export const FTS_MAX_PAGE_SIZE = D1_MAX_BOUND_PARAMS - FTS_PAGE_ID_HEADROOM; // 98

// ── Keyword-search OR relaxation ───────────────────────────────────
// The keyword fallback relaxes an all-tokens AND match to an any-token OR
// match when AND finds nothing. Measured against production D1, the OR
// expression for "ten most valuable properties in Austin, TX" ("ten" OR
// "most" OR "valuable" OR "austin" OR "tx") matched 172,464 of ~978k rows.
// The COUNT for that set finished in 4.9s, but ranking it — ORDER BY
// bm25(...) over all 172,464 rows — exceeded D1's per-query CPU budget when
// run from inside the Worker ("D1 DB exceeded its CPU time limit and was
// reset"); it only succeeded over the slower REST API path, in 6.6s.
// FTS_OR_RELAX_MAX_MATCHES bounds how large an OR set keyword-search.ts will
// ever hand to a bm25 ORDER BY, with an order-of-magnitude of margin below
// the measured failure since the exact ceiling is unmeasured.
export const FTS_OR_RELAX_MAX_MATCHES = 20_000;

// ── Cache TTL ───────────────────────────────────────────────────────
export const RESPONSE_CACHE_TTL_SECONDS = 300;
export const TOKEN_CACHE_TTL_SECONDS = 270;
