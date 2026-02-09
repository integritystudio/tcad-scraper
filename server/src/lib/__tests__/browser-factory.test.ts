import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Playwright
vi.mock("playwright", () => ({
	chromium: {
		launch: vi.fn().mockResolvedValue({ close: vi.fn() }),
	},
}));

// Mock logger
vi.mock("../logger", () => ({
	default: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}));

// Mock config
vi.mock("../../config", () => ({
	config: {
		scraper: {
			headless: true,
		},
	},
}));

import { chromium } from "playwright";
import { launchTCADBrowser } from "../browser-factory";

describe("launchTCADBrowser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
	});

	it("should launch browser with standard args", async () => {
		await launchTCADBrowser();

		expect(chromium.launch).toHaveBeenCalledWith(
			expect.objectContaining({
				headless: true,
				args: expect.arrayContaining([
					"--disable-blink-features=AutomationControlled",
					"--no-sandbox",
				]),
			}),
		);
	});

	it("should return the browser instance", async () => {
		const mockBrowser = { close: vi.fn() };
		vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as never);

		const browser = await launchTCADBrowser();
		expect(browser).toBe(mockBrowser);
	});

	it("should use custom executable path from env", async () => {
		process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "/usr/bin/chromium";

		await launchTCADBrowser();

		expect(chromium.launch).toHaveBeenCalledWith(
			expect.objectContaining({
				executablePath: "/usr/bin/chromium",
			}),
		);
	});

	it("should set executablePath to undefined when env not set", async () => {
		await launchTCADBrowser();

		expect(chromium.launch).toHaveBeenCalledWith(
			expect.objectContaining({
				executablePath: undefined,
			}),
		);
	});

	it("should configure proxy when provided", async () => {
		await launchTCADBrowser({
			proxy: {
				server: "http://proxy.example.com:8080",
				username: "user",
				password: "pass",
			},
		});

		expect(chromium.launch).toHaveBeenCalledWith(
			expect.objectContaining({
				proxy: {
					server: "http://proxy.example.com:8080",
					username: "user",
					password: "pass",
				},
			}),
		);
	});

	it("should not set proxy when options omitted", async () => {
		await launchTCADBrowser();

		const callArgs = vi.mocked(chromium.launch).mock.calls[0][0];
		expect(callArgs).not.toHaveProperty("proxy");
	});

	it("should propagate launch errors", async () => {
		vi.mocked(chromium.launch).mockRejectedValue(new Error("Launch failed"));

		await expect(launchTCADBrowser()).rejects.toThrow("Launch failed");
	});
});
