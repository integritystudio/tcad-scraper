/**
 * Application constants
 */

import { DURATION_MS, TIME_MS } from "./units";

export * from "./http-errors";

export const PROPERTY_TYPES = [
	"Residential",
	"Commercial",
	"Industrial",
	"Agricultural",
	"Vacant Land",
	"Multi-Family",
] as const;

export const VALUE_RANGES = [
	{ label: "$0-100k", min: 0, max: 100_000 },
	{ label: "$100k-250k", min: 100_000, max: 250_000 },
	{ label: "$250k-500k", min: 250_000, max: 500_000 },
	{ label: "$500k-1M", min: 500_000, max: 1_000_000 },
	{ label: "$1M+", min: 1_000_000, max: Infinity },
] as const;

export const STATUS_COLORS = {
	active: "#10b981",
	completed: "#3b82f6",
	failed: "#ef4444",
	pending: "#f59e0b",
} as const;

export const BREAKPOINTS = {
	mobile: "640px",
	tablet: "768px",
	desktop: "1024px",
	wide: "1280px",
} as const;

// ── TCAD year ───────────────────────────────────────────────────────
export const DEFAULT_TCAD_YEAR = 2025;

/**
 * Accepted bounds for a per-request scrape year. TCAD's full-text endpoint
 * serves 2023-2026 as of 2026-08-08 (2027 returns an empty body); the bounds
 * are deliberately wider than the served range so a new roll year works
 * without a deploy, while still rejecting typos like 20226.
 */
export const TCAD_YEAR_MIN = 2000;
export const TCAD_YEAR_MAX = 2100;

// ── Property count targets ──────────────────────────────────────────
// Halt threshold for the backfill loop, per tax year. 2025's 508,880 is the
// certified-roll account count (see docs/SEARCH_TERMS.md); a year with no
// published certified total falls back to the most recent known roll, which
// is the right order of magnitude — Travis County's account count moves by
// low single-digit percent year over year.
export const TARGET_PROPERTY_COUNT_BY_YEAR: Readonly<Record<number, number>> = {
	2025: 508_880,
};

/** Fallback halt threshold for a year absent from TARGET_PROPERTY_COUNT_BY_YEAR. */
export const DEFAULT_TARGET_PROPERTY_COUNT = 508_880;

export function targetPropertyCount(year: number): number {
	return TARGET_PROPERTY_COUNT_BY_YEAR[year] ?? DEFAULT_TARGET_PROPERTY_COUNT;
}

/**
 * @deprecated Use `targetPropertyCount(year)`. Retained for analyze-search-terms.ts's
 * 2025 coverage report, which is year-pinned by design.
 */
export const TARGET_2025_PROPERTY_COUNT = TARGET_PROPERTY_COUNT_BY_YEAR[2025];

// ── Default limits & intervals ─────────────────────────────────────
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_MONTH = 30;
export const DEFAULT_QUERY_LIMIT = 100;
export const DEFAULT_RETRY_DELAY_MS = DURATION_MS.TWO_SECONDS;
export const DEFAULT_RATE_LIMIT_DELAY_MS = DURATION_MS.FIVE_SECONDS;
export const PROGRESS_LOG_INTERVAL = 100;
export const LOG_PAGE_SIZE = 50;
export const MAX_QUERY_LIMIT = 1000;
export const MAX_LOOKBACK_DAYS = 90;

// ── Recent jobs lookback ─────────────────────────────────────────────
export const RECENT_JOBS_LOOKBACK_MS = DAYS_PER_WEEK * TIME_MS.DAY;
export const THIRTY_DAY_LOOKBACK_MS = DAYS_PER_MONTH * TIME_MS.DAY;

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

// ── Time ────────────────────────────────────────────────────────────
export const MS_PER_MINUTE = TIME_MS.MINUTE;

// ── Retention ───────────────────────────────────────────────────────
export const SCRAPE_JOB_RETENTION_DAYS = DAYS_PER_MONTH;
export const QUEUE_RETENTION_DAYS = DAYS_PER_WEEK;

// ── Formatting ─────────────────────────────────────────────────────
export const PERCENT_MULTIPLIER = 100;
export const COST_DECIMAL_PLACES = 6;
export const LOG_SEPARATOR_WIDTH = 60;

// ── Network ─────────────────────────────────────────────────────────
export const API_CLIENT_TIMEOUT_MS = DURATION_MS.THIRTY_SECONDS;

// ── CLI formatting ──────────────────────────────────────────────────
export const BATCH_TYPE_COL_WIDTH = 16;

// ── Test timeouts ───────────────────────────────────────────────────
export const REDIS_AVAILABILITY_TIMEOUT_MS = DURATION_MS.THREE_SECONDS;
