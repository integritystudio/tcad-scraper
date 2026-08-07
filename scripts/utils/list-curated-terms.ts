/**
 * Deduplicated inventory of the curated manual-backfill term lists.
 *
 * Extends the pattern from utils/list-all-search-terms.ts (which covers the
 * active search pool: batch-configs + fallback-terms) to the manual-backfill pool:
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

const NUMERIC_ONLY = /^\d+$/;

function sortInsensitive(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export interface CuratedTermInventory {
  /** All unique non-numeric terms across all curated backfill lists */
  all: string[];
  /** Terms that appear in more than one list (must stay empty) */
  duplicated: string[];
  /** Per-source breakdown */
  sources: Record<string, string[]>;
}

/** Collect and deduplicate all manual-backfill curated term lists. */
export function getCuratedTermInventory(): CuratedTermInventory {
  // Manual-backfill pool sources in priority order
  const sources: Record<string, readonly string[]> = {
    BACKFILL_2025_STATIC_TERMS,
    CANDIDATE_FIRST_NAMES,
    CANDIDATE_LAST_NAMES,
    CANDIDATE_GEOGRAPHIC,
    CANDIDATE_ENTITY,
  };

  // Track which terms appear in which source (case-insensitive)
  const seenLower = new Map<string, string>(); // lower → first source name
  const duplicated: string[] = [];

  const sourceResults: Record<string, string[]> = {};
  for (const [name, list] of Object.entries(sources)) {
    sourceResults[name] = [];
    for (const term of list) {
      if (NUMERIC_ONLY.test(term)) continue;
      const lower = term.toLowerCase();

      const firstSeen = seenLower.get(lower);
      if (firstSeen !== undefined) {
        duplicated.push(`${term} [${name} ∩ ${firstSeen}]`);
      } else {
        seenLower.set(lower, name);
        sourceResults[name].push(term);
      }
    }
  }

  const all = [...seenLower.keys()]
    .map((lower) => {
      for (const list of Object.values(sources)) {
        const match = [...list].find((t) => t.toLowerCase() === lower);
        if (match) return match;
      }
      return lower;
    })
    .sort(sortInsensitive);

  return {
    all,
    duplicated: duplicated.sort(sortInsensitive),
    sources: sourceResults,
  };
}

// ── CLI output ────────────────────────────────────────────────────────

function printRows(terms: string[], indent = "  ", perRow = 8): void {
  for (let i = 0; i < terms.length; i += perRow) {
    console.log(indent + terms.slice(i, i + perRow).join(", "));
  }
}

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
    printRows(terms);
    console.log();
  }

  if (duplicated.length > 0) {
    console.log(`--- DUPLICATED (${duplicated.length}) ---`);
    printRows(duplicated);
    console.log();
  }
}
