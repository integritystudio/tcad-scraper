#!/usr/bin/env node
/**
 * Enqueue Construction & Building Searches
 * Queues construction and building-related search terms
 */

import logger from "../lib/logger";
import { enqueueBatchGeneric } from "./utils/batch-enqueue";

const CONSTRUCTION_TERMS = [
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
];

async function enqueueConstructionBatch() {
	return enqueueBatchGeneric({
		batchName: "Construction",
		emoji: "🏗️",
		terms: CONSTRUCTION_TERMS,
		userId: "construction-batch-enqueue",
	});
}

enqueueConstructionBatch()
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error({ err: error }, "❌ Script failed:");
		process.exit(1);
	});
