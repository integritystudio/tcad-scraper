/**
 * Shared error message extraction utility.
 * Replaces the repeated `error instanceof Error ? error.message : String(error)` pattern.
 */

export function getErrorMessage(error: unknown, fallback?: string): string {
	if (error instanceof Error) return error.message;
	return fallback ?? String(error);
}
