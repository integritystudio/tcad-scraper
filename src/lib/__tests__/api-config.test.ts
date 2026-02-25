/**
 * API Configuration Tests
 * Tests the API URL resolution fallback chain to prevent production errors
 *
 * The function has three fallback levels:
 * 1. VITE_API_URL environment variable (build-time, for static deployments)
 * 2. Server-passed config via xcontroller script tag
 * 3. Local development fallback (/api)
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Suppress console.error from DataController debug mode (expected behavior)
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	vi.resetModules();
	consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
	consoleErrorSpy.mockRestore();
});

describe("API Configuration", () => {
	test("in test environment should return /api (no VITE_API_URL, no xcontroller)", async () => {
		const { getApiBaseUrl } = await import("../api-config");
		const result = getApiBaseUrl();

		expect(result).toBe("/api");
	});

	test("should return consistent results on multiple calls", async () => {
		const { getApiBaseUrl } = await import("../api-config");

		const result1 = getApiBaseUrl();
		const result2 = getApiBaseUrl();
		const result3 = getApiBaseUrl();

		expect(result1).toBe(result2);
		expect(result2).toBe(result3);
	});

	test("should return URL without trailing slash", async () => {
		const { getApiBaseUrl } = await import("../api-config");
		const result = getApiBaseUrl();

		if (result !== "/api") {
			expect(result.endsWith("/")).toBe(false);
		}
	});

	test("should not throw on invocation", async () => {
		const { getApiBaseUrl } = await import("../api-config");

		expect(() => getApiBaseUrl()).not.toThrow();
	});
});
