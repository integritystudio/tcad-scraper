/**
 * Check which inventory terms haven't been searched yet (2025 properties).
 * Uses batched EXISTS queries to avoid full table scans.
 * Usage: doppler run -- npx tsx src/scripts/check-unsearched-terms.ts
 */
import { PrismaClient } from '@prisma/client';
import { getAllSearchTerms } from './utils/list-all-search-terms';

const prisma = new PrismaClient();

async function check() {
  const allTerms = getAllSearchTerms().all;
  console.log('Total inventory terms:', allTerms.length);

  // Batch EXISTS checks — 50 at a time
  const BATCH = 50;
  const unsearched: string[] = [];
  let checked = 0;

  for (let i = 0; i < allTerms.length; i += BATCH) {
    const batch = allTerms.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (term) => {
        const rows = await prisma.$queryRawUnsafe<{ found: boolean }[]>(
          `SELECT EXISTS(SELECT 1 FROM properties WHERE search_term = $1 AND year = 2025) as found`,
          term,
        );
        return { term, found: rows[0].found };
      }),
    );
    for (const r of results) {
      if (!r.found) unsearched.push(r.term);
    }
    checked += batch.length;
    if (checked % 100 === 0) console.log(`  checked ${checked}/${allTerms.length}...`);
  }

  console.log('Searched:', allTerms.length - unsearched.length);
  console.log('Unsearched:', unsearched.length);
  if (unsearched.length > 0) {
    console.log('\nUnsearched terms:');
    for (const t of unsearched) {
      console.log(' ', t);
    }
  } else {
    console.log('\nAll inventory terms have been searched for 2025.');
  }

  await prisma.$disconnect();
}

check().catch(console.error);
