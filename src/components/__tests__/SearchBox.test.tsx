/**
 * SearchBox Component Tests
 *
 * Tests for SearchBox accessibility improvements including:
 * - Semantic HTML structure (<search> element)
 * - ARIA labels and attributes
 * - Screen reader support
 * - Keyboard navigation
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchBox } from "../features/PropertySearch/SearchBox";

describe("SearchBox", () => {
	describe("Accessibility", () => {
		it("should have role='search' on container", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const searchContainer = screen.getByRole("search");
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
			const searchContainer = screen.getByRole("search");
			const iconContainer = searchContainer.querySelector(
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
		it("should call onSearch when Enter is pressed", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const input = screen.getByRole("searchbox");
			fireEvent.change(input, { target: { value: "test query" } });
			fireEvent.keyDown(input, { key: "Enter" });

			expect(onSearch).toHaveBeenCalledWith("test query");
		});

		it("should call onSearch when button is clicked", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const input = screen.getByRole("searchbox");
			fireEvent.change(input, { target: { value: "test query" } });

			const button = screen.getByRole("button");
			fireEvent.click(button);

			expect(onSearch).toHaveBeenCalledWith("test query");
		});

		it("should not call onSearch with empty query", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const button = screen.getByRole("button");
			fireEvent.click(button);

			expect(onSearch).not.toHaveBeenCalled();
		});

		it("should not call onSearch with whitespace-only query", () => {
			const onSearch = vi.fn();
			render(<SearchBox onSearch={onSearch} />);

			const input = screen.getByRole("searchbox");
			fireEvent.change(input, { target: { value: "   " } });

			const button = screen.getByRole("button");
			fireEvent.click(button);

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
