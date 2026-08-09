/**
 * Formatting utilities for the application
 * Consolidates all formatting logic in one place
 */

/**
 * Format a number as US currency
 * Handles null, undefined, and NaN values gracefully
 */
export const formatCurrency = (value: number | null | undefined): string => {
	// Handle null, undefined, NaN, or invalid values
	if (value === null || value === undefined || !Number.isFinite(value)) {
		return "-";
	}

	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
};

/**
 * Format a number with thousands separators
 * Handles null, undefined, and NaN values gracefully
 */
export const formatNumber = (value: number | null | undefined): string => {
	if (value === null || value === undefined || !Number.isFinite(value)) {
		return "-";
	}
	return new Intl.NumberFormat("en-US").format(value);
};

/**
 * Format a date string to readable format
 * Returns fallback for invalid/malformed dates
 */
export const formatDate = (dateString: string): string => {
	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
};

/**
 * Format property type for display
 */
export const formatPropertyType = (type: string): string => {
	if (!type) return "Unknown";
	return type
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 3)}...`;
};

export const MS_PER_MINUTE = 1000 * 60;
export const MS_PER_HOUR = MS_PER_MINUTE * 60;
export const MS_PER_DAY = MS_PER_HOUR * 24;

/**
 * Milliseconds elapsed between a date string and now. Callers that need more
 * than one unit should call this once and divide, rather than combining
 * daysSince() with their own Date.now() — that redoes the same subtraction and
 * can straddle a tick, yielding units read from two different "now"s.
 */
export const elapsedMs = (dateString: string): number =>
	Date.now() - new Date(dateString).getTime();

/**
 * Number of whole days elapsed between a date string and now
 */
export const daysSince = (dateString: string): number =>
	Math.floor(elapsedMs(dateString) / MS_PER_DAY);
