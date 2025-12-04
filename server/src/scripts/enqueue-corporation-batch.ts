#!/usr/bin/env node
/**
 * Enqueue Corporation Property Searches
 * Queues corporation-related search terms
 */

import logger from "../lib/logger";
import { enqueueBatchGeneric } from "./utils/batch-enqueue";

const CORPORATION_TERMS = [
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
];

async function enqueueCorporationBatch() {
	return enqueueBatchGeneric({
		batchName: "Corporation",
		emoji: "🏛️",
		terms: CORPORATION_TERMS,
		userId: "corporation-batch-enqueue",
		priority: 2,
	});
}

enqueueCorporationBatch()
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error({ err: error }, "❌ Script failed:");
		process.exit(1);
	});
