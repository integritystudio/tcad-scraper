/**
 * SearchResults Component Tests
 *
 * Regression coverage for M42: the pagination footer must report the
 * true match count (totalResults prop), not the size of the fetched
 * batch (results.length), so a capped fetch doesn't imply completeness.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Property } from "../../types";
import { SearchResults } from "../features/PropertySearch/SearchResults";

const buildProperty = (index: number): Property => ({
	id: `test-id-${index}`,
	property_id: `R${index}`,
	name: `Owner ${index}`,
	prop_type: "RESIDENTIAL",
	city: "Austin",
	property_address: `${index} Oak Street`,
	assessed_value: 100000,
	appraised_value: 100000,
	geo_id: `GEO${index}`,
	description: null,
	search_term: "Smith",
	scraped_at: new Date().toISOString(),
	created_at: new Date().toISOString(),
	updated_at: new Date().toISOString(),
});

describe("SearchResults", () => {
	it("shows totalResults (not results.length) in the pagination footer", () => {
		const fetchedBatch = Array.from({ length: 50 }, (_, i) => buildProperty(i));

		render(
			<SearchResults
				results={fetchedBatch}
				totalResults={3000}
				searchQuery="Smith"
			/>,
		);

		expect(screen.getByText(/of 3000 results/)).toBeInTheDocument();
		expect(screen.queryByText(/of 50 results/)).not.toBeInTheDocument();
	});

	it("still derives the X-Y range from the paginated slice, not totalResults", () => {
		const fetchedBatch = Array.from({ length: 50 }, (_, i) => buildProperty(i));

		render(
			<SearchResults
				results={fetchedBatch}
				totalResults={3000}
				searchQuery="Smith"
			/>,
		);

		// RESULTS_PER_PAGE is 12, so page 1 shows items 1-12.
		expect(
			screen.getByText(/Showing 1-12 of 3000 results/),
		).toBeInTheDocument();
	});
});
