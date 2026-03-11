/**
 * Queue Results — show recent completed/failed jobs from BullMQ + DB property count.
 *
 * Usage: doppler run -- npx tsx scripts/queue-results.ts [--limit N]
 */

import { prisma } from "../server/src/lib/prisma";
import { scraperQueue } from "../server/src/queues/scraper.queue";
import { cacheService } from "../server/src/lib/redis-cache.service";

const limit = Number(
	process.argv.find((_, i, a) => a[i - 1] === "--limit") ?? 20,
);

interface JobReturnValue {
	count: number;
	properties: { propertyId: string }[];
	searchTerm: string;
	duration: number;
}

async function main() {
	const [waiting, active, completed, failed] = await Promise.all([
		scraperQueue.getWaitingCount(),
		scraperQueue.getActiveCount(),
		scraperQueue.getCompletedCount(),
		scraperQueue.getFailedCount(),
	]);

	console.log("Queue status:", { waiting, active, completed, failed });

	const propertyCount = await prisma.$queryRaw<[{ count: number }]>`
    SELECT COUNT(*)::int as count FROM properties WHERE year = 2025
  `;
	console.log("2025 properties:", propertyCount[0].count);
	console.log();

	const recentCompleted = await scraperQueue.getCompleted(0, limit);
	if (recentCompleted.length) {
		console.log(`Completed jobs (last ${recentCompleted.length}):`);
		console.log(
			`  ${"Term".padEnd(22)}${"Props".padStart(6)}  Duration  Finished`,
		);
		console.log(`  ${"-".repeat(60)}`);
		for (const j of recentCompleted) {
			const rv = j.returnvalue as JobReturnValue | undefined;
			const term = (j.data.searchTerm || "").padEnd(22);
			const props = String(rv?.properties?.length ?? 0).padStart(6);
			const dur = rv?.duration
				? `${(rv.duration / 1000).toFixed(1)}s`.padStart(8)
				: "     N/A";
			const fin = j.finishedOn
				? new Date(j.finishedOn).toISOString().replace("T", " ").slice(0, 19)
				: "N/A";
			console.log(`  ${term}${props}  ${dur}  ${fin}`);
		}
	} else {
		console.log("No completed jobs in queue.");
	}

	const recentFailed = await scraperQueue.getFailed(0, limit);
	if (recentFailed.length) {
		console.log();
		console.log(`Failed jobs (last ${recentFailed.length}):`);
		console.log(`  ${"Term".padEnd(22)}Error`);
		console.log(`  ${"-".repeat(60)}`);
		for (const j of recentFailed) {
			const term = (j.data.searchTerm || "").padEnd(22);
			const reason = j.failedReason || "unknown";
			console.log(`  ${term}${reason}`);
		}
	}

	await Promise.all([scraperQueue.close(), prisma.$disconnect(), cacheService.disconnect()]);
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
