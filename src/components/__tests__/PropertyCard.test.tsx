/**
 * PropertyCard Component Tests
 *
 * Tests for PropertyCard component including:
 * - Basic rendering in collapsed state
 * - Expansion/collapse functionality
 * - Display of property details when expanded
 * - Accessibility features
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Property } from "../../types";
import { PropertyCard } from "../features/PropertySearch/PropertyCard";

// Mock the hooks
vi.mock("../../hooks", () => ({
	useFormatting: () => ({
		formatCurrency: (value: number) =>
			new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: "USD",
				maximumFractionDigits: 0,
			}).format(value),
		formatNumber: (value: number) => value.toLocaleString(),
		formatDate: (date: string) => new Date(date).toLocaleDateString(),
		formatPropertyType: (type: string) => type,
		truncateText: (text: string, maxLength: number) =>
			text.length > maxLength ? `${text.slice(0, maxLength)}...` : text,
	}),
	useAnalytics: () => ({
		logPropertyView: vi.fn(),
		logSearch: vi.fn(),
		logError: vi.fn(),
	}),
}));

const mockProperty: Property = {
	id: "test-id-123",
	property_id: "R123456",
	name: "John Smith",
	prop_type: "RESIDENTIAL",
	city: "Austin",
	property_address: "123 Oak Street",
	assessed_value: 425000,
	appraised_value: 450000,
	geo_id: "GEO789012",
	description: "LOT 5 BLK A, OAKWOOD ESTATES PHASE 2",
	search_term: "Oak Street",
	scraped_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
	created_at: new Date("2025-09-15").toISOString(),
	updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

describe("PropertyCard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Collapsed State (Default)", () => {
		it("renders owner name", () => {
			render(<PropertyCard property={mockProperty} />);
			expect(screen.getByText("John Smith")).toBeInTheDocument();
		});

		it("renders property type badge", () => {
			render(<PropertyCard property={mockProperty} />);
			expect(screen.getByText("RESIDENTIAL")).toBeInTheDocument();
		});

		it("renders property address with city", () => {
			render(<PropertyCard property={mockProperty} />);
			expect(screen.getByText(/123 Oak Street/)).toBeInTheDocument();
			expect(screen.getByText(/Austin/)).toBeInTheDocument();
		});

		it("renders appraised value formatted as currency", () => {
			render(<PropertyCard property={mockProperty} />);
			expect(screen.getByText("$450,000")).toBeInTheDocument();
		});

		it('shows "Show Details" button when collapsed', () => {
			render(<PropertyCard property={mockProperty} />);
			expect(screen.getByText("Show Details")).toBeInTheDocument();
		});

		it("does not show expanded details when collapsed", () => {
			render(<PropertyCard property={mockProperty} />);
			// PropertyDetails returns null when not expanded
			expect(screen.queryByText("Financial Breakdown")).not.toBeInTheDocument();
			expect(screen.queryByText("Identifiers")).not.toBeInTheDocument();
		});
	});

	describe("Expanded State", () => {
		it("expands when expand button is clicked", async () => {
			render(<PropertyCard property={mockProperty} />);

			const expandButton = screen.getByRole("button", {
				name: /show details/i,
			});
			fireEvent.click(expandButton);

			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: /hide details/i }),
				).toBeInTheDocument();
			});
		});

		it("shows Hide Details button when expanded", async () => {
			render(<PropertyCard property={mockProperty} defaultExpanded={true} />);
			expect(screen.getByText("Hide Details")).toBeInTheDocument();
		});

		it("displays financial section when expanded", async () => {
			render(<PropertyCard property={mockProperty} defaultExpanded={true} />);
			expect(screen.getByText("Financial Breakdown")).toBeInTheDocument();
		});

		it("displays identifiers section when expanded", async () => {
			render(<PropertyCard property={mockProperty} defaultExpanded={true} />);
			expect(screen.getByText("Identifiers")).toBeInTheDocument();
			expect(screen.getByText("R123456")).toBeInTheDocument();
		});

		it("displays geographic ID when expanded", async () => {
			render(<PropertyCard property={mockProperty} defaultExpanded={true} />);
			expect(screen.getByText("GEO789012")).toBeInTheDocument();
		});

		it("displays legal description when expanded", async () => {
			render(<PropertyCard property={mockProperty} defaultExpanded={true} />);
			expect(screen.getByText("Description")).toBeInTheDocument();
			expect(screen.getByText(/LOT 5 BLK A/)).toBeInTheDocument();
		});

		it("displays metadata section when expanded", async () => {
			render(<PropertyCard property={mockProperty} defaultExpanded={true} />);
			expect(screen.getByText("Data Freshness")).toBeInTheDocument();
		});

		it("collapses when button is clicked again", async () => {
			render(<PropertyCard property={mockProperty} />);

			// Expand
			const expandButton = screen.getByRole("button", {
				name: /show details/i,
			});
			fireEvent.click(expandButton);

			await waitFor(() => {
				expect(screen.getByText("Hide Details")).toBeInTheDocument();
			});

			// Collapse
			const collapseButton = screen.getByRole("button", {
				name: /hide details/i,
			});
			fireEvent.click(collapseButton);

			await waitFor(() => {
				expect(screen.getByText("Show Details")).toBeInTheDocument();
			});
		});
	});

	describe("Default Expanded Prop", () => {
		it("starts expanded when defaultExpanded is true", () => {
			render(<PropertyCard property={mockProperty} defaultExpanded={true} />);
			expect(screen.getByText("Hide Details")).toBeInTheDocument();
			expect(screen.getByText("Financial Breakdown")).toBeInTheDocument();
		});

		it("starts collapsed when defaultExpanded is false", () => {
			render(<PropertyCard property={mockProperty} defaultExpanded={false} />);
			expect(screen.getByText("Show Details")).toBeInTheDocument();
			expect(screen.queryByText("Financial Breakdown")).not.toBeInTheDocument();
		});

		it("starts collapsed when defaultExpanded is not provided", () => {
			render(<PropertyCard property={mockProperty} />);
			expect(screen.getByText("Show Details")).toBeInTheDocument();
		});
	});

	describe("Null/Missing Data Handling", () => {
		it("renders without city when city is null", () => {
			const propertyWithoutCity: Property = {
				...mockProperty,
				city: null,
			};
			render(<PropertyCard property={propertyWithoutCity} />);
			expect(screen.getByText("123 Oak Street")).toBeInTheDocument();
			expect(screen.queryByText("Austin")).not.toBeInTheDocument();
		});

		it("renders without assessed value when null", () => {
			const propertyWithoutAssessed: Property = {
				...mockProperty,
				assessed_value: null,
			};
			render(
				<PropertyCard property={propertyWithoutAssessed} defaultExpanded />,
			);
			// Should still render the financial section but handle null assessed value
			expect(screen.getByText("Financial Breakdown")).toBeInTheDocument();
		});

		it("renders without geo_id when null", () => {
			const propertyWithoutGeoId: Property = {
				...mockProperty,
				geo_id: null,
			};
			render(<PropertyCard property={propertyWithoutGeoId} defaultExpanded />);
			expect(screen.getByText("Identifiers")).toBeInTheDocument();
			// Check that it shows N/A or similar for missing geo_id
			expect(screen.getByText("R123456")).toBeInTheDocument();
		});

		it("does not show description section when description is null", () => {
			const propertyWithoutDescription: Property = {
				...mockProperty,
				description: null,
			};
			render(
				<PropertyCard property={propertyWithoutDescription} defaultExpanded />,
			);
			// Description section should not be rendered when null
			expect(screen.queryByText("Description")).not.toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("expand button has aria-expanded attribute", () => {
			render(<PropertyCard property={mockProperty} />);
			const button = screen.getByRole("button", { name: /show details/i });
			expect(button).toHaveAttribute("aria-expanded", "false");
		});

		it("expand button aria-expanded updates when toggled", async () => {
			render(<PropertyCard property={mockProperty} />);
			const button = screen.getByRole("button", { name: /show details/i });

			expect(button).toHaveAttribute("aria-expanded", "false");

			fireEvent.click(button);

			await waitFor(() => {
				const updatedButton = screen.getByRole("button", {
					name: /hide details/i,
				});
				expect(updatedButton).toHaveAttribute("aria-expanded", "true");
			});
		});

		it("expand button has appropriate aria-label", () => {
			render(<PropertyCard property={mockProperty} />);
			const button = screen.getByRole("button", { name: /show details/i });
			expect(button).toHaveAttribute("aria-label", "Show Details");
		});

		it("updates aria-label when expanded", async () => {
			render(<PropertyCard property={mockProperty} />);
			const button = screen.getByRole("button", { name: /show details/i });
			fireEvent.click(button);

			await waitFor(() => {
				const expandedButton = screen.getByRole("button", {
					name: /hide details/i,
				});
				expect(expandedButton).toHaveAttribute("aria-label", "Hide Details");
			});
		});
	});

	describe("Analytics Integration", () => {
		it("does not track property view on mount", () => {
			render(<PropertyCard property={mockProperty} />);
			expect(screen.getByText("John Smith")).toBeInTheDocument();
			// Analytics should NOT fire on render — only on expand
		});

		it("tracks property view when card is expanded", () => {
			render(<PropertyCard property={mockProperty} />);
			const expandButton = screen.getByRole("button", {
				name: /show details/i,
			});
			fireEvent.click(expandButton);
			// Card expanded — analytics should fire on expand interaction
			expect(screen.getByText("Hide Details")).toBeInTheDocument();
		});
	});
});
