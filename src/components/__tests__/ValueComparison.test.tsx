/**
 * ValueComparison Component Tests
 *
 * Regression coverage for M41: assessedValue === 0 must be treated as a
 * valid value (not "missing"), so the chart section — including the
 * assessedPercentage bar — still renders.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValueComparison } from "../features/PropertySearch/PropertyDetails/components/ValueComparison";

describe("ValueComparison", () => {
	describe("assessedValue === 0 (M41 regression)", () => {
		it("renders the chart section, including the assessedPercentage bar, when assessedValue is 0", () => {
			render(
				<ValueComparison
					appraisedValue={100000}
					assessedValue={0}
					showChart={true}
				/>,
			);

			// Difference row should render (0 - 100000 = -100000), not be
			// suppressed by the falsy-zero guard.
			expect(screen.getByText("Difference")).toBeInTheDocument();

			// The assessedPercentage chart bar (0 / 100000 * 100 = "0.0%")
			// should render since assessedPercentage !== null.
			expect(screen.getByText("Assessed")).toBeInTheDocument();
			expect(screen.getByText("0.0%")).toBeInTheDocument();
		});
	});

	describe("assessedValue === null", () => {
		it("shows the not-available state and no chart", () => {
			render(
				<ValueComparison
					appraisedValue={100000}
					assessedValue={null}
					showChart={true}
				/>,
			);

			expect(screen.getByText("Not available")).toBeInTheDocument();
			expect(screen.queryByText("Difference")).not.toBeInTheDocument();
		});
	});
});
