/** Shared helpers for backfill-2025* scripts. */

import { prisma } from "../../lib/prisma";
import { MIN_TERM_LENGTH } from "./backfill-constants";

/**
 * Count properties scraped for year 2025.
 *
 * Uses ::int cast because Prisma $queryRaw returns BigInt for COUNT(*);
 * without the cast the `number` annotation silently lies (BigInt !== number).
 */
export async function get2025Count(): Promise<number> {
  const result = await prisma.$queryRaw<[{ count: number }]>`
    SELECT COUNT(*)::int as count FROM properties WHERE year = 2025`;
  return result[0].count;
}

/**
 * Extension filter: skip candidates that extend an already-successful shorter term.
 * Example: skip "JOHNSONVIL" if "JOHNSON" yielded results — TCAD full-text search
 * returns all properties matching the shorter prefix, so it already captured this set.
 */
export function isSupersetOfSuccessful(lower: string, successful: Set<string>): boolean {
  for (let len = MIN_TERM_LENGTH; len < lower.length; len++) {
    if (successful.has(lower.substring(0, len))) return true;
  }
  return false;
}
