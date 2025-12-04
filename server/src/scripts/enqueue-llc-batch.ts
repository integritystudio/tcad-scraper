#!/usr/bin/env node
/**
 * Enqueue LLC Property Searches
 * Queues LLC and limited company search terms
 */

import logger from "../lib/logger";
import { enqueueBatchGeneric } from "./utils/batch-enqueue";

const LLC_TERMS = [
	"LLC",
	"LLC.",
	"L.L.C.",
	"Limited Liability",
	"Limited",
	"LMTD",
	"Limit",
	"L L C",
	"LTD",
	"Co LLC",
];

async function enqueueLLCBatch() {
	return enqueueBatchGeneric({
		batchName: "LLC",
		emoji: "🏭",
		terms: LLC_TERMS,
		userId: "llc-batch-enqueue",
	});
}

enqueueLLCBatch()
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error({ err: error }, "❌ Script failed:");
		process.exit(1);
	});
