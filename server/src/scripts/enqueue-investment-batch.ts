#!/usr/bin/env node
/**
 * Enqueue Investment Property Searches
 * Queues investment and management search terms
 */

import logger from "../lib/logger";
import { enqueueBatchGeneric } from "./utils/batch-enqueue";

const INVESTMENT_TERMS = [
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
];

async function enqueueInvestmentBatch() {
	return enqueueBatchGeneric({
		batchName: "Investment",
		emoji: "💰",
		terms: INVESTMENT_TERMS,
		userId: "investment-batch-enqueue",
	});
}

enqueueInvestmentBatch()
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error({ err: error }, "❌ Script failed:");
		process.exit(1);
	});
