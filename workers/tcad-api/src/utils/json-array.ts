/**
 * JSON array serialization helpers for D1 (SQLite).
 * PostgreSQL String[] fields become JSON-serialized strings in D1.
 */

export function serializeIds(ids: string[]): string {
  return JSON.stringify(ids);
}

export function deserializeIds(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
