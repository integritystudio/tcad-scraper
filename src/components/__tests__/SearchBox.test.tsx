/**
 * SearchBox Component Tests
 *
 * Tests for SearchBox accessibility improvements including:
 * - Semantic HTML structure (<search> element)
 * - ARIA labels and attributes
 * - Screen reader support
 * - Keyboard navigation
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "../features/PropertySearch/SearchBox";

const LIVE_SEARCH_DEBOUNCE_MS = 1_500;
const LIVE_SEARCH_MIN_LENGTH = 3;

describe("SearchBox", () => {
	describe("Accessibility", () => {
		it("should have role='search' on container", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const searchContainer = document.querySelector("search");
			expect(searchContainer).toBeInTheDocument();
		});

		it("should have accessible label for search input", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const input = screen.getByRole("searchbox");
			expect(input).toHaveAccessibleName();
			expect(input.getAttribute("aria-label")).toBe(
				"Search properties by name, address, or natural language query",
			);
		});

		it("should have screen-reader-only label element", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			// Check for the hidden label
			const label = screen.getByText("Search properties");
			expect(label).toBeInTheDocument();
			expect(label.tagName).toBe("LABEL");
		});

		it("should have aria-describedby pointing to hint text", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const input = screen.getByRole("searchbox");
			const describedById = input.getAttribute("aria-describedby");
			expect(describedById).toBeTruthy();

			// The hint should contain example search terms
			const hint = document.getElementById(describedById as string);
			expect(hint).toBeInTheDocument();
			expect(hint?.textContent).toContain("properties in Austin");
		});

		it("should set aria-busy when loading", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} loading={true} />);

			const input = screen.getByRole("searchbox");
			expect(input).toHaveAttribute("aria-busy", "true");
		});

		it("should not set aria-busy when not loading", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} loading={false} />);

			const input = screen.getByRole("searchbox");
			expect(input).toHaveAttribute("aria-busy", "false");
		});

		it("should have aria-hidden on decorative search icon", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			// The search icon container should be hidden from screen readers
			const searchContainer = document.querySelector("search");
			const iconContainer = searchContainer?.querySelector(
				'[aria-hidden="true"]',
			);
			expect(iconContainer).toBeInTheDocument();
		});

		it("should have appropriate aria-label on search button", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const button = screen.getByRole("button");
			expect(button).toHaveAttribute("aria-label", "Search properties");
		});

		it("should update button aria-label when loading", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} loading={true} />);

			const button = screen.getByRole("button");
			expect(button).toHaveAttribute("aria-label", "Searching properties");
		});
	});

	describe("Functionality", () => {
		it("should call onSearch when Enter is pressed", async () => {
			const user = userEvent.setup();
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const input = screen.getByRole("searchbox");
			await user.click(input);
			await user.type(input, "test query{Enter}");

			expect(onSearch).toHaveBeenCalledWith("test query");
		});

		it("should call onSearch when button is clicked", async () => {
			const user = userEvent.setup();
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const input = screen.getByRole("searchbox");
			await user.type(input, "test query");

			const button = screen.getByRole("button");
			await user.click(button);

			expect(onSearch).toHaveBeenCalledWith("test query");
		});

		it("should not call onSearch with empty query", async () => {
			const user = userEvent.setup();
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const button = screen.getByRole("button");
			await user.click(button);

			expect(onSearch).not.toHaveBeenCalled();
		});

		it("should not call onSearch with whitespace-only query", async () => {
			const user = userEvent.setup();
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const input = screen.getByRole("searchbox");
			await user.type(input, "   ");

			const button = screen.getByRole("button");
			await user.click(button);

			expect(onSearch).not.toHaveBeenCalled();
		});

		it("should disable input when loading", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} loading={true} />);

			const input = screen.getByRole("searchbox");
			expect(input).toBeDisabled();
		});

		it("should disable button when loading", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} loading={true} />);

			const button = screen.getByRole("button");
			expect(button).toBeDisabled();
		});

		it("should use custom placeholder when provided", () => {
			const onSearch = vi.fn();
			render(
				<SearchBox onSearch={onSearch} placeholder="Custom placeholder" />,
			);

			const input = screen.getByRole("searchbox");
			expect(input).toHaveAttribute("placeholder", "Custom placeholder");
		});
	});

	describe("Live search (debounce)", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			act(() => vi.runOnlyPendingTimers());
			vi.useRealTimers();
		});

		it("fires a debounced search after typing settles, without Enter or a click", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, { target: { value: "Oak Street" } });
			expect(onSearch).not.toHaveBeenCalled();

			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));

			expect(onSearch).toHaveBeenCalledTimes(1);
			expect(onSearch).toHaveBeenCalledWith("Oak Street");
		});

		it("does not fire before the debounce delay elapses", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, { target: { value: "Oak Street" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS - 1));

			expect(onSearch).not.toHaveBeenCalled();
		});

		it("collapses rapid typing into a single call with the latest value", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, { target: { value: "O" } });
			act(() => vi.advanceTimersByTime(500));
			fireEvent.change(input, { target: { value: "Oak" } });
			act(() => vi.advanceTimersByTime(500));
			fireEvent.change(input, { target: { value: "Oak Street" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));

			expect(onSearch).toHaveBeenCalledTimes(1);
			expect(onSearch).toHaveBeenCalledWith("Oak Street");
		});

		it("does not duplicate a query already searched via Enter", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, { target: { value: "Oak Street" } });
			fireEvent.keyDown(input, { key: "Enter" });
			expect(onSearch).toHaveBeenCalledTimes(1);

			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));

			expect(onSearch).toHaveBeenCalledTimes(1);
		});

		it("does not duplicate a query already searched via the button click", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");
			const button = screen.getByRole("button");

			fireEvent.change(input, { target: { value: "Oak Street" } });
			fireEvent.click(button);
			expect(onSearch).toHaveBeenCalledTimes(1);

			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));

			expect(onSearch).toHaveBeenCalledTimes(1);
		});

		it("does not fire the debounced search for a whitespace-only query", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, { target: { value: "   " } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));

			expect(onSearch).not.toHaveBeenCalled();
		});

		it("does not fire the debounced search below the minimum length", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, {
				target: { value: "a".repeat(LIVE_SEARCH_MIN_LENGTH - 1) },
			});
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));

			expect(onSearch).not.toHaveBeenCalled();
		});

		it("fires the debounced search once the minimum length is reached", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");
			const value = "a".repeat(LIVE_SEARCH_MIN_LENGTH);

			fireEvent.change(input, { target: { value } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));

			expect(onSearch).toHaveBeenCalledTimes(1);
			expect(onSearch).toHaveBeenCalledWith(value);
		});

		it("still allows an explicit Enter/click search below the minimum length", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, {
				target: { value: "a".repeat(LIVE_SEARCH_MIN_LENGTH - 1) },
			});
			fireEvent.keyDown(input, { key: "Enter" });

			expect(onSearch).toHaveBeenCalledTimes(1);
		});

		it("does not duplicate via Enter a query already fired by the debounce", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, { target: { value: "Oak Street" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));
			expect(onSearch).toHaveBeenCalledTimes(1);

			fireEvent.keyDown(input, { key: "Enter" });

			expect(onSearch).toHaveBeenCalledTimes(1);
		});

		it("does not duplicate via the button click a query already fired by the debounce", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");
			const button = screen.getByRole("button");

			fireEvent.change(input, { target: { value: "Oak Street" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));
			expect(onSearch).toHaveBeenCalledTimes(1);

			fireEvent.click(button);

			expect(onSearch).toHaveBeenCalledTimes(1);
		});

		it("still fires a new debounced search after Enter, once the query changes again", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, { target: { value: "Oak Street" } });
			fireEvent.keyDown(input, { key: "Enter" });
			expect(onSearch).toHaveBeenCalledTimes(1);

			fireEvent.change(input, { target: { value: "Oak Street Austin" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));

			expect(onSearch).toHaveBeenCalledTimes(2);
			expect(onSearch).toHaveBeenNthCalledWith(2, "Oak Street Austin");
		});

		// L19 raised an A->B->A edit (typo, then correction) as a redundant
		// search. These two cases pin why a single-value lastSearchedRef is
		// correct and a multi-value "already seen" set would be a regression.
		it("does not re-search when a typo is corrected within the debounce window", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, { target: { value: "Oak Street" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));
			expect(onSearch).toHaveBeenCalledTimes(1);

			// B never settles — useDebounce clears the pending timer — so the
			// correction back to A is caught by lastSearchedRef, not dispatched.
			fireEvent.change(input, { target: { value: "Oak Streett" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS - 1));
			fireEvent.change(input, { target: { value: "Oak Street" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));

			expect(onSearch).toHaveBeenCalledTimes(1);
		});

		it("re-searches A after B settled, so results match the visible query", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);
			const input = screen.getByRole("searchbox");

			fireEvent.change(input, { target: { value: "Oak Street" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));
			fireEvent.change(input, { target: { value: "Elm Street" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));
			expect(onSearch).toHaveBeenCalledTimes(2);

			// B's results are on screen now, so returning to A must re-search —
			// suppressing this would leave Elm Street results under "Oak Street".
			fireEvent.change(input, { target: { value: "Oak Street" } });
			act(() => vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS));

			expect(onSearch).toHaveBeenCalledTimes(3);
			expect(onSearch).toHaveBeenNthCalledWith(3, "Oak Street");
		});
	});

	describe("Semantic HTML", () => {
		it("should use <search> element as container", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const searchElement = document.querySelector("search");
			expect(searchElement).toBeInTheDocument();
		});

		it("should use type='search' for input", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const input = screen.getByRole("searchbox");
			expect(input).toHaveAttribute("type", "search");
		});

		it("should have autocomplete='off'", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const input = screen.getByRole("searchbox");
			expect(input).toHaveAttribute("autocomplete", "off");
		});
	});
});
