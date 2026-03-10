/**
 * Application constants
 */

export const PROPERTY_TYPES = [
	"Residential",
	"Commercial",
	"Industrial",
	"Agricultural",
	"Vacant Land",
	"Multi-Family",
] as const;

export const VALUE_RANGES = [
	{ label: "Under $100k", min: 0, max: 100000 },
	{ label: "$100k - $300k", min: 100000, max: 300000 },
	{ label: "$300k - $500k", min: 300000, max: 500000 },
	{ label: "$500k - $1M", min: 500000, max: 1000000 },
	{ label: "Over $1M", min: 1000000, max: Infinity },
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

// ── Property count targets ──────────────────────────────────────────
// Approximate 2025 TCAD property count used as halt threshold by backfill
// and lowthreshold scripts. See CLAUDE.md "Scale: 500K+ properties".
export const TARGET_2025_PROPERTY_COUNT = 500_000;

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
