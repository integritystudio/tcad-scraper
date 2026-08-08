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

const cardCss = readFileSync(
	join(process.cwd(), "src/components/ui/Card/Card.module.css"),
	"utf-8",
);

/**
 * Class selectors declared outside any `@layer` block in `css`.
 * Strips each `@layer … { … }` by counting braces, so a rule placed *after*
 * a layer block is still reported (a greedy regex would swallow it).
 */
const unlayeredSelectors = (css: string): string[] => {
	let out = "";
	for (let i = 0; i < css.length; ) {
		const start = css.indexOf("@layer", i);
		if (start === -1) {
			out += css.slice(i);
			break;
		}
		out += css.slice(i, start);
		const open = css.indexOf("{", start);
		if (open === -1) break; // `@layer a, b;` statement — no block to skip
		let depth = 0;
		let j = open;
		for (; j < css.length; j++) {
			if (css[j] === "{") depth++;
			else if (css[j] === "}" && --depth === 0) break;
		}
		i = j + 1;
	}
	return [...out.matchAll(/^\s*\.([\w-]+)/gm)].map((m) => m[1]);
};

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

	describe("Regression: consumer overrides beat Card defaults (M43)", () => {
		it("declares every Card.module.css rule inside a cascade layer", () => {
			expect(cardCss).toMatch(/@layer\s+card\s*{/);
			// Anything left unlayered would compete with a consumer's className
			// at equal specificity, making the winner depend on emission order.
			expect(unlayeredSelectors(cardCss)).toEqual([]);
		});

		it("leaves AttributionCard's .card unlayered so it wins the cascade", () => {
			expect(attributionCardCss).not.toMatch(/@layer/);
			expect(unlayeredSelectors(attributionCardCss)).toContain("card");
		});

		it("sets the surface properties that Card's .card also declares", () => {
			// These are the properties that previously resolved by luck.
			expect(attributionCardCss).toMatch(/\.card\s*{[^}]*background:[^}]*}/);
			expect(attributionCardCss).toMatch(/\.card\s*{[^}]*border-radius:[^}]*}/);
		});
	});
});
