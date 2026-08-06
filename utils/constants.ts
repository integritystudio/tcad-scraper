/**
 * Application constants
 */

import { TIME_MS, DURATION_MS } from "./units";
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

// ── Property count targets ──────────────────────────────────────────
// Approximate 2025 TCAD property count used as halt threshold by backfill
// and lowthreshold scripts. See CLAUDE.md "Scale: 500K+ properties".
export const TARGET_2025_PROPERTY_COUNT = 500_000;

// ── Default limits & intervals ─────────────────────────────────────
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_MONTH = 30;
export const DEFAULT_QUERY_LIMIT = 100;
export const DEFAULT_RETRY_DELAY_MS = DURATION_MS.TWO_SECONDS;
export const DEFAULT_RATE_LIMIT_DELAY_MS = DURATION_MS.FIVE_SECONDS;
export const PROGRESS_LOG_INTERVAL = 100;

// ── Recent jobs lookback ─────────────────────────────────────────────
export const RECENT_JOBS_LOOKBACK_MS = DAYS_PER_WEEK * TIME_MS.DAY;

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
