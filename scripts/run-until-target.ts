/**
 * Enqueue scrape jobs until TARGET_2025_PROPERTY_COUNT or MAX_CONSECUTIVE_ZERO_BATCHES consecutive zero-result jobs.
 * Usage: doppler run -- npx tsx scripts/run-until-target.ts
 */
import { config } from "../server/src/config";
import { prisma } from "../server/src/lib/prisma";
import { scraperQueue } from "../server/src/queues/scraper.queue";
import {
	DEFAULT_RATE_LIMIT_DELAY_MS,
	MAX_CONSECUTIVE_ZERO_BATCHES,
} from "../server/src/utils/constants";
import { getErrorMessage } from "../server/src/utils/error-helpers";
import {
	MS_PER_SECOND,
	SECONDS_PER_MINUTE,
	TARGET_2025_PROPERTY_COUNT,
} from "../utils/constants";
import { TermSelector } from "./continuous-batch-scraper";

const BATCH_SIZE = 10;
const MAX_JOB_WAIT_MS = 300_000;

async function getYearCount(): Promise<number> {
	return prisma.property.count({ where: { year: config.scraper.tcadYear } });
}

async function waitForJobs(
	jobIds: { id: string; term: string }[],
): Promise<{ term: string; count: number; failed: boolean }[]> {
	const start = Date.now();
	while (Date.now() - start < MAX_JOB_WAIT_MS) {
		const states = await Promise.all(
			jobIds.map(async (j) => {
				const job = await scraperQueue.getJob(j.id);
				return job ? await job.getState() : "unknown";
			}),
		);
		const done = states.filter(
			(s) => s === "completed" || s === "failed",
		).length;
		if (done >= jobIds.length) break;
		await new Promise((r) => setTimeout(r, DEFAULT_RATE_LIMIT_DELAY_MS));
	}

	const results: { term: string; count: number; failed: boolean }[] = [];
	for (const { id, term } of jobIds) {
		const job = await scraperQueue.getJob(id);
		if (!job) {
			results.push({ term, count: 0, failed: true });
			continue;
		}
		const state = await job.getState();
		if (state === "failed") {
			results.push({ term, count: 0, failed: true });
		} else {
			const rv = job.returnvalue;
			results.push({ term, count: rv?.count ?? 0, failed: false });
		}
	}
	return results;
}

async function main() {
	const year = config.scraper.tcadYear;
	const startCount = await getYearCount();
	console.log(
		`\n=== Run until ${TARGET_2025_PROPERTY_COUNT.toLocaleString()} properties (year=${year}) ===`,
	);
	console.log(`Starting count: ${startCount.toLocaleString()}\n`);

	if (startCount >= TARGET_2025_PROPERTY_COUNT) {
		console.log("Target already reached.");
		await prisma.$disconnect();
		process.exit(0);
	}

	const selector = new TermSelector();
	let consecutiveZeros = 0;
	let totalJobsRun = 0;
	let _totalNew = 0;
	const startTime = Date.now();

	while (true) {
		const currentCount = await getYearCount();
		if (currentCount >= TARGET_2025_PROPERTY_COUNT) {
			console.log(
				`\nTARGET REACHED: ${currentCount.toLocaleString()} properties`,
			);
			break;
		}

		const terms = await selector.getNextBatch(BATCH_SIZE);
		if (terms.length === 0) {
			console.log("\nNo more terms available.");
			break;
		}

		console.log(`\n--- Batch (${terms.length} terms): ${terms.join(", ")} ---`);

		const jobIds: { id: string; term: string }[] = [];
		for (const term of terms) {
			const job = await scraperQueue.add(
				"scrape-properties",
				{ searchTerm: term, userId: "run-until-target", scheduled: true },
				{
					attempts: 3,
					backoff: { type: "exponential", delay: 2000 },
					removeOnComplete: false,
					removeOnFail: false,
				},
			);
			jobIds.push({ id: job.id.toString(), term });
		}

		const results = await waitForJobs(jobIds);
		for (const r of results) {
			totalJobsRun++;
			const tag = r.failed ? "FAILED" : `count=${r.count}`;
			console.log(`  "${r.term}" -> ${tag}`);

			if (r.failed || r.count === 0) {
				consecutiveZeros++;
			} else {
				consecutiveZeros = 0;
				_totalNew += r.count;
			}

			if (consecutiveZeros >= MAX_CONSECUTIVE_ZERO_BATCHES) {
				console.log(
					`\nSTOPPED: ${MAX_CONSECUTIVE_ZERO_BATCHES} consecutive zero-result/failed jobs`,
				);
				break;
			}
		}

		if (consecutiveZeros >= MAX_CONSECUTIVE_ZERO_BATCHES) break;

		const elapsed = Math.round((Date.now() - startTime) / MS_PER_SECOND);
		const current = await getYearCount();
		console.log(
			`  [${elapsed}s] ${current.toLocaleString()} properties (+${(current - startCount).toLocaleString()}) | jobs=${totalJobsRun} | streak=${consecutiveZeros}`,
		);
	}

	const finalCount = await getYearCount();
	const elapsed = Math.round((Date.now() - startTime) / MS_PER_SECOND);
	console.log(`\n=== FINAL REPORT ===`);
	console.log(
		`  Runtime: ${Math.floor(elapsed / SECONDS_PER_MINUTE)}m ${elapsed % SECONDS_PER_MINUTE}s`,
	);
	console.log(
		`  Start: ${startCount.toLocaleString()} -> Final: ${finalCount.toLocaleString()} (+${(finalCount - startCount).toLocaleString()})`,
	);
	console.log(`  Jobs run: ${totalJobsRun}`);
	console.log(`  Year: ${year}`);

	await scraperQueue.close();
	await prisma.$disconnect();
	process.exit(0);
}

main().catch((err) => {
	console.error("Fatal:", getErrorMessage(err));
	process.exit(1);
});
