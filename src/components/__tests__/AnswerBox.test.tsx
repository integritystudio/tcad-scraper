/**
 * AnswerBox Component Tests
 *
 * Regression coverage for C9: the loading skeletons sized themselves with
 * inline style props, against the project rule against in-line styling for
 * UI components. Their dimensions are static, so they belong entirely in
 * AnswerBox.module.css.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnswerBox } from "../features/PropertySearch/AnswerBox";

describe("AnswerBox", () => {
	describe("loading skeletons carry no inline styles (C9 regression)", () => {
		it("sizes both placeholder lines from the stylesheet alone", () => {
			render(
				<AnswerBox
					answer=""
					totalResults={0}
					searchQuery="oak street"
					state="loading"
				/>,
			);

			const skeletons = screen
				.getByRole("status")
				.querySelectorAll("[class*='skeleton']");

			expect(skeletons).toHaveLength(2);
			for (const skeleton of skeletons) {
				expect(skeleton.getAttribute("style")).toBeNull();
			}
		});
	});
});
