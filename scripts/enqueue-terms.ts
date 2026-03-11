/**
 * Enqueue a list of search terms to BullMQ from stdin (one per line).
 * Usage: echo "term1\nterm2" | doppler run -- npx tsx scripts/enqueue-terms.ts
 */
import { scraperQueue } from "../server/src/queues/scraper.queue";
import { enqueueBatch } from "./lib/queue-utils";

async function main() {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk);
	}
	const input = Buffer.concat(chunks).toString("utf-8").trim();
	const terms = input
		.split("\n")
		.map((t) => t.trim())
		.filter((t) => t.length >= 4);

	console.log(`Enqueuing ${terms.length} terms...`);
	const queued = await enqueueBatch(terms, "next-200-gen");
	console.log(`Enqueued ${queued} jobs`);
	await scraperQueue.close();
}

main();
