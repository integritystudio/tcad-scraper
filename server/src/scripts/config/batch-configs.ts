/**
 * Centralized batch enqueue configurations.
 * Each config defines terms for a specific search category.
 *
 * Priority scale (BullMQ convention: lower number = higher priority):
 *   -100  ultra-high-priority (processed first)
 *      1  high-priority, priority-terms
 *      2  corporation
 *   omit  standard priority (all others)
 *
 * Usage: npx tsx src/scripts/enqueue-batch.ts <batchType>
 * Example: npx tsx src/scripts/enqueue-batch.ts llc
 */

import type { BatchEnqueueConfig } from "../utils/batch-enqueue";

type BatchConfigEntry = Omit<BatchEnqueueConfig, "extraLogs">;

export const BATCH_CONFIGS: Record<string, BatchConfigEntry> = {
	llc: {
		batchName: "LLC",
		emoji: "🏭",
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
		userId: "llc-batch-enqueue",
	},

	trust: {
		batchName: "Trust & Estate",
		emoji: "📜",
		terms: [
			"Trust",
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
		userId: "trust-batch-enqueue",
	},

	corporation: {
		batchName: "Corporation",
		emoji: "🏛️",
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
		userId: "corporation-batch-enqueue",
		priority: 2,
	},

	commercial: {
		batchName: "Commercial",
		emoji: "🏢",
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
		userId: "commercial-batch-enqueue",
	},

	construction: {
		batchName: "Construction",
		emoji: "🏗️",
		terms: [
			"Construction",
			"Builders",
			"Builder",
			"Contractor",
			"Contracting",
			"Homes",
			"Home",
			"Custom Homes",
			"Housing",
			"Residential Builders",
		],
		userId: "construction-batch-enqueue",
	},

	foundation: {
		batchName: "Foundation",
		emoji: "🎗️",
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
		userId: "foundation-batch-enqueue",
	},

	partnership: {
		batchName: "Partnership",
		emoji: "🤝",
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
		userId: "partnership-batch-enqueue",
	},

	investment: {
		batchName: "Investment",
		emoji: "💰",
		terms: [
			"Investments",
			"Holdings",
			"Capital",
			"Fund",
			"Equity",
			"Ventures",
			"Asset",
			"Portfolio",
			"Management",
			"Manage",
		],
		userId: "investment-batch-enqueue",
	},

	"property-type": {
		batchName: "Property Type",
		emoji: "🏘️",
		terms: [
			"Properties",
			"Property",
			"Real Estate",
			"Realty",
			"Land",
			"Acres",
			"Development",
			"Developers",
			"Plaza",
			"Center",
		],
		userId: "property-type-batch-enqueue",
	},

	residential: {
		batchName: "Residential",
		emoji: "🏠",
		terms: [
			"Smith",
			"Johnson",
			"Williams",
			"Brown",
			"Jones",
			"Miller",
			"Davis",
			"Garcia",
			"Rodriguez",
			"Wilson",
		],
		userId: "residential-batch-enqueue",
	},

	grove: {
		batchName: "Grove",
		emoji: "🌳",
		terms: ["Grove"],
		userId: "grove-batch-enqueue",
	},

	"high-priority": {
		batchName: "High Priority Streets & Names",
		emoji: "🔥",
		terms: ["Boulevard", "Way", "Terrace", "Michelle"],
		userId: "high-priority-batch-enqueue",
		priority: 1,
	},

	"priority-terms": {
		batchName: "Priority Geographic & Entity",
		emoji: "🎯",
		terms: ["Lake", "River", "Pecan", "Maple", "Oak", "Mount", "Limited"],
		userId: "priority-terms-batch-enqueue",
		priority: 1,
	},

	"ultra-high-priority": {
		batchName: "Ultra High Priority",
		emoji: "🚀",
		terms: [
			"Street",
			"Drive",
			"Lane",
			"Road",
			"Amy",
			"Cynthia",
			"Brook",
			"Meadow",
			"Valley",
			"Point",
		],
		userId: "ultra-high-priority-batch-enqueue",
		priority: -100,
	},
};

/**
 * Terms with >5000 max_results that should be split into narrower sub-queries
 * to prevent truncation and timeouts. Based on search_term_analytics data.
 */
export const HIGH_RESULT_TERM_SPLITS: ReadonlyMap<string, readonly string[]> = new Map([
	// Oak (7210 max_results) → neighborhood/subdivision sub-queries
	["Oak", ["Oak Hill", "Oakwood", "Oak Run", "Oakhurst", "Oak Creek"]],
	// Maria (6026 max_results) → common middle-initial sub-queries
	["Maria", ["Maria E", "Maria G", "Maria R", "Maria L"]],
	// Estate (5051 max_results) → specific entity patterns
	["Estate", ["Estate of", "Estates at", "Estate Trust"]],
]);

export function getAvailableBatchTypes(): string[] {
	return Object.keys(BATCH_CONFIGS);
}
