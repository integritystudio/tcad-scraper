#!/usr/bin/env node
/**
 * Enqueue Partnership Property Searches
 * Queues partnership and association search terms
 */

import logger from "../lib/logger";
import { enqueueBatchGeneric } from "./utils/batch-enqueue";

const PARTNERSHIP_TERMS = [
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
];

async function enqueuePartnershipBatch() {
	return enqueueBatchGeneric({
		batchName: "Partnership",
		emoji: "🤝",
		terms: PARTNERSHIP_TERMS,
		userId: "partnership-batch-enqueue",
	});
}

enqueuePartnershipBatch()
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error({ err: error }, "❌ Script failed:");
		process.exit(1);
	});
