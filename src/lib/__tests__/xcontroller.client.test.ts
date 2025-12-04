/**
 * XController Client Tests
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	type Mock,
	test,
	vi,
} from "vitest";
import { DataController } from "../xcontroller.client";

describe("DataController", () => {
	let controller: DataController;
	let scriptElement: HTMLScriptElement;

	beforeEach(() => {
		controller = new DataController(true); // debug mode
		// Clean up any existing test elements
		document.querySelectorAll('[id^="test-"]').forEach((el) => el.remove());
	});

	afterEach(() => {
		// Clean up after each test
		document.querySelectorAll('[id^="test-"]').forEach((el) => el.remove());
	});

	describe("loadData", () => {
		test("should load data from valid JSON script tag", () => {
			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-data";
			scriptElement.textContent = JSON.stringify({
				test: "value",
				number: 123,
			});
			document.body.appendChild(scriptElement);

			const data = controller.loadData<{ test: string; number: number }>(
				"test-data",
			);

			expect(data).not.toBeNull();
			expect(data?.test).toBe("value");
			expect(data?.number).toBe(123);
		});

		test("should return null for non-existent script tag", () => {
			const data = controller.loadData("non-existent");
			expect(data).toBeNull();
		});

		test("should return null for wrong type attribute", () => {
			scriptElement = document.createElement("script");
			// Use a non-executable type to avoid JSDOM trying to run JSON as JavaScript
			scriptElement.type = "text/plain";
			scriptElement.id = "test-wrong-type";
			scriptElement.textContent = JSON.stringify({ test: "value" });
			document.body.appendChild(scriptElement);

			const data = controller.loadData("test-wrong-type");
			expect(data).toBeNull();
		});

		test("should return null for invalid JSON", () => {
			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-invalid";
			scriptElement.textContent = "not valid json {]";
			document.body.appendChild(scriptElement);

			const data = controller.loadData("test-invalid");
			expect(data).toBeNull();
		});

		test("should cache loaded data", () => {
			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-cache";
			scriptElement.textContent = JSON.stringify({ cached: true });
			document.body.appendChild(scriptElement);

			const data1 = controller.loadData("test-cache");
			const data2 = controller.loadData("test-cache");

			expect(data1).toBe(data2); // Same reference = cached
			expect(controller.getCacheSize()).toBe(1);
		});

		test("should handle empty script tag", () => {
			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-empty";
			scriptElement.textContent = "";
			document.body.appendChild(scriptElement);

			const data = controller.loadData("test-empty");
			expect(data).toBeNull();
		});

		test("should handle null values", () => {
			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-null";
			scriptElement.textContent = "null";
			document.body.appendChild(scriptElement);

			const data = controller.loadData("test-null");
			expect(data).toBeNull(); // null is not valid (fails validation)
		});

		test("should handle arrays", () => {
			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-array";
			scriptElement.textContent = JSON.stringify([1, 2, 3]);
			document.body.appendChild(scriptElement);

			const data = controller.loadData<number[]>("test-array");
			expect(Array.isArray(data)).toBe(true);
			expect(data).toEqual([1, 2, 3]);
		});

		test("should handle complex nested objects", () => {
			const complexData = {
				user: { id: 1, name: "John", roles: ["admin", "user"] },
				config: { theme: "dark", features: { analytics: true } },
			};

			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-complex";
			scriptElement.textContent = JSON.stringify(complexData);
			document.body.appendChild(scriptElement);

			const data = controller.loadData<typeof complexData>("test-complex");
			expect(data).toEqual(complexData);
		});

		test("should handle unicode and special characters", () => {
			const unicodeData = {
				text: "Hello 世界",
				emoji: "🚀",
				escaped: "Line 1\nLine 2",
			};

			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-unicode";
			scriptElement.textContent = JSON.stringify(unicodeData);
			document.body.appendChild(scriptElement);

			const data = controller.loadData<typeof unicodeData>("test-unicode");
			expect(data).toEqual(unicodeData);
		});
	});

	describe("loadDataWithFallback", () => {
		beforeEach(() => {
			// Mock fetch
			global.fetch = vi.fn();
		});

		test("should use script tag data first", async () => {
			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-fallback";
			scriptElement.textContent = JSON.stringify({ source: "script" });
			document.body.appendChild(scriptElement);

			const data = await controller.loadDataWithFallback<{ source: string }>(
				"test-fallback",
				"/api/fallback",
			);

			expect(data?.source).toBe("script");
			expect(global.fetch).not.toHaveBeenCalled();
		});

		test("should fallback to API when script tag missing", async () => {
			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => ({ source: "api" }),
			});

			const data = await controller.loadDataWithFallback<{ source: string }>(
				"non-existent",
				"/api/fallback",
			);

			expect(data?.source).toBe("api");
			expect(global.fetch).toHaveBeenCalledWith("/api/fallback");
		});

		test("should cache API fallback data", async () => {
			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => ({ cached: true }),
			});

			await controller.loadDataWithFallback("test-api-cache", "/api/data");
			await controller.loadDataWithFallback("test-api-cache", "/api/data");

			expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once
		});

		test("should return null on API error", async () => {
			(global.fetch as Mock).mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			});

			const data = await controller.loadDataWithFallback(
				"missing",
				"/api/error",
			);
			expect(data).toBeNull();
		});

		test("should return null on network error", async () => {
			(global.fetch as Mock).mockRejectedValue(new Error("Network error"));

			const data = await controller.loadDataWithFallback(
				"missing",
				"/api/network-error",
			);
			expect(data).toBeNull();
		});
	});

	describe("cache management", () => {
		test("should clear cache", () => {
			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-clear";
			scriptElement.textContent = JSON.stringify({ test: "value" });
			document.body.appendChild(scriptElement);

			controller.loadData("test-clear");
			expect(controller.getCacheSize()).toBe(1);

			controller.clearCache();
			expect(controller.getCacheSize()).toBe(0);
		});

		test("should report correct cache size", () => {
			const createScript = (id: string) => {
				const script = document.createElement("script");
				script.type = "application/json";
				script.id = id;
				script.textContent = JSON.stringify({ test: id });
				document.body.appendChild(script);
			};

			createScript("test-1");
			createScript("test-2");
			createScript("test-3");

			controller.loadData("test-1");
			expect(controller.getCacheSize()).toBe(1);

			controller.loadData("test-2");
			expect(controller.getCacheSize()).toBe(2);

			controller.loadData("test-3");
			expect(controller.getCacheSize()).toBe(3);
		});
	});

	describe("XSS Prevention", () => {
		test("should safely parse data with script tags", () => {
			const xssData = {
				payload: '<script>alert("xss")</script>',
			};

			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-xss";
			scriptElement.textContent = JSON.stringify(xssData);
			document.body.appendChild(scriptElement);

			const data = controller.loadData<typeof xssData>("test-xss");

			// Data should be parsed, but not executed
			expect(data?.payload).toBe('<script>alert("xss")</script>');

			// No actual script execution should occur
			const scripts = document.querySelectorAll('script[src*="alert"]');
			expect(scripts.length).toBe(0);
		});

		test("should handle encoded dangerous characters", () => {
			// Data as it would come from server with proper encoding
			const encodedData =
				'{"html":"\\u003Cscript\\u003Ealert(\\"xss\\")\\u003C/script\\u003E"}';

			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-encoded";
			scriptElement.textContent = encodedData;
			document.body.appendChild(scriptElement);

			const data = controller.loadData<{ html: string }>("test-encoded");

			// Should decode properly
			expect(data?.html).toBe('<script>alert("xss")</script>');
		});
	});

	describe("Type Safety", () => {
		test("should preserve type information", () => {
			interface AppConfig {
				apiUrl: string;
				features: {
					analytics: boolean;
					search: boolean;
				};
				version: string;
			}

			const config: AppConfig = {
				apiUrl: "/api",
				features: { analytics: true, search: true },
				version: "1.0.0",
			};

			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-typed";
			scriptElement.textContent = JSON.stringify(config);
			document.body.appendChild(scriptElement);

			const data = controller.loadData<AppConfig>("test-typed");

			expect(data).toBeTruthy();
			expect(data?.apiUrl).toBe("/api");
			expect(data?.features.analytics).toBe(true);
			expect(typeof data?.version).toBe("string");
		});
	});

	describe("Error Handling", () => {
		test("should log errors in debug mode", () => {
			const consoleError = vi.spyOn(console, "error").mockImplementation();

			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-error";
			scriptElement.textContent = "invalid json";
			document.body.appendChild(scriptElement);

			controller.loadData("test-error");

			expect(consoleError).toHaveBeenCalled();
			consoleError.mockRestore();
		});

		test("should handle missing textContent", () => {
			scriptElement = document.createElement("script");
			scriptElement.type = "application/json";
			scriptElement.id = "test-no-content";
			// No textContent set
			document.body.appendChild(scriptElement);

			const data = controller.loadData("test-no-content");
			expect(data).toBeNull();
		});
	});
});
