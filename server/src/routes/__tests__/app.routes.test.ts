/**
 * App Routes Tests
 */

import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, test } from "vitest";
import { nonceMiddleware } from "../../middleware/xcontroller.middleware";
import { appRouter } from "../app.routes";

describe("App Routes", () => {
	let app: express.Application;

	beforeAll(() => {
		app = express();
		app.use(nonceMiddleware);
		app.use("/", appRouter);
	});

	describe("GET /", () => {
		test("should return HTML with status 200", async () => {
			const response = await request(app).get("/");
			expect(response.status).toBe(200);
			expect(response.headers["content-type"]).toContain("text/html");
		});

		test("should include doctype", async () => {
			const response = await request(app).get("/");
			expect(response.text).toContain("<!DOCTYPE html>");
		});

		test("should include root div", async () => {
			const response = await request(app).get("/");
			expect(response.text).toContain('<div id="root"></div>');
		});

		test("should include initial data script", async () => {
			const response = await request(app).get("/");
			expect(response.text).toContain('type="application/json"');
			expect(response.text).toContain('id="initial-data"');
		});

		test("should include nonce in script tags", async () => {
			const response = await request(app).get("/");
			expect(response.text).toMatch(/nonce="[^"]+"/);
		});

		test("should include app script reference", async () => {
			const response = await request(app).get("/");
			expect(response.text).toContain("/src/main.tsx");
		});

		test("should have proper charset", async () => {
			const response = await request(app).get("/");
			expect(response.headers["content-type"]).toContain("charset=utf-8");
		});
	});

	describe("CSP Headers", () => {
		test("should set Content-Security-Policy header", async () => {
			const response = await request(app).get("/");
			expect(response.headers["content-security-policy"]).toBeDefined();
		});

		test("should include script-src directive", async () => {
			const response = await request(app).get("/");
			const csp = response.headers["content-security-policy"];
			expect(csp).toContain("script-src");
		});

		test("should include nonce in CSP", async () => {
			const response = await request(app).get("/");
			const csp = response.headers["content-security-policy"];
			expect(csp).toMatch(/'nonce-[^']+'/);
		});

		test("should match nonce in CSP and HTML", async () => {
			const response = await request(app).get("/");

			// Extract nonce from HTML
			const htmlNonceMatch = response.text.match(/nonce="([^"]+)"/);
			expect(htmlNonceMatch).toBeTruthy();
			const htmlNonce = htmlNonceMatch?.[1];

			// Extract nonce from CSP
			const csp = response.headers["content-security-policy"];
			expect(csp).toContain(`'nonce-${htmlNonce}'`);
		});
	});

	describe("Security Headers", () => {
		test("should set X-Content-Type-Options", async () => {
			const response = await request(app).get("/");
			expect(response.headers["x-content-type-options"]).toBe("nosniff");
		});

		test("should set X-Frame-Options", async () => {
			const response = await request(app).get("/");
			expect(response.headers["x-frame-options"]).toBe("DENY");
		});

		test("should set X-XSS-Protection", async () => {
			const response = await request(app).get("/");
			expect(response.headers["x-xss-protection"]).toBe("1; mode=block");
		});

		test("should set Referrer-Policy", async () => {
			const response = await request(app).get("/");
			expect(response.headers["referrer-policy"]).toBe(
				"strict-origin-when-cross-origin",
			);
		});
	});

	describe("Initial Data", () => {
		test("should include version in initial data", async () => {
			const response = await request(app).get("/");
			const dataMatch = response.text.match(
				/<script type="application\/json" id="initial-data"[^>]*>\s*({[\s\S]*?})\s*<\/script>/,
			);
			expect(dataMatch).toBeTruthy();

			const data = JSON.parse(dataMatch?.[1]);
			expect(data).toHaveProperty("version");
		});

		test("should include environment in initial data", async () => {
			const response = await request(app).get("/");
			const dataMatch = response.text.match(
				/<script type="application\/json" id="initial-data"[^>]*>\s*({[\s\S]*?})\s*<\/script>/,
			);

			const data = JSON.parse(dataMatch?.[1]);
			expect(data).toHaveProperty("environment");
		});

		test("should include features in initial data", async () => {
			const response = await request(app).get("/");
			const dataMatch = response.text.match(
				/<script type="application\/json" id="initial-data"[^>]*>\s*({[\s\S]*?})\s*<\/script>/,
			);

			const data = JSON.parse(dataMatch?.[1]);
			expect(data).toHaveProperty("features");
			expect(data.features).toHaveProperty("search");
			expect(data.features).toHaveProperty("analytics");
		});

		test("should properly encode dangerous characters in data", async () => {
			const response = await request(app).get("/");
			const text = response.text;

			// If data contains <, >, & they should be encoded
			const dataSection = text.match(
				/<script type="application\/json" id="initial-data"[^>]*>([\s\S]*?)<\/script>/,
			);

			if (dataSection?.[1].includes('"')) {
				// Check that any < > & in the data are encoded
				expect(dataSection[1]).not.toMatch(/<(?!\/script>)/);
				expect(dataSection[1]).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#)/);
			}
		});
	});

	describe("GET /health", () => {
		test("should return health status", async () => {
			const response = await request(app).get("/health");
			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("status", "healthy");
			expect(response.body).toHaveProperty("timestamp");
		});
	});

	describe("XSS Prevention", () => {
		test("should not allow script injection in title", async () => {
			const response = await request(app).get("/");
			expect(response.text).not.toContain("<script>alert");
		});

		test("should encode special characters in data", async () => {
			const response = await request(app).get("/");
			const dataSection = response.text.match(
				/<script type="application\/json" id="initial-data"[^>]*>([\s\S]*?)<\/script>/,
			);

			if (dataSection) {
				const dataJson = dataSection[1];
				// If there are any encoded characters, they should use unicode escapes
				if (dataJson.includes("\\u003C")) {
					expect(dataJson).not.toContain("<script");
				}
			}
		});
	});
});
