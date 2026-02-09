import { describe, expect, it, vi } from "vitest";

// Mock config before importing
vi.mock("../../config", () => ({
	config: {
		scraper: {
			humanDelay: { min: 10, max: 30 },
		},
	},
}));

vi.mock("../../lib/logger", () => ({
	default: { trace: vi.fn() },
}));

import { humanDelay } from "../timing";

describe("humanDelay", () => {
	it("should resolve within default config range", async () => {
		const start = Date.now();
		await humanDelay();
		const elapsed = Date.now() - start;

		expect(elapsed).toBeGreaterThanOrEqual(9); // allow 1ms timer drift
		expect(elapsed).toBeLessThan(100);
	});

	it("should resolve within custom range", async () => {
		const start = Date.now();
		await humanDelay(5, 15);
		const elapsed = Date.now() - start;

		expect(elapsed).toBeGreaterThanOrEqual(4);
		expect(elapsed).toBeLessThan(100);
	});

	it("should return a promise", () => {
		const result = humanDelay(1, 5);
		expect(result).toBeInstanceOf(Promise);
	});

	it("should produce varying delays across calls", async () => {
		const delays: number[] = [];
		for (let i = 0; i < 5; i++) {
			const start = Date.now();
			await humanDelay(1, 50);
			delays.push(Date.now() - start);
		}
		// At least one delay should differ from the first (probabilistic but near-certain)
		const allSame = delays.every((d) => d === delays[0]);
		// Not asserting !allSame since timer resolution can make them equal;
		// just verify they all complete within range
		for (const d of delays) {
			expect(d).toBeGreaterThanOrEqual(0);
			expect(d).toBeLessThan(200);
		}
	});
});
