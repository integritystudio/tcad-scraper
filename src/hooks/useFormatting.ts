import { useMemo } from "react";
import {
	formatCurrency,
	formatDate,
	formatNumber,
	formatPropertyType,
	truncateText,
} from "../utils/formatters";

/**
 * Hook providing formatting utilities
 * Consolidates all formatting logic in one place
 */
export const useFormatting = () => {
	return useMemo(
		() => ({
			formatCurrency,
			formatNumber,
			formatDate,
			formatPropertyType,
			truncateText,
		}),
		[],
	);
};
