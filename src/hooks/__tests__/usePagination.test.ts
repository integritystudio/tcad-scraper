/**
 * usePagination Hook Tests
 *
 * Regression coverage for the stale-page bug: when totalItems shrinks for a
 * textually identical query (no remount), currentPage must clamp down to
 * the last valid page instead of pointing past the end of the result set.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePagination } from "../usePagination";

describe("usePagination", () => {
	it("clamps currentPage to the last valid page when totalItems shrinks", () => {
		const { result, rerender } = renderHook(
			({ totalItems }) => usePagination({ totalItems, itemsPerPage: 10 }),
			{ initialProps: { totalItems: 50 } }, // 5 pages
		);

		act(() => result.current.goToPage(5));
		expect(result.current.currentPage).toBe(5);

		// Result set shrinks to 3 pages worth of items.
		rerender({ totalItems: 25 });

		expect(result.current.currentPage).toBe(3);
		expect(result.current.totalPages).toBe(3);
	});

	it("clamps to page 1 (not 0) when totalItems shrinks to zero", () => {
		const { result, rerender } = renderHook(
			({ totalItems }) => usePagination({ totalItems, itemsPerPage: 10 }),
			{ initialProps: { totalItems: 50 } },
		);

		act(() => result.current.goToPage(5));
		rerender({ totalItems: 0 });

		expect(result.current.currentPage).toBe(1);
	});

	it("does not change currentPage when totalItems grows", () => {
		const { result, rerender } = renderHook(
			({ totalItems }) => usePagination({ totalItems, itemsPerPage: 10 }),
			{ initialProps: { totalItems: 50 } },
		);

		act(() => result.current.goToPage(3));
		rerender({ totalItems: 100 });

		expect(result.current.currentPage).toBe(3);
	});
});
