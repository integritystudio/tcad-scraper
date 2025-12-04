#!/usr/bin/env node
/**
 * Enqueue Property Type Searches
 * Queues property type and real estate search terms
 */

import logger from "../lib/logger";
import { enqueueBatchGeneric } from "./utils/batch-enqueue";

const PROPERTY_TYPE_TERMS = [
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
];

async function enqueuePropertyTypeBatch() {
	return enqueueBatchGeneric({
		batchName: "Property Type",
		emoji: "🏘️",
		terms: PROPERTY_TYPE_TERMS,
		userId: "property-type-batch-enqueue",
	});
}

enqueuePropertyTypeBatch()
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error({ err: error }, "❌ Script failed:");
		process.exit(1);
	});
