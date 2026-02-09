/**
 * Shared error message extraction utility.
 * Replaces the repeated `error instanceof Error ? error.message : String(error)` pattern.
 */

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
