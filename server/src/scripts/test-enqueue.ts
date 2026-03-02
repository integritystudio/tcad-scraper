/**
 * Enqueue N test jobs from FALLBACK_TERMS, wait for completion, and report results.
 * Usage: doppler run -- npx tsx src/scripts/test-enqueue.ts [count]
 */
import { config } from "../config";
import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";
import { getErrorMessage } from "../utils/error-helpers";

const POLL_INTERVAL_MS = 5_000;
const MAX_WAIT_MS = 300_000;

const FALLBACK_TERMS = [
  "Joseph", "Taylor", "Charles", "Carol", "Steven", "Juan", "James", "Mary",
  "John", "Patricia", "Robert", "Elizabeth", "David", "Barbara", "Richard",
  "Susan", "Thomas", "Sarah", "Daniel", "Lisa",
];

async function main() {
  const requested = Math.min(parseInt(process.argv[2] || "10", 10), FALLBACK_TERMS.length);

  // Filter out terms that have already been searched
  const alreadySearched = await prisma.searchTermAnalytics.findMany({
    where: { searchTerm: { in: FALLBACK_TERMS } },
    select: { searchTerm: true },
  });
  const searched = new Set(alreadySearched.map((r) => r.searchTerm));
  const fresh = FALLBACK_TERMS.filter((t) => !searched.has(t));
  const terms = fresh.slice(0, requested);

  if (searched.size > 0) {
    const skipped = FALLBACK_TERMS.filter((t) => searched.has(t));
    console.log(`\nSkipping ${skipped.length} already-searched terms: ${skipped.join(", ")}`);
  }

  if (terms.length === 0) {
    console.log("\nNo unsearched terms remaining in the pool.");
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`\n=== Enqueuing ${terms.length} test jobs (year=${config.scraper.tcadYear}) ===\n`);

  const jobIds: { id: string; term: string }[] = [];
  for (const term of terms) {
    const job = await scraperQueue.add(
      "scrape-properties",
      { searchTerm: term, userId: "test-enqueue", scheduled: true },
      { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: false, removeOnFail: false },
    );
    jobIds.push({ id: job.id.toString(), term });
    console.log(`  Enqueued: "${term}" -> job ${job.id}`);
  }

  console.log(`\nWaiting for ${jobIds.length} jobs...\n`);

  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const states = await Promise.all(
      jobIds.map(async (j) => {
        const job = await scraperQueue.getJob(j.id);
        return job ? await job.getState() : "unknown";
      }),
    );
    const completed = states.filter((s) => s === "completed").length;
    const failed = states.filter((s) => s === "failed").length;
    const active = states.filter((s) => s === "active").length;
    const waiting = states.filter((s) => s === "waiting").length;

    console.log(`  [${Math.round((Date.now() - start) / 1000)}s] completed=${completed} failed=${failed} active=${active} waiting=${waiting}`);
    if (completed + failed >= jobIds.length) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  // Report results
  console.log("\n=== RESULTS ===\n");
  for (const { id, term } of jobIds) {
    const job = await scraperQueue.getJob(id);
    if (!job) { console.log(`  "${term}": job not found`); continue; }

    const state = await job.getState();
    const rv = job.returnvalue;
    if (state === "completed") {
      console.log(`  "${term}" -> OK  count=${rv?.count ?? "?"} new=${rv?.newProperties ?? "?"} updated=${rv?.updatedProperties ?? "?"}`);
    } else if (state === "failed") {
      console.log(`  "${term}" -> FAILED: ${job.failedReason}`);
    } else {
      console.log(`  "${term}" -> ${state}`);
    }
  }

  // Value check on recently scraped properties
  console.log("\n=== VALUE CHECK (last 20 properties from these terms) ===\n");
  const recent = await prisma.property.findMany({
    where: { searchTerm: { in: terms }, year: config.scraper.tcadYear },
    orderBy: { scrapedAt: "desc" },
    take: 20,
    select: { propertyId: true, name: true, appraisedValue: true, assessedValue: true, year: true, searchTerm: true },
  });

  for (const p of recent) {
    console.log(`  pid=${p.propertyId} year=${p.year} appraised=${p.appraisedValue} assessed=${p.assessedValue} term="${p.searchTerm}"`);
  }

  const zeros = recent.filter((p) => p.appraisedValue === 0).length;
  const nonZeros = recent.filter((p) => p.appraisedValue > 0).length;
  console.log(`\n  Summary: ${nonZeros} with values, ${zeros} with appraised=0 (out of ${recent.length})`);

  await scraperQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", getErrorMessage(err));
  process.exit(1);
});
