import { prisma } from "./src/lib/prisma";
import { scraperQueue } from "./src/queues/scraper.queue";
import { config } from "./src/config";

const BATCH_SIZE = 30;

async function getCount(): Promise<number> {
  const r = await prisma.$queryRaw<[{ count: number }]>`SELECT COUNT(*)::int as count FROM properties WHERE year = 2025`;
  return r[0].count;
}

async function getSearchedTerms(): Promise<Set<string>> {
  const [searched2025, recentJobs] = await Promise.all([
    prisma.$queryRaw<Array<{ search_term: string }>>`SELECT DISTINCT search_term FROM properties WHERE year = 2025`,
    prisma.scrapeJob.findMany({ where: { startedAt: { gte: new Date(Date.now() - 7 * 86400000) } }, select: { searchTerm: true } }),
  ]);
  const searched = new Set<string>();
  for (const r of searched2025) searched.add(r.search_term.toLowerCase());
  for (const j of recentJobs) searched.add(j.searchTerm.toLowerCase());
  return searched;
}

async function enqueueTerms(terms: string[], label: string): Promise<number> {
  const { jobName, defaultJobOptions } = config.queue;
  let enqueued = 0;
  for (const term of terms) {
    await scraperQueue.add(
      jobName,
      { searchTerm: term, userId: `test-${label}`, scheduled: true },
      {
        attempts: defaultJobOptions.attempts,
        backoff: { type: "exponential", delay: defaultJobOptions.backoffDelay },
        removeOnComplete: defaultJobOptions.removeOnComplete,
        removeOnFail: defaultJobOptions.removeOnFail,
      },
    );
    enqueued++;
  }
  return enqueued;
}

async function waitForDrain(): Promise<void> {
  let waiting = await scraperQueue.getWaitingCount();
  let active = await scraperQueue.getActiveCount();
  while (waiting > 0 || active > 0) {
    process.stdout.write(`\r  Queue: ${active} active, ${waiting} waiting...   `);
    await new Promise(resolve => setTimeout(resolve, 10000));
    waiting = await scraperQueue.getWaitingCount();
    active = await scraperQueue.getActiveCount();
  }
  process.stdout.write("\r  Queue drained.                          \n");
}

async function main() {
  const searched = await getSearchedTerms();
  console.log(`Already searched terms: ${searched.size}`);

  // ── Strategy 2: Static name lists ────────────────────────────────────
  const staticNames = [
    "Michael","Christopher","Matthew","Joshua","Andrew","Daniel","Joseph","David",
    "James","Robert","William","Richard","Thomas","Steven","Timothy","Kevin",
    "Jason","Jeffrey","Ryan","Jacob","Nicholas","Brandon","Justin","Samuel",
    "Benjamin","Jonathan","Nathan","Zachary","Adam","Patrick","Alexander","Eric",
    "Brian","Gregory","Raymond","Dennis","Jerry","Henry","Douglas","Lawrence",
    "Gerald","Bruce","Russell","Louis","Philip","Howard","Carl","Terry",
    "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis",
    "Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson",
    "Taylor","Thomas","Moore","Jackson","Martin","White","Harris","Thompson",
    "Robinson","Clark","Lewis","Walker","Hall","Allen","Young","King",
    "Wright","Scott","Green","Baker","Adams","Nelson","Hill","Ramirez",
    "Campbell","Mitchell","Roberts","Carter","Phillips","Evans","Turner","Torres",
    "Properties","Holdings","Investments","Capital","Realty","Development",
    "Construction","Associates","Corporation","Company","Family","Group",
  ];

  const s2terms: string[] = [];
  for (const t of staticNames) {
    if (t.length >= 4 && !searched.has(t.toLowerCase())) {
      s2terms.push(t);
      if (s2terms.length >= BATCH_SIZE) break;
    }
  }

  // ── Strategy 3: Prefix expansion of high-yield 2025 terms ───────────
  const top2025 = await prisma.$queryRaw<Array<{ search_term: string; cnt: number }>>`
    SELECT search_term, COUNT(DISTINCT property_id)::int as cnt
    FROM properties WHERE year = 2025
    GROUP BY search_term
    HAVING COUNT(DISTINCT property_id) >= 500
    ORDER BY cnt DESC
    LIMIT 20`;

  const alpha = "abcdefghijklmnopqrstuvwxyz";
  const s3terms: string[] = [];
  for (const t of top2025) {
    if (t.search_term.length > 6) continue;
    for (const ch of alpha) {
      const exp = t.search_term + ch;
      if (!searched.has(exp.toLowerCase()) && exp.length >= 4) {
        s3terms.push(exp);
        if (s3terms.length >= BATCH_SIZE) break;
      }
    }
    if (s3terms.length >= BATCH_SIZE) break;
  }

  console.log(`\n=== Strategy 2: Static Name Lists (${s2terms.length} terms) ===`);
  console.log(`  Terms: ${s2terms.join(", ")}`);

  console.log(`\n=== Strategy 3: Prefix Expansion (${s3terms.length} terms) ===`);
  console.log(`  Base terms: ${top2025.filter(t => t.search_term.length <= 6).map(t => `${t.search_term}(${t.cnt})`).join(", ")}`);
  console.log(`  Terms: ${s3terms.join(", ")}`);

  // ── Run Strategy 2 ──────────────────────────────────────────────────
  console.log(`\n--- Running Strategy 2 ---`);
  const s2start = await getCount();
  const s2startTime = Date.now();
  await enqueueTerms(s2terms, "strategy2");
  await waitForDrain();
  const s2end = await getCount();
  const s2elapsed = ((Date.now() - s2startTime) / 1000).toFixed(0);
  const s2gained = s2end - s2start;

  const s2jobs = await prisma.scrapeJob.findMany({
    where: { startedAt: { gte: new Date(s2startTime) } },
    select: { searchTerm: true, resultCount: true, status: true },
    orderBy: { resultCount: "desc" },
  });
  const s2completed = s2jobs.filter(j => j.status === "completed");
  const s2total = s2completed.reduce((s, j) => s + (j.resultCount || 0), 0);

  console.log(`  Elapsed: ${s2elapsed}s`);
  console.log(`  Results fetched: ${s2total.toLocaleString()}`);
  console.log(`  New unique: +${s2gained.toLocaleString()}`);
  console.log(`  Dedup ratio: ${s2total > 0 ? ((1 - s2gained / s2total) * 100).toFixed(1) : "N/A"}%`);
  console.log(`  Top 5:`);
  for (const j of s2completed.slice(0, 5)) {
    console.log(`    ${(j.searchTerm || "").padEnd(20)} -> ${j.resultCount || 0}`);
  }

  // ── Run Strategy 3 ──────────────────────────────────────────────────
  console.log(`\n--- Running Strategy 3 ---`);
  const s3start = await getCount();
  const s3startTime = Date.now();
  await enqueueTerms(s3terms, "strategy3");
  await waitForDrain();
  const s3end = await getCount();
  const s3elapsed = ((Date.now() - s3startTime) / 1000).toFixed(0);
  const s3gained = s3end - s3start;

  const s3jobs = await prisma.scrapeJob.findMany({
    where: { startedAt: { gte: new Date(s3startTime) } },
    select: { searchTerm: true, resultCount: true, status: true },
    orderBy: { resultCount: "desc" },
  });
  const s3completed = s3jobs.filter(j => j.status === "completed");
  const s3total = s3completed.reduce((s, j) => s + (j.resultCount || 0), 0);

  console.log(`  Elapsed: ${s3elapsed}s`);
  console.log(`  Results fetched: ${s3total.toLocaleString()}`);
  console.log(`  New unique: +${s3gained.toLocaleString()}`);
  console.log(`  Dedup ratio: ${s3total > 0 ? ((1 - s3gained / s3total) * 100).toFixed(1) : "N/A"}%`);
  console.log(`  Top 5:`);
  for (const j of s3completed.slice(0, 5)) {
    console.log(`    ${(j.searchTerm || "").padEnd(20)} -> ${j.resultCount || 0}`);
  }

  // ── Comparison ──────────────────────────────────────────────────────
  const finalCount = await getCount();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`COMPARISON`);
  console.log(`${"=".repeat(60)}`);
  console.log(`                    Strategy 2       Strategy 3`);
  console.log(`                    (static names)   (prefix expansion)`);
  console.log(`  Terms:            ${String(s2terms.length).padStart(5)}            ${String(s3terms.length).padStart(5)}`);
  console.log(`  Results fetched:  ${String(s2total).padStart(5)}            ${String(s3total).padStart(5)}`);
  console.log(`  New unique:       ${String(s2gained).padStart(5)}            ${String(s3gained).padStart(5)}`);
  console.log(`  Yield/term:       ${(s2gained / (s2terms.length || 1)).toFixed(1).padStart(5)}            ${(s3gained / (s3terms.length || 1)).toFixed(1).padStart(5)}`);
  console.log(`  Dedup %:          ${(s2total > 0 ? ((1 - s2gained / s2total) * 100).toFixed(1) : "N/A").padStart(5)}            ${(s3total > 0 ? ((1 - s3gained / s3total) * 100).toFixed(1) : "N/A").padStart(5)}`);
  console.log(`  Elapsed:          ${(s2elapsed + "s").padStart(5)}            ${(s3elapsed + "s").padStart(5)}`);
  console.log(`\n  Final 2025 count: ${finalCount.toLocaleString()}`);
  console.log(`  Gap to 420K: ${(420000 - finalCount).toLocaleString()}`);
  console.log(`  Winner: ${s2gained > s3gained ? "Strategy 2 (static names)" : s3gained > s2gained ? "Strategy 3 (prefix expansion)" : "TIE"}`);
}

main()
  .catch(err => { console.error("Fatal:", err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await scraperQueue.close(); });
