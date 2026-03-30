/**
 * Transform pg_dump SQL output to D1-compatible SQL.
 *
 * Usage:
 *   npx tsx scripts/pg-to-d1-transform.ts <input.sql> [output-prefix]
 *
 * Changes applied:
 *  - Remove SET statements, pg_catalog references, schema prefixes
 *  - Convert boolean TRUE/FALSE to 1/0
 *  - Convert PostgreSQL array literals '{...}' to JSON '["..."]'
 *  - Remove type casts (::text, ::integer, etc.)
 *  - Split into batch files of N rows each (D1 import timeout is 30s)
 *
 * Example:
 *   pg_dump --data-only --inserts --rows-per-insert=1 --no-owner --no-privileges \
 *     --table=properties --table=scrape_jobs --table=monitored_searches \
 *     --table=search_term_analytics --table=api_usage_logs > /tmp/tcad-pg-dump.sql
 *   npx tsx scripts/pg-to-d1-transform.ts /tmp/tcad-pg-dump.sql /tmp/tcad-d1-batch
 */

import { readFileSync, writeFileSync } from "node:fs";

const BATCH_SIZE = 5000;

const inputFile = process.argv[2];
const outputPrefix = process.argv[3] || "/tmp/tcad-d1-batch";

if (!inputFile) {
  console.error("Usage: npx tsx scripts/pg-to-d1-transform.ts <input.sql> [output-prefix]");
  process.exit(1);
}

const input = readFileSync(inputFile, "utf-8");
const lines = input.split("\n");

const transformed: string[] = [];
let skipped = 0;

for (const line of lines) {
  // Skip PostgreSQL-specific directives
  if (
    line.startsWith("SET ") ||
    line.startsWith("SELECT pg_catalog.") ||
    line.startsWith("--") ||
    line.trim() === ""
  ) {
    skipped++;
    continue;
  }

  let sql = line;

  // Remove type casts (::text, ::integer, ::bigint, ::boolean, ::timestamp, etc.)
  sql = sql.replace(/::(text|integer|bigint|boolean|timestamp|float|double precision|numeric)/gi, "");

  // Convert boolean literals
  sql = sql.replace(/\bTRUE\b/g, "1");
  sql = sql.replace(/\bFALSE\b/g, "0");

  // Convert PostgreSQL array literals: '{id1,id2}' -> '["id1","id2"]'
  sql = sql.replace(/'\{([^}]*)\}'/g, (_match: string, contents: string) => {
    if (!contents) return "'[]'";
    const items = contents.split(",").map((s: string) => `"${s.trim()}"`);
    return `'[${items.join(",")}]'`;
  });

  // Convert empty PostgreSQL arrays: '{}' -> '[]'
  sql = sql.replace(/'\{\}'/g, "'[]'");

  // Remove public. schema prefix
  sql = sql.replace(/\bpublic\./g, "");

  transformed.push(sql);
}

// Split into batch files
const totalBatches = Math.ceil(transformed.length / BATCH_SIZE);

for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
  const batch = transformed.slice(i, i + BATCH_SIZE);
  const batchNum = String(Math.floor(i / BATCH_SIZE)).padStart(4, "0");
  const filename = `${outputPrefix}-${batchNum}.sql`;
  writeFileSync(filename, batch.join("\n"));
  console.log(`Wrote ${batch.length} statements to ${filename}`);
}

console.log(`\nSummary:`);
console.log(`  Input lines: ${lines.length}`);
console.log(`  Skipped: ${skipped}`);
console.log(`  Transformed: ${transformed.length} statements`);
console.log(`  Output: ${totalBatches} batch file(s) at ${outputPrefix}-*.sql`);
console.log(`\nNext steps:`);
console.log(`  cd workers/tcad-api`);
console.log(`  for f in ${outputPrefix}-*.sql; do`);
console.log(`    echo "Importing $f..."`);
console.log(`    npx wrangler d1 execute tcad-db --remote --file "$f"`);
console.log(`  done`);
