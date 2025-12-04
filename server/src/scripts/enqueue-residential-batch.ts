#!/usr/bin/env node

/**
 * Enqueue Residential Property Searches
 * Queues common residential property search terms
 */

import { config } from "../config";
import logger from "../lib/logger";
import { enqueueBatchGeneric } from "./utils/batch-enqueue";

const RESIDENTIAL_TERMS = [
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
];

async function enqueueResidentialBatch() {
	return enqueueBatchGeneric({
		batchName: "Residential",
		emoji: "🏠",
		terms: RESIDENTIAL_TERMS,
		userId: "residential-batch-enqueue",
		extraLogs: () => {
			logger.info(
				`Token refresh interval: ${config.scraper.tokenRefreshInterval}ms`,
			);
		},
	});
}

enqueueResidentialBatch()
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error({ err: error }, "❌ Script failed:");
		process.exit(1);
	});
