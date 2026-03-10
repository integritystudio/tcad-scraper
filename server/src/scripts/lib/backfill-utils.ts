/** Shared helpers for backfill-2025* scripts. */

import { prisma } from "../../lib/prisma";

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
