/**
 * Enqueue 100 optimized search terms based on analysis of high-yield patterns.
 *
 * Generated 2026-03-06 after analyzing 6,411 previously searched terms.
 * Mix of:
 * - Less common last names (4+ char, not yet in DB)
 * - Business/entity terms (industry-specific, not generic LLC/Trust)
 * - Geographic/street fragments (tree names, terrain, water features)
 *
 * All terms validated against TCAD constraints:
 * - 4+ characters, single words, no cities/ZIPs/numeric-only
 *
 * Usage: doppler run -- npx tsx src/scripts/enqueue-optimized-100.ts [--dry-run]
 */
import { scraperQueue } from '../../queues/scraper.queue';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';

const TERMS = [
  // ── Last names (not yet searched, 4+ chars) ──
  "Ainsworth", "Aldrich", "Amato", "Arnett", "Ashworth",
  "Babcock", "Barlow", "Beaumont", "Benoit", "Blalock",
  "Bollinger", "Bourque", "Bracken", "Braswell", "Bronson",
  "Bruno", "Bryson", "Butterfield", "Bynum", "Canfield",
  "Carmichael", "Chaffin", "Chesney", "Choate", "Clancy",
  "Claxton", "Cockrell", "Colbert", "Crabtree", "Cranford",
  "Daigle", "Dewitt", "Dupree", "Eggleston", "Elledge",
  "Ethridge", "Farnsworth", "Faust", "Forsyth", "Fulmer",
  "Gaston", "Grisham", "Grogan", "Llamas", "Lucero",
  "Noriega", "Palomino", "Roldan", "Ruelas", "Zaragoza",
  // ── More last names ──
  "Ashby", "Cantrell", "Carver", "Chadwick", "Coburn",
  "Cordell", "Corley", "Cromwell", "Crowder", "Dunbar",
  "Hamby", "Irving", "Cox", "Venture",
  // ── Business/entity terms (industry-specific) ──
  "Wholesale", "Trucking", "Logistics", "Petroleum", "Mining",
  "Drilling", "Refinery", "Pharmacy", "Clinic", "Surgical",
  "Therapy", "Academy", "Seminary", "Ministry", "Fellowship",
  "Apartments", "Townhomes", "Residences", "Industries", "Engineering",
  "Electric", "Plumbing", "Roofing", "Landscaping", "Insurance",
  "Financial", "Dental", "Legal",
  // ── Geographic/street fragments ──
  "Sycamore", "Aspen", "Plateau", "Lagoon", "Granite",
  "Marble", "Limestone", "Meadows", "Cliff",
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Get all previously searched terms (case-insensitive dedup)
  const existingJobs = await prisma.scrapeJob.findMany({
    select: { searchTerm: true },
  });
  const searched = new Set(existingJobs.map(j => j.searchTerm.toLowerCase()));

  // Also check queue for pending jobs
  const [waiting, active] = await Promise.all([
    scraperQueue.getWaiting(0, 500),
    scraperQueue.getActive(0, 100),
  ]);
  for (const j of [...waiting, ...active]) {
    if (j.data.searchTerm) searched.add(j.data.searchTerm.toLowerCase());
  }

  // Filter: no duplicates
  const candidates = TERMS.filter(term => {
    const lower = term.toLowerCase();
    return !searched.has(lower);
  });

  // Deduplicate within our own list
  const seen = new Set<string>();
  const unique = candidates.filter(t => {
    const lower = t.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  console.log(`Terms: ${TERMS.length} total, ${TERMS.length - unique.length} filtered (dupes), ${unique.length} to enqueue`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would enqueue:');
    for (const t of unique) console.log(`  ${t}`);
    await Promise.all([scraperQueue.close(), prisma.$disconnect()]);
    return;
  }

  const { jobName, defaultJobOptions } = config.queue;
  let enqueued = 0;

  for (const term of unique) {
    await scraperQueue.add(
      jobName,
      { searchTerm: term, userId: 'optimized-batch-2026-03-06', scheduled: true },
      {
        attempts: defaultJobOptions.attempts,
        backoff: { type: 'exponential', delay: defaultJobOptions.backoffDelay },
        removeOnComplete: defaultJobOptions.removeOnComplete,
        removeOnFail: defaultJobOptions.removeOnFail,
      },
    );
    enqueued++;
  }

  console.log(`Enqueued ${enqueued} jobs with userId=optimized-batch-2026-03-06`);
  await Promise.all([scraperQueue.close(), prisma.$disconnect()]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
