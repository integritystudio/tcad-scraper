/**
 * SearchBox Component Tests
 *
 * Tests for SearchBox accessibility improvements including:
 * - Semantic HTML structure (<search> element)
 * - ARIA labels and attributes
 * - Screen reader support
 * - Keyboard navigation
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchBox } from "../features/PropertySearch/SearchBox";

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
