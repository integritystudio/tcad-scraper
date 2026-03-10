#!/usr/bin/env node
/**
 * Unified batch enqueue script.
 * Replaces 10 individual enqueue-*-batch.ts scripts.
 *
 * Usage:
 *   npx tsx src/scripts/enqueue-batch.ts <batchType>
 *   npx tsx src/scripts/enqueue-batch.ts llc
 *   npx tsx src/scripts/enqueue-batch.ts --list
 *   npx tsx src/scripts/enqueue-batch.ts --all
 */

import logger from "../lib/logger";
import { BATCH_CONFIGS, getAvailableBatchTypes } from "./config/batch-configs";
import { enqueueBatch } from "./lib/queue-utils";

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
	const types = getAvailableBatchTypes();
	console.log("Usage: npx tsx src/scripts/enqueue-batch.ts <batchType>");
	console.log("       npx tsx src/scripts/enqueue-batch.ts --all");
	console.log("       npx tsx src/scripts/enqueue-batch.ts --list");
	console.log(`\nAvailable batch types: ${types.join(", ")}`);
	process.exit(0);
}

if (args.includes("--list")) {
	const types = getAvailableBatchTypes();
	for (const type of types) {
		const cfg = BATCH_CONFIGS[type];
		console.log(
			`  ${type.padEnd(16)} ${cfg.emoji} ${cfg.batchName} (${cfg.terms.length} terms)`,
		);
	}
	process.exit(0);
}

async function run() {
	const batchTypes = args.includes("--all") ? getAvailableBatchTypes() : args;

	for (const batchType of batchTypes) {
		const batchCfg = BATCH_CONFIGS[batchType];
		if (!batchCfg) {
			logger.error(
				`Unknown batch type: "${batchType}". Use --list to see available types.`,
			);
			process.exit(1);
		}

		const { batchName, emoji, terms, userId, priority, extraLogs } = batchCfg;
		logger.info(`${emoji} Starting ${batchName} Batch Enqueue`);
		if (extraLogs) extraLogs();
		const successCount = await enqueueBatch(terms, userId, logger, priority);
		const failCount = terms.length - successCount;
		logger.info(`📊 Summary: ${successCount} queued, ${failCount} failed`);
		logger.info(`✨ ${batchName} batch enqueue completed!`);
	}
}

run()
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error({ err: error }, "Script failed:");
		process.exit(1);
	});
