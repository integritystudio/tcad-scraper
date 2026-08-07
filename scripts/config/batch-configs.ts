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
			"Homes",
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
			"Asset",
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
			"Plaza",
			"Center",
		],
	},

	residential: {
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
	},

	grove: {
		terms: ["Grove"],
	},

	"high-priority": {
		terms: ["Boulevard", "Way", "Terrace", "Michelle"],
	},

	"priority-terms": {
		terms: ["Lake", "River", "Pecan", "Maple", "Oak", "Mount", "Limited"],
	},

	"ultra-high-priority": {
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
	},

	"hispanic-surnames": {
		terms: [
			"Acuna",
			"Adame",
			"Anaya",
			"Avila",
			"Baeza",
			"Banda",
			"Bello",
			"Bosco",
			"Bravo",
			"Bueno",
			"Calvo",
			"Campo",
			"Casas",
			"Cerda",
			"Chapa",
			"Coria",
			"Corzo",
			"Duran",
			"Garzo",
			"Lerma",
			"Llano",
			"Loera",
			"Lujan",
			"Mares",
			"Marin",
			"Mejia",
			"Mendo",
			"Milla",
			"Monje",
			"Nieto",
			"Oliva",
			"Ozuna",
			"Parra",
			"Ponce",
			"Reyna",
			"Rocha",
			"Rojas",
			"Roque",
			"Saenz",
			"Serna",
			"Tamez",
			"Tello",
			"Tovar",
			"Uribe",
			"Valde",
			"Valez",
			"Viera",
		],
	},

	"indian-surnames": {
		terms: [
			"Bajaj",
			"Bhatt",
			"Batra",
			"Dixit",
			"Joshi",
			"Kapur",
			"Kumar",
			"Mehta",
			"Mehra",
			"Misra",
			"Nagar",
			"Naidu",
			"Nanda",
			"Pande",
			"Reddy",
			"Sethi",
			"Sinha",
			"Sodhi",
			"Verma",
			"Yadav",
		],
	},

	"asian-surnames": {
		terms: ["Chang", "Hsiao", "Huang", "Hwang", "Jiang", "Liang", "Tsang"],
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
		// Oak (7210 max_results) → neighborhood/subdivision sub-queries
		["Oak", ["Oak Hill", "Oakwood", "Oak Run", "Oakhurst", "Oak Creek"]],
		// Maria (6026 max_results) → common middle-initial sub-queries
		["Maria", ["Maria E", "Maria G", "Maria R", "Maria L"]],
		// Estate (5051 max_results) → specific entity patterns
		["Estate", ["Estate of", "Estates at", "Estate Trust"]],
	]);
