/** Shared constants for backfill and search-term generation scripts. */

// ── Property count targets ──────────────────────────────────────────
// Approximate 2025 TCAD property count used as halt threshold by backfill
// and lowthreshold scripts. See CLAUDE.md "Scale: 418K+ properties".
export const TARGET_2025_PROPERTY_COUNT = 420_000;

// ── Recent jobs lookback ─────────────────────────────────────────────
export const RECENT_JOBS_LOOKBACK_DAYS = 7;
export const RECENT_JOBS_LOOKBACK_MS = RECENT_JOBS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

// ── Term generation thresholds ───────────────────────────────────────
export const MIN_TERM_LENGTH = 4;
export const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

// Dense term expansion
export const DENSE_MAX_RESULTS_THRESHOLD = 5000;
export const DENSE_AVG_RESULTS_THRESHOLD = 2000;
export const DENSE_MIN_SUCCESS_RATE = 0.5;
export const DENSE_MAX_BASE_LENGTH = 6;

// Seed term expansion
export const SEED_MIN_SUCCESS_RATE = 0.5;
export const SEED_MIN_AVG_RESULTS = 100;
