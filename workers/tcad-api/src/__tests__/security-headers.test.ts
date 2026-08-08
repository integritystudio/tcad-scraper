/**
 * Security header and CORS contract for the Workers API.
 *
 * Every response — success, 404, and handled-error alike — must carry the
 * hono/secure-headers set. Expected values mirror what production serves
 * (verified against https://api.alephatx.info/health, 2026-08-06); changing
 * secureHeaders() config in src/index.ts should turn these red.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";

const mockCount = vi.fn();

vi.mock("../db", () => ({
	createPrisma: () => ({
		property: { count: () => mockCount() },
	}),
}));

// D1 binding is consumed only by the mocked createPrisma
const TEST_ENV = { DB: {} };

const ALLOWED_ORIGIN = "https://alephatx.info";
const DISALLOWED_ORIGIN = "https://evil.example.com";

const EXPECTED_SECURITY_HEADERS: Record<string, string> = {
	"x-content-type-options": "nosniff",
	"x-frame-options": "SAMEORIGIN",
	"strict-transport-security": "max-age=15552000; includeSubDomains",
	"referrer-policy": "no-referrer",
	"x-xss-protection": "0",
	"cross-origin-opener-policy": "same-origin",
	"cross-origin-resource-policy": "same-origin",
	"origin-agent-cluster": "?1",
	"x-dns-prefetch-control": "off",
	"x-download-options": "noopen",
	"x-permitted-cross-domain-policies": "none",
};

beforeEach(() => {
	vi.clearAllMocks();
	mockCount.mockResolvedValue(42);
});

describe("security headers", () => {
	it.each(
		Object.entries(EXPECTED_SECURITY_HEADERS),
	)("sets %s on a successful response", async (header, value) => {
		const res = await app.request("/health", {}, TEST_ENV);

		expect(res.status).toBe(200);
		expect(res.headers.get(header)).toBe(value);
	});

	it("sets security headers on 404 responses", async () => {
		const res = await app.request("/nonexistent", {}, TEST_ENV);

		expect(res.status).toBe(404);
		for (const [header, value] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
			expect(res.headers.get(header)).toBe(value);
		}
	});

	it("sets security headers on handled-error responses", async () => {
		mockCount.mockRejectedValue(new Error("D1 unavailable"));

		const res = await app.request("/health", {}, TEST_ENV);

		expect(res.status).toBe(503);
		for (const [header, value] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
			expect(res.headers.get(header)).toBe(value);
		}
	});
});

describe("CORS", () => {
	it("echoes an allowed origin with credentials", async () => {
		const res = await app.request(
			"/health",
			{ headers: { Origin: ALLOWED_ORIGIN } },
			TEST_ENV,
		);

		expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
		expect(res.headers.get("access-control-allow-credentials")).toBe("true");
	});

	it("does not allow a disallowed origin", async () => {
		const res = await app.request(
			"/health",
			{ headers: { Origin: DISALLOWED_ORIGIN } },
			TEST_ENV,
		);

		expect(res.headers.get("access-control-allow-origin")).not.toBe(
			DISALLOWED_ORIGIN,
		);
	});

	it("allows requests without an Origin header (curl, mobile)", async () => {
		const res = await app.request("/health", {}, TEST_ENV);

		expect(res.headers.get("access-control-allow-origin")).toBe("*");
	});
});
