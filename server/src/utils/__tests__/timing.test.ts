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
	default: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

	it("should compute delay using Math.random formula", async () => {
		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
		// min=10, max=30 → delay = Math.floor(0.5 * (30-10) + 10) = 20ms
		const start = Date.now();
		await humanDelay();
		const elapsed = Date.now() - start;

		expect(elapsed).toBeGreaterThanOrEqual(19); // allow 1ms drift
		expect(elapsed).toBeLessThan(50);
		randomSpy.mockRestore();
	});

	it("should produce delays within range across multiple calls", async () => {
		const delays: number[] = [];
		for (let i = 0; i < 5; i++) {
			const start = Date.now();
			await humanDelay(1, 50);
			delays.push(Date.now() - start);
		}
		for (const d of delays) {
			expect(d).toBeGreaterThanOrEqual(0);
			expect(d).toBeLessThan(200);
		}
	});
});
