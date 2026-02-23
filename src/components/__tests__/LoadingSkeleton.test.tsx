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
			render(<LoadingSkeleton />);
			expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
		});

		it("should render search variant", () => {
			render(<LoadingSkeleton variant="search" />);
			expect(screen.getByTestId("search-skeleton")).toBeInTheDocument();
		});

		it("should render card variant", () => {
			render(<LoadingSkeleton variant="card" />);
			expect(screen.getByTestId("cards-skeleton")).toBeInTheDocument();
		});
	});

	describe("Card Variant Count", () => {
		it("should render default 3 skeleton cards", () => {
			render(<LoadingSkeleton variant="card" />);
			expect(screen.getAllByTestId("card-skeleton")).toHaveLength(3);
		});

		it("should render specified number of skeleton cards", () => {
			render(<LoadingSkeleton variant="card" count={5} />);
			expect(screen.getAllByTestId("card-skeleton")).toHaveLength(5);
		});

		it("should render 1 skeleton card when count is 1", () => {
			render(<LoadingSkeleton variant="card" count={1} />);
			expect(screen.getAllByTestId("card-skeleton")).toHaveLength(1);
		});
	});

	describe("Structure", () => {
		it("should include hero skeleton in search variant", () => {
			render(<LoadingSkeleton variant="search" />);

			expect(screen.getByTestId("hero-skeleton")).toBeInTheDocument();
			expect(screen.getByTestId("title-skeleton")).toBeInTheDocument();
			expect(screen.getByTestId("subtitle-skeleton")).toBeInTheDocument();
			expect(screen.getByTestId("searchbox-skeleton")).toBeInTheDocument();
		});

		it("should include hero and content in page variant", () => {
			render(<LoadingSkeleton variant="page" />);

			expect(screen.getByTestId("hero-skeleton")).toBeInTheDocument();
			expect(screen.getByTestId("content-skeleton")).toBeInTheDocument();
		});

		it("should include card body with lines", () => {
			render(<LoadingSkeleton variant="card" count={1} />);

			expect(screen.getByTestId("card-body")).toBeInTheDocument();
			expect(screen.getAllByTestId("skeleton-line").length).toBeGreaterThan(0);
		});
	});
});
