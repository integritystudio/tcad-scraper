/** Generic backfill loop shared by all backfill scripts. */

import {
	DEFAULT_TCAD_YEAR,
	TCAD_YEAR_MAX,
	TCAD_YEAR_MIN,
	targetPropertyCount,
} from "../../utils/constants";
import { getPropertyCount } from "./backfill-utils";
import { BATCH_SIZE, enqueueBatch, waitForQueueDrain } from "./queue-utils";
import { runMain } from "./run-main";

export interface BackfillConfig {
	/**
	 * Terms to backfill. Receives the resolved target year so callers can mine
	 * the gap against the year actually being filled.
	 */
	getTerms: (year: number) => Promise<string[]>;
	/** Display label for the header (e.g. "Proven Gap Terms") */
	label: string;
	/** Max consecutive zero-result batches before stopping (default: 3) */
	maxConsecutiveZeroBatches?: number;
}

export const DEFAULT_MAX_CONSECUTIVE_ZERO_BATCHES = 3;

/**
 * Resolve the roll year to fill from TCAD_YEAR, or exit non-zero if it is
 * unusable. Previously this pinned the value to 2025; a backfill now names its
 * year, and every downstream count, target and enqueue is scoped to it.
 */
export function resolveTargetYear(): number {
	if (!process.env.TCAD_YEAR) return DEFAULT_TCAD_YEAR;

	const year = parseInt(process.env.TCAD_YEAR, 10);
	if (!Number.isInteger(year) || year < TCAD_YEAR_MIN || year > TCAD_YEAR_MAX) {
		console.error(
			`ERROR: TCAD_YEAR is "${process.env.TCAD_YEAR}", must be an integer in ${TCAD_YEAR_MIN}-${TCAD_YEAR_MAX}.`,
		);
		const script = process.argv[1] ?? "<script>";
		console.error(`Run with: TCAD_YEAR=2026 doppler run -- npx tsx ${script}`);
		process.exit(1);
	}
	return year;
}

export async function runBackfill(cfg: BackfillConfig): Promise<void> {
	const maxZero =
		cfg.maxConsecutiveZeroBatches ?? DEFAULT_MAX_CONSECUTIVE_ZERO_BATCHES;

	const year = resolveTargetYear();
	const target = targetPropertyCount(year);

	let current = await getPropertyCount(year);
	console.log(`\n=== ${year} Backfill (${cfg.label}) ===`);
	console.log(`Current ${year} properties: ${current.toLocaleString()}`);
	console.log(`Target: ${target.toLocaleString()}`);
	console.log(`Gap: ${(target - current).toLocaleString()}\n`);

	if (current >= target) {
		console.log("Already at target.");
		return;
	}

	const allTerms = await cfg.getTerms(year);
	console.log(`\nTerms to backfill: ${allTerms.length}\n`);

	if (allTerms.length === 0) {
		console.log("No terms remaining.");
		return;
	}

	let batchNum = 0;
	let consecutiveZeroBatches = 0;
	let totalGained = 0;
	for (let i = 0; i < allTerms.length; i += BATCH_SIZE) {
		current = await getPropertyCount(year);
		if (current >= target) {
			console.log(
				`\nTarget reached: ${current.toLocaleString()} >= ${target.toLocaleString()}`,
			);
			break;
		}

		batchNum++;
		const batch = allTerms.slice(i, i + BATCH_SIZE);
		console.log(`--- Batch ${batchNum} (${batch.length} terms) ---`);
		console.log(`  Terms: ${batch.join(", ")}`);

		const enqueuedAtMs = Date.now();
		const enqueued = await enqueueBatch(batch, console, year);
		console.log(`  Enqueued: ${enqueued.length}/${batch.length}`);

		if (enqueued.length > 0) {
			await waitForQueueDrain(enqueued, enqueuedAtMs);
		}

		const newCount = await getPropertyCount(year);
		const gained = newCount - current;
		totalGained += gained;
		console.log(
			`  ${year} properties: ${newCount.toLocaleString()} (+${gained.toLocaleString()}) [session: +${totalGained.toLocaleString()}]`,
		);
		console.log(
			`  Remaining: ${Math.max(0, target - newCount).toLocaleString()}`,
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

	const finalCount = await getPropertyCount(year);
	console.log(`\n=== Done ===`);
	console.log(`Final ${year} count: ${finalCount.toLocaleString()}`);
	console.log(`Session gained: +${totalGained.toLocaleString()}`);
	console.log(`Target met: ${finalCount >= target ? "YES" : "NO"}`);
}

/** Standard entry point wrapper with error handling and cleanup. */
export function runBackfillMain(cfg: BackfillConfig): void {
	runMain(() => runBackfill(cfg));
}
