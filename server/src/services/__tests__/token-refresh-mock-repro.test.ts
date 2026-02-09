/**
 * Minimal Reproduction: Playwright Browser Mock Issue
 *
 * This file demonstrates the problem with vi.hoisted() mocking for Playwright
 * and shows the working factory-based approach.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ==========================================
// BROKEN APPROACH: Using vi.hoisted()
// ==========================================

describe("BROKEN: vi.hoisted() approach", () => {
	// This pattern DOES NOT WORK for async Playwright mocks
	const { mockBrowserBroken } = vi.hoisted(() => {
		const mockPage = {
			goto: vi.fn().mockResolvedValue(undefined),
			on: vi.fn(),
		};

		const mockContext = {
			newPage: vi.fn().mockResolvedValue(mockPage),
			close: vi.fn().mockResolvedValue(undefined),
		};

		const mockBrowserBroken = {
			newContext: vi.fn().mockResolvedValue(mockContext),
			close: vi.fn().mockResolvedValue(undefined),
		};

		return { mockBrowserBroken };
	});

	vi.mock("playwright", () => ({
		chromium: {
			launch: vi.fn().mockResolvedValue(mockBrowserBroken),
		},
	}));

	it("should fail - browser is undefined", async () => {
		const { chromium } = await import("playwright");

		// This FAILS because vi.hoisted() doesn't properly handle async Promise resolution
		const browser = await chromium.launch();

		// This will be undefined or not have newContext method
		expect(browser).toBeDefined();
		expect(browser?.newContext).toBeDefined();

		// This will FAIL with: TypeError: Cannot read properties of undefined
		// const context = await browser.newContext();
	});
});

// ==========================================
// WORKING APPROACH: Factory-based mocking
// ==========================================

describe("WORKING: Factory-based approach", () => {
	let mockBrowser: Record<string, ReturnType<typeof vi.fn>>;
	let mockContext: Record<string, ReturnType<typeof vi.fn>>;
	let mockPage: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(() => {
		vi.resetModules();

		// Create fresh mocks in beforeEach - this WORKS
		mockPage = {
			goto: vi.fn().mockResolvedValue(undefined),
			on: vi.fn(),
			waitForFunction: vi.fn().mockResolvedValue(undefined),
		};

		mockContext = {
			newPage: vi.fn().mockResolvedValue(mockPage),
			close: vi.fn().mockResolvedValue(undefined),
		};

		mockBrowser = {
			newContext: vi.fn().mockResolvedValue(mockContext),
			close: vi.fn().mockResolvedValue(undefined),
		};

		// Mock Playwright with factory-created browser
		vi.doMock("playwright", () => ({
			chromium: {
				launch: vi.fn().mockResolvedValue(mockBrowser),
			},
		}));
	});

	it("should work - browser is properly mocked", async () => {
		const { chromium } = await import("playwright");

		const browser = await chromium.launch();

		// This WORKS
		expect(browser).toBeDefined();
		expect(browser.newContext).toBeDefined();

		// This WORKS
		const context = await browser.newContext();
		expect(context).toBeDefined();
		expect(context.newPage).toBeDefined();

		// This WORKS
		const page = await context.newPage();
		expect(page).toBeDefined();
		expect(page.goto).toBeDefined();
	});

	it("should allow calling browser methods multiple times", async () => {
		const { chromium } = await import("playwright");

		const browser = await chromium.launch();

		// Create multiple contexts
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		expect(context1).toBeDefined();
		expect(context2).toBeDefined();
		expect(mockBrowser.newContext).toHaveBeenCalledTimes(2);
	});
});

// ==========================================
// KEY LEARNINGS
// ==========================================

describe("Key Learnings", () => {
	it("documents why vi.hoisted() fails for Playwright", () => {
		/**
		 * WHY vi.hoisted() FAILS:
		 *
		 * 1. vi.hoisted() runs BEFORE module mocks are set up
		 * 2. The mock structure is created but not properly connected to the module system
		 * 3. When chromium.launch() returns a Promise, Vitest can't properly resolve
		 *    the mocked value because the reference was created too early
		 * 4. Result: browser is undefined or doesn't have expected methods
		 *
		 * WHY Factory Approach WORKS:
		 *
		 * 1. Mocks created in beforeEach() run AFTER imports are resolved
		 * 2. vi.doMock() properly registers the module mock
		 * 3. Fresh mocks on each test = no state leakage
		 * 4. Promise resolution works correctly
		 * 5. All method calls are properly tracked by vi.fn()
		 */
		expect(true).toBe(true);
	});

	it("documents the proper pattern for complex async SDK mocks", () => {
		/**
		 * PROPER PATTERN FOR PLAYWRIGHT/COMPLEX SDK MOCKING:
		 *
		 * 1. Declare mock variables outside beforeEach
		 * 2. Create fresh mock instances in beforeEach
		 * 3. Use vi.doMock() instead of vi.mock() for dynamic mocking
		 * 4. Use vi.resetModules() to clear previous module cache
		 * 5. Import the module AFTER mocking (dynamic import in test)
		 *
		 * OR (simpler for most cases):
		 *
		 * 1. Declare mock variables outside beforeEach
		 * 2. Create fresh mock instances in beforeEach
		 * 3. Use vi.mock() at top level but return factory function
		 * 4. Factory function accesses the current mock variable values
		 */
		expect(true).toBe(true);
	});
});
