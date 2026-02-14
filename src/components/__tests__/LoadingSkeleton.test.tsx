/**
 * LoadingSkeleton Component Tests
 *
 * Tests for LoadingSkeleton component used as Suspense fallback
 * for React.lazy() code splitting.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingSkeleton } from "../ui/LoadingSkeleton";

describe("LoadingSkeleton", () => {
	describe("Accessibility", () => {
		it("should have role='status' for screen readers", () => {
			render(<LoadingSkeleton />);

			const skeleton = screen.getByRole("status");
			expect(skeleton).toBeInTheDocument();
		});

		it("should have aria-busy='true' to indicate loading", () => {
			render(<LoadingSkeleton />);

			const skeleton = screen.getByRole("status");
			expect(skeleton).toHaveAttribute("aria-busy", "true");
		});

		it("should have screen-reader-only loading text for page variant", () => {
			render(<LoadingSkeleton variant="page" />);

			const srText = screen.getByText("Loading application...");
			expect(srText).toBeInTheDocument();
		});

		it("should have screen-reader-only loading text for search variant", () => {
			render(<LoadingSkeleton variant="search" />);

			const srText = screen.getByText("Loading search interface...");
			expect(srText).toBeInTheDocument();
		});

		it("should have screen-reader-only loading text for card variant", () => {
			render(<LoadingSkeleton variant="card" />);

			const srText = screen.getByText("Loading property cards...");
			expect(srText).toBeInTheDocument();
		});
	});

	describe("Variants", () => {
		it("should render page variant by default", () => {
			const { container } = render(<LoadingSkeleton />);

			// Page skeleton has pageSkeleton class
			const pageElement = container.querySelector('[class*="pageSkeleton"]');
			expect(pageElement).toBeInTheDocument();
		});

		it("should render search variant", () => {
			const { container } = render(<LoadingSkeleton variant="search" />);

			const searchElement = container.querySelector(
				'[class*="searchSkeleton"]',
			);
			expect(searchElement).toBeInTheDocument();
		});

		it("should render card variant", () => {
			const { container } = render(<LoadingSkeleton variant="card" />);

			const cardElement = container.querySelector('[class*="cardsSkeleton"]');
			expect(cardElement).toBeInTheDocument();
		});
	});

	describe("Card Variant Count", () => {
		it("should render default 3 skeleton cards", () => {
			const { container } = render(<LoadingSkeleton variant="card" />);

			const cards = container.querySelectorAll('[class*="cardSkeleton"]');
			expect(cards).toHaveLength(3);
		});

		it("should render specified number of skeleton cards", () => {
			const { container } = render(
				<LoadingSkeleton variant="card" count={5} />,
			);

			const cards = container.querySelectorAll('[class*="cardSkeleton"]');
			expect(cards).toHaveLength(5);
		});

		it("should render 1 skeleton card when count is 1", () => {
			const { container } = render(
				<LoadingSkeleton variant="card" count={1} />,
			);

			const cards = container.querySelectorAll('[class*="cardSkeleton"]');
			expect(cards).toHaveLength(1);
		});
	});

	describe("Structure", () => {
		it("should include hero skeleton in search variant", () => {
			const { container } = render(<LoadingSkeleton variant="search" />);

			const hero = container.querySelector('[class*="heroSkeleton"]');
			const title = container.querySelector('[class*="titleSkeleton"]');
			const subtitle = container.querySelector('[class*="subtitleSkeleton"]');
			const searchBox = container.querySelector('[class*="searchBoxSkeleton"]');

			expect(hero).toBeInTheDocument();
			expect(title).toBeInTheDocument();
			expect(subtitle).toBeInTheDocument();
			expect(searchBox).toBeInTheDocument();
		});

		it("should include hero and content in page variant", () => {
			const { container } = render(<LoadingSkeleton variant="page" />);

			const hero = container.querySelector('[class*="heroSkeleton"]');
			const content = container.querySelector('[class*="contentSkeleton"]');

			expect(hero).toBeInTheDocument();
			expect(content).toBeInTheDocument();
		});

		it("should include card body with lines", () => {
			const { container } = render(
				<LoadingSkeleton variant="card" count={1} />,
			);

			const cardBody = container.querySelector('[class*="cardBody"]');
			const lines = container.querySelectorAll('[class*="line"]');

			expect(cardBody).toBeInTheDocument();
			expect(lines.length).toBeGreaterThan(0);
		});
	});
});
