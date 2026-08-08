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

// The bar element itself carries no accessible name — reach it via the
// percentage label's chart row, which is the only stable anchor.
const barFillOf = (percentLabel: string): HTMLElement => {
	const chartBar = screen.getByText(percentLabel).parentElement as HTMLElement;
	return chartBar.querySelector("[class*='barFill']") as HTMLElement;
};

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

	// C8: widths belong in ValueComparison.module.css. The only thing crossing
	// through the style attribute is the percentage datum, as a custom property.
	describe("bar widths are not inline styles (C8 regression)", () => {
		it("drives the assessed bar from a custom property, not an inline width", () => {
			render(
				<ValueComparison
					appraisedValue={100000}
					assessedValue={75000}
					showChart={true}
				/>,
			);

			const assessedBar = barFillOf("75.0%");
			expect(assessedBar.style.getPropertyValue("--bar-fill-percent")).toBe(
				"75.0%",
			);
			expect(assessedBar.style.width).toBe("");
		});

		it("gives the appraised reference bar no inline style at all", () => {
			render(
				<ValueComparison
					appraisedValue={100000}
					assessedValue={75000}
					showChart={true}
				/>,
			);

			expect(barFillOf("100%").getAttribute("style")).toBeNull();
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
