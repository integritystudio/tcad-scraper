/**
 * Epoch-ms display formatters for CLI scripts, alongside d1-prisma.ts's epochAgo.
 * D1 raw-query results are epoch-ms strings; Workers API JSON responses are
 * already ISO 8601 (converted via epochToISO on the way out) — both are
 * accepted here so callers don't need to know which source they're reading from.
 *
 * formatDateSortable renders in UTC; formatDateCompact renders in the
 * machine's local timezone (via toLocaleString) — pick the one that matches
 * what the call site needs.
 */

const EPOCH_MS_PATTERN = /^\d+$/;

/** Parse a D1 epoch-ms string or an API-response ISO 8601 string into a Date. */
export function parseEpochOrIso(value: string | null | undefined): Date | null {
	if (!value || value === "0") return null;
	const date = EPOCH_MS_PATTERN.test(value)
		? new Date(Number(value))
		: new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** "YYYY-MM-DD HH:MM:SS" — sortable, 24-hour, UTC. Falls back to "N/A". */
export function formatDateSortable(value: string | null | undefined): string {
	const date = parseEpochOrIso(value);
	if (!date) return "N/A";
	// toISOString() is "YYYY-MM-DDTHH:MM:SS.sssZ" — drop the "T", keep everything
	// up to whole seconds (cuts off ".sssZ").
	return date.toISOString().replace("T", " ").slice(0, 19);
}

/** "MMM DD, HH:MM AM/PM" — compact, table-friendly. Falls back to "N/A". */
export function formatDateCompact(value: string | null | undefined): string {
	const date = parseEpochOrIso(value);
	if (!date) return "N/A";
	return date.toLocaleString("en-US", {
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}
