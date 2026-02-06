import { useCallback, useMemo, useState } from "react";

interface UsePaginationProps {
	totalItems: number;
	itemsPerPage: number;
	initialPage?: number;
}

interface UsePaginationReturn {
	currentPage: number;
	totalPages: number;
	itemsPerPage: number;
	startIndex: number;
	endIndex: number;
	canGoNext: boolean;
	canGoPrev: boolean;
	goToPage: (page: number) => void;
	goToNextPage: () => void;
	goToPrevPage: () => void;
	goToFirstPage: () => void;
	goToLastPage: () => void;
}

/**
 * Hook for pagination logic
 * Handles page navigation and calculations
 */
export const usePagination = ({
	totalItems,
	itemsPerPage,
	initialPage = 1,
}: UsePaginationProps): UsePaginationReturn => {
	const [currentPage, setCurrentPage] = useState(initialPage);

	const safeItemsPerPage = Math.max(1, itemsPerPage);

	const totalPages = useMemo(
		() => Math.ceil(totalItems / safeItemsPerPage),
		[totalItems, safeItemsPerPage],
	);

	const startIndex = useMemo(
		() => (currentPage - 1) * safeItemsPerPage,
		[currentPage, safeItemsPerPage],
	);

	const endIndex = useMemo(
		() => Math.min(startIndex + safeItemsPerPage, totalItems),
		[startIndex, safeItemsPerPage, totalItems],
	);

	const canGoNext = useMemo(
		() => currentPage < totalPages,
		[currentPage, totalPages],
	);

	const canGoPrev = useMemo(() => currentPage > 1, [currentPage]);

	const goToPage = useCallback(
		(page: number) => {
			const pageNumber = Math.max(1, Math.min(page, totalPages));
			setCurrentPage(pageNumber);
		},
		[totalPages],
	);

	const goToNextPage = useCallback(() => {
		if (canGoNext) {
			setCurrentPage((prev) => prev + 1);
		}
	}, [canGoNext]);

	const goToPrevPage = useCallback(() => {
		if (canGoPrev) {
			setCurrentPage((prev) => prev - 1);
		}
	}, [canGoPrev]);

	const goToFirstPage = useCallback(() => {
		setCurrentPage(1);
	}, []);

	const goToLastPage = useCallback(() => {
		setCurrentPage(totalPages);
	}, [totalPages]);

	return {
		currentPage,
		totalPages,
		itemsPerPage: safeItemsPerPage,
		startIndex,
		endIndex,
		canGoNext,
		canGoPrev,
		goToPage,
		goToNextPage,
		goToPrevPage,
		goToFirstPage,
		goToLastPage,
	};
};
