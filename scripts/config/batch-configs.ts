/**
 * Named search-term batches by category (LLC, trust, residential, ...).
 *
 * Term data, not an active enqueue pipeline: the sole consumer is
 * utils/list-all-search-terms.ts, which folds these into the deduplicated
 * search-term inventory.
 */

import type { BatchEnqueueConfig } from "../lib/queue-utils";
import { BACKFILL_2025_SOURCE_TERMS } from "./backfill-2025-source-terms";

export const BATCH_CONFIGS: Record<string, BatchEnqueueConfig> = {
	llc: {
		terms: [
			"LLC",
			"LLC.",
			"L.L.C.",
			"Limited Liability",
			"LMTD",
			"Limit",
			"L L C",
			"LTD",
			"Co LLC",
		],
	},

	trust: {
		terms: [
			"Trustee",
			"Estate",
			"Family Trust",
			"Revocable Trust",
			"Irrevocable Trust",
			"Living Trust",
			"Testamentary",
			"Fiduciary",
			"Beneficiary",
		],
	},

	corporation: {
		terms: [
			"Corp",
			"Corp.",
			"Corporation",
			"Incorporated",
			"Inc",
			"Inc.",
			"Company",
			"Co.",
			"Enterprise",
			"Enterprises",
		],
	},

	commercial: {
		terms: [
			"Shopping",
			"Retail",
			"Office",
			"Warehouse",
			"Industrial",
			"Commercial",
			"Business",
			"Store",
			"Mall",
			"Building",
		],
	},

	construction: {
		terms: [
			"Construction",
			"Builders",
			"Builder",
			"Contractor",
			"Contracting",
			"Home",
			"Custom Homes",
			"Housing",
			"Residential Builders",
		],
	},

	foundation: {
		terms: [
			"Foundation",
			"Charitable",
			"Charity",
			"Nonprofit",
			"Non-Profit",
			"Organization",
			"Institute",
			"Society",
			"Endowment",
		],
	},

	partnership: {
		terms: [
			"Partnership",
			"Partners",
			"Part",
			"LP",
			"LLP",
			"Association",
			"Associates",
			"Assoc",
			"Assoc.",
			"Joint Venture",
		],
	},

	investment: {
		terms: [
			"Investments",
			"Holdings",
			"Capital",
			"Fund",
			"Equity",
			"Ventures",
			"Portfolio",
			"Management",
			"Manage",
		],
	},

	"property-type": {
		terms: [
			"Properties",
			"Property",
			"Real Estate",
			"Realty",
			"Land",
			"Acres",
			"Development",
			"Developers",
			"Center",
		],
	},

	residential: {
		terms: ["Johnson", "Williams", "Miller", "Garcia", "Rodriguez", "Wilson"],
	},

	"high-priority": {
		terms: ["Boulevard", "Way", "Terrace", "Michelle"],
	},

	"priority-terms": {
		terms: ["Lake", "Oak", "Limited"],
	},

	"ultra-high-priority": {
		terms: [
			"Street",
			"Drive",
			"Lane",
			"Road",
			"Amy",
			"Cynthia",
			"Meadow",
			"Valley",
		],
	},

	"backfill-2025-source": {
		terms: [...BACKFILL_2025_SOURCE_TERMS],
	},
};

/**
 * Terms with >5000 max_results that should be split into narrower sub-queries
 * to prevent truncation and timeouts. Based on search_term_analytics data.
 */
export const HIGH_RESULT_TERM_SPLITS: ReadonlyMap<string, readonly string[]> =
	new Map([
		// Oaks (3098 max_results, re-verified 2026-08-07 — "Oak" alone is under
		// MIN_TERM_LENGTH (4 chars) and the API rejects it as a standalone search,
		// so "Oaks" stands in as the closest searchable proxy) → neighborhood/
		// subdivision sub-queries
		["Oaks", ["Oak Hill", "Oakwood", "Oak Run", "Oakhurst", "Oak Creek"]],
		// Maria (6427 max_results, re-verified 2026-08-07) → common middle-initial sub-queries
		["Maria", ["Maria E", "Maria G", "Maria R", "Maria L"]],
		// Estate (5713 max_results, re-verified 2026-08-07) → specific entity patterns
		["Estate", ["Estate of", "Estates at", "Estate Trust"]],
	]);
