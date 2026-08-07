/**
 * Deduplicated inventory of the curated manual-backfill term lists.
 *
 * Extends the pattern from utils/list-all-search-terms.ts (which covers the
 * active search pool: batch-configs + curated-names) to the manual-backfill pool:
 *   - config/backfill-2025-static-terms.ts (BACKFILL_2025_STATIC_TERMS)
 *   - generate-next-200-terms.ts (CANDIDATE_FIRST_NAMES, CANDIDATE_LAST_NAMES,
 *     CANDIDATE_GEOGRAPHIC, CANDIDATE_ENTITY)
 *
 * Note: BACKFILL_2025_SOURCE_TERMS is already part of the active pool (it is
 * imported by batch-configs.ts as the "backfill-2025-source" batch type and is
 * therefore covered by list-all-search-terms.ts).
 *
 * Invariant: the `duplicated` bucket must stay empty — each term lives in exactly
 * one list within this pool. Overlap with the active pool is resolved at runtime
 * by getSearchedTermSets(), not enforced here.
 *
 * CLI: npx tsx scripts/utils/list-curated-terms.ts
 */

import { pathToFileURL } from "node:url";
import { BACKFILL_2025_STATIC_TERMS } from "../config/backfill-2025-static-terms";
import {
  CANDIDATE_ENTITY,
  CANDIDATE_FIRST_NAMES,
  CANDIDATE_GEOGRAPHIC,
  CANDIDATE_LAST_NAMES,
} from "../generate-next-200-terms";
import {
  buildTermInventory,
  printTermRows,
  type TermInventory,
} from "../lib/term-inventory";

export type CuratedTermInventory = TermInventory;

/** Collect and deduplicate all manual-backfill curated term lists. */
export function getCuratedTermInventory(): CuratedTermInventory {
  // Manual-backfill pool sources in priority order
  return buildTermInventory({
    BACKFILL_2025_STATIC_TERMS,
    CANDIDATE_FIRST_NAMES,
    CANDIDATE_LAST_NAMES,
    CANDIDATE_GEOGRAPHIC,
    CANDIDATE_ENTITY,
  });
}

// ── CLI output ────────────────────────────────────────────────────────

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { all, duplicated, sources } = getCuratedTermInventory();

  console.log("=== CURATED BACKFILL TERM INVENTORY ===\n");
  console.log(`Total unique terms: ${all.length}`);
  console.log(`Duplicated (must be 0): ${duplicated.length}\n`);

  for (const [name, terms] of Object.entries(sources)) {
    console.log(`--- ${name} (${terms.length}) ---`);
    printTermRows(terms);
    console.log();
  }

  if (duplicated.length > 0) {
    console.log(`--- DUPLICATED (${duplicated.length}) ---`);
    printTermRows(duplicated);
    console.log();
  }
}
