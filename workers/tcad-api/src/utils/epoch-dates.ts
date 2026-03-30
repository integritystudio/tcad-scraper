/**
 * Epoch date helpers for D1 (SQLite).
 *
 * D1's JavaScript binding auto-converts date-like TEXT strings on read,
 * which breaks Prisma's String type mapping. Storing dates as epoch
 * millisecond strings ("1711773684000") avoids this conversion.
 *
 * Epoch millisecond strings from 2020-2040 are all 13 characters,
 * so lexicographic string comparison matches chronological order.
 */

/** Current time as epoch millisecond string */
export function nowEpoch(): string {
  return String(Date.now());
}

/** Epoch millisecond string to ISO 8601 for API responses */
export function epochToISO(epoch: string): string {
  const ms = Number(epoch);
  if (!ms || ms <= 0) return "";
  return new Date(ms).toISOString();
}

/** Date to epoch millisecond string for Prisma writes */
export function dateToEpoch(date: Date): string {
  return String(date.getTime());
}
