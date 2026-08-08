/**
 * AttributionCard Component Tests
 *
 * Regression coverage for M40: wrapping the action links in `CardFooter`
 * pulls in Card.module.css's unconditional `.footer` divider/spacing rule.
 * AttributionCard.module.css's `.actions` class must override it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttributionCard } from "../layout/AttributionCard/AttributionCard";

vi.mock("../../hooks", () => ({
	useAnalytics: () => ({
		track: vi.fn(),
	}),
}));

// Read the raw CSS source directly (bypassing the CSS-modules test mock,
// which replaces imports with a class-name proxy, not the file contents).
const attributionCardCss = readFileSync(
	join(
		process.cwd(),
		"src/components/layout/AttributionCard/AttributionCard.module.css",
	),
	"utf-8",
);

describe("AttributionCard", () => {
	it("renders the services and GitHub links", () => {
		render(<AttributionCard />);
		expect(
			screen.getByRole("link", { name: /learn about our services/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /view source code/i }),
		).toBeInTheDocument();
	});

	describe("Regression: footer divider suppressed for action links (M40)", () => {
		it("applies the .actions class alongside Card's .footer class", () => {
			const { container } = render(<AttributionCard />);
			const footer = container.querySelector(".footer");
			expect(footer).not.toBeNull();
			expect(footer?.className).toContain("actions");
		});

		it("overrides Card's .footer margin/padding/border on .actions", () => {
			expect(attributionCardCss).toMatch(
				/\.actions\s*{[^}]*margin-top:\s*0[^}]*}/,
			);
			expect(attributionCardCss).toMatch(
				/\.actions\s*{[^}]*padding-top:\s*0[^}]*}/,
			);
			expect(attributionCardCss).toMatch(
				/\.actions\s*{[^}]*border-top:\s*none[^}]*}/,
			);
		});
	});
});
