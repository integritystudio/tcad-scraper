/**
 * Helper utility functions
 */

/**
 * Debounce a function call
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
	fn: T,
	delay: number,
): ((...args: Parameters<T>) => void) => {
	let timeoutId: ReturnType<typeof setTimeout>;

	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
};

/**
 * Throttle a function call
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
	fn: T,
	delay: number,
): ((...args: Parameters<T>) => void) => {
	let lastCall = 0;

	return (...args: Parameters<T>) => {
		const now = Date.now();
		if (now - lastCall >= delay) {
			lastCall = now;
			fn(...args);
		}
	};
};

/**
 * Group array items by a key
 */
export const groupBy = <T, K extends keyof T>(
	array: T[],
	key: K,
): Record<string, T[]> => {
	return array.reduce(
		(groups, item) => {
			const groupKey = String(item[key]);
			if (!groups[groupKey]) {
				groups[groupKey] = [];
			}
			groups[groupKey].push(item);
			return groups;
		},
		{} as Record<string, T[]>,
	);
};

/**
 * Check if a value is defined and not null
 */
export const isDefined = <T>(value: T | null | undefined): value is T => {
	return value !== null && value !== undefined;
};

/**
 * Safely parse JSON with fallback
 */
export const parseJSON = <T>(json: string, fallback: T): T => {
	try {
		return JSON.parse(json);
	} catch {
		return fallback;
	}
};
