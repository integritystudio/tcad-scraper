/**
 * API Configuration Tests
 * Tests the API URL resolution fallback chain to prevent production errors
 *
 * These tests verify the actual behavior of getApiBaseUrl() without complex mocking.
 * The function has three fallback levels:
 * 1. VITE_API_URL environment variable (build-time, for static deployments)
 * 2. Server-passed config via xcontroller script tag
 * 3. Local development fallback (/api)
 */

import { describe, expect, test } from "vitest";

describe("API Configuration", () => {
	describe("getApiBaseUrl behavior", () => {
		test("should return a string URL", async () => {
			// Fresh import to get current behavior
			const { getApiBaseUrl } = await import("../api-config");
			const result = getApiBaseUrl();

			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
		});

		test("should return either environment URL, xcontroller URL, or /api fallback", async () => {
			const { getApiBaseUrl } = await import("../api-config");
			const result = getApiBaseUrl();

			// Should be one of: VITE_API_URL, xcontroller apiUrl, or '/api'
			const isValidUrl =
				result.startsWith("http://") ||
				result.startsWith("https://") ||
				result === "/api";

			expect(isValidUrl).toBe(true);
		});

		test("should return consistent results on multiple calls", async () => {
			const { getApiBaseUrl } = await import("../api-config");

			const result1 = getApiBaseUrl();
			const result2 = getApiBaseUrl();
			const result3 = getApiBaseUrl();

			expect(result1).toBe(result2);
			expect(result2).toBe(result3);
		});
	});

	describe("URL format validation", () => {
		test("should not return empty string", async () => {
			const { getApiBaseUrl } = await import("../api-config");
			const result = getApiBaseUrl();

			expect(result).not.toBe("");
		});

		test("should not return undefined or null", async () => {
			const { getApiBaseUrl } = await import("../api-config");
			const result = getApiBaseUrl();

			expect(result).toBeDefined();
			expect(result).not.toBeNull();
		});

		test("should return URL without trailing slash", async () => {
			const { getApiBaseUrl } = await import("../api-config");
			const result = getApiBaseUrl();

			// API base URLs should not have trailing slash
			// (unless it's just '/api' which doesn't have one)
			if (result !== "/api") {
				expect(result.endsWith("/")).toBe(false);
			}
		});
	});

	describe("Current environment behavior", () => {
		test("in test environment should return /api (no VITE_API_URL, no xcontroller)", async () => {
			// In test environment:
			// - VITE_API_URL is not set (unless explicitly configured)
			// - No server-rendered xcontroller script tag exists
			// - So it should fall back to '/api'
			const { getApiBaseUrl } = await import("../api-config");
			const result = getApiBaseUrl();

			// In test/dev environment without config, should return /api
			// This is the expected fallback behavior
			expect(result).toBe("/api");
		});
	});

	describe("Error handling", () => {
		test("should not throw on invocation", async () => {
			const { getApiBaseUrl } = await import("../api-config");

			expect(() => getApiBaseUrl()).not.toThrow();
		});

		test("should handle missing xcontroller gracefully", async () => {
			// In test environment, there's no xcontroller script tag
			// The function should handle this gracefully and return fallback
			const { getApiBaseUrl } = await import("../api-config");
			const result = getApiBaseUrl();

			expect(result).toBeDefined();
			expect(typeof result).toBe("string");
		});
	});
});
