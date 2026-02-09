import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock config before importing
vi.mock("../../config", () => ({
	config: {
		scraper: {
			humanDelay: { min: 500, max: 1500 },
		},
	},
}));

import { humanDelay } from "../timing";

describe("humanDelay", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should resolve after a delay within default range", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.5);

		const promise = humanDelay();
		// With random=0.5, delay = floor(0.5 * (1500-500) + 500) = 1000
		vi.advanceTimersByTime(1000);
		await promise;
	});

	it("should resolve after a delay within custom range", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);

		const promise = humanDelay(100, 200);
		// With random=0, delay = floor(0 * (200-100) + 100) = 100
		vi.advanceTimersByTime(100);
		await promise;
	});

	it("should use max-1 when random returns ~1", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.999);

		const promise = humanDelay(100, 200);
		// delay = floor(0.999 * 100 + 100) = floor(199.9) = 199
		vi.advanceTimersByTime(199);
		await promise;
	});

	it("should use min when random returns 0", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0);

		const promise = humanDelay(300, 600);
		// delay = floor(0 * 300 + 300) = 300
		vi.advanceTimersByTime(300);
		await promise;
	});
});
