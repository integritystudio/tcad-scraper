/** Generic backfill loop shared by all backfill-2025* scripts. */

import { getErrorMessage } from "./error-helpers";
import { TARGET_2025_PROPERTY_COUNT as TARGET_2025_COUNT } from "../../utils/constants";
import { get2025Count } from "./backfill-utils";
import { prisma } from "./d1-prisma";
import { BATCH_SIZE, enqueueBatch, waitForQueueDrain } from "./queue-utils";

export interface BackfillConfig {
	/** Function that returns the terms to backfill */
	getTerms: () => Promise<string[]>;
	/** User ID for job attribution (e.g. "backfill-2025-proven") */
	userId: string;
	/** Display label for the header (e.g. "Proven 2026 Terms") */
	label: string;
	/** Max consecutive zero-result batches before stopping (default: 3) */
	maxConsecutiveZeroBatches?: number;
}

export const DEFAULT_MAX_CONSECUTIVE_ZERO_BATCHES = 3;

export async function runBackfill(cfg: BackfillConfig): Promise<void> {
	const maxZero =
		cfg.maxConsecutiveZeroBatches ?? DEFAULT_MAX_CONSECUTIVE_ZERO_BATCHES;

	const tcadYear = process.env.TCAD_YEAR
		? parseInt(process.env.TCAD_YEAR, 10)
		: 2025;
	if (tcadYear !== 2025) {
		console.error(`ERROR: TCAD_YEAR is ${tcadYear}, must be 2025.`);
		const script = process.argv[1] ?? "<script>";
		console.error(`Run with: TCAD_YEAR=2025 doppler run -- npx tsx ${script}`);
		process.exit(1);
	}

	let current = await get2025Count();
	console.log(`\n=== 2025 Backfill (${cfg.label}) ===`);
	console.log(`Current 2025 properties: ${current.toLocaleString()}`);
	console.log(`Target: ${TARGET_2025_COUNT.toLocaleString()}`);
	console.log(`Gap: ${(TARGET_2025_COUNT - current).toLocaleString()}\n`);

	if (current >= TARGET_2025_COUNT) {
		console.log("Already at target.");
		return;
	}

	const allTerms = await cfg.getTerms();
	console.log(`\nTerms to backfill: ${allTerms.length}\n`);

	if (allTerms.length === 0) {
		console.log("No terms remaining.");
		return;
	}

	let batchNum = 0;
	let consecutiveZeroBatches = 0;
	let totalGained = 0;
	for (let i = 0; i < allTerms.length; i += BATCH_SIZE) {
		current = await get2025Count();
		if (current >= TARGET_2025_COUNT) {
			console.log(
				`\nTarget reached: ${current.toLocaleString()} >= ${TARGET_2025_COUNT.toLocaleString()}`,
			);
			break;
		}

		batchNum++;
		const batch = allTerms.slice(i, i + BATCH_SIZE);
		console.log(`--- Batch ${batchNum} (${batch.length} terms) ---`);
		console.log(`  Terms: ${batch.join(", ")}`);

		const enqueuedAtMs = Date.now();
		const enqueued = await enqueueBatch(batch);
		console.log(`  Enqueued: ${enqueued.length}/${batch.length}`);

		if (enqueued.length > 0) {
			await waitForQueueDrain(enqueued, enqueuedAtMs);
		}

		const newCount = await get2025Count();
		const gained = newCount - current;
		totalGained += gained;
		console.log(
			`  2025 properties: ${newCount.toLocaleString()} (+${gained.toLocaleString()}) [session: +${totalGained.toLocaleString()}]`,
		);
		console.log(
			`  Remaining: ${Math.max(0, TARGET_2025_COUNT - newCount).toLocaleString()}`,
		);

		if (gained === 0) {
			consecutiveZeroBatches++;
			console.log(
				`  Zero-result batches in a row: ${consecutiveZeroBatches}/${maxZero}`,
			);
			if (consecutiveZeroBatches >= maxZero) {
				console.log(`\nStopping: ${maxZero} consecutive zero-result batches.`);
				break;
			}
		} else {
			consecutiveZeroBatches = 0;
		}
		console.log("");
	}

	const finalCount = await get2025Count();
	console.log(`\n=== Done ===`);
	console.log(`Final 2025 count: ${finalCount.toLocaleString()}`);
	console.log(`Session gained: +${totalGained.toLocaleString()}`);
	console.log(`Target met: ${finalCount >= TARGET_2025_COUNT ? "YES" : "NO"}`);
}

/** Standard entry point wrapper with error handling and cleanup. */
export function runBackfillMain(cfg: BackfillConfig): void {
	runBackfill(cfg)
		.catch((err) => {
			console.error("Fatal:", getErrorMessage(err));
			process.exit(1);
		})
		.finally(async () => {
			await prisma.$disconnect();
		});
}
