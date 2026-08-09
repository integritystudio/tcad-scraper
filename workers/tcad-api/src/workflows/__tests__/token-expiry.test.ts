/**
 * Token-expiry detection for the workflow's page loop.
 *
 * A TCAD token lives 5 minutes. A wide term outruns that mid-pagination
 * ("llc." needs 54 pages and failed outright, saving nothing, 2026-08-08), so
 * the run loop must recognise the 401 marker, mint a fresh token, and re-run
 * the page. Detection is by message, not `instanceof`: the error crosses the
 * Workflows step boundary, where it is serialised and rethrown, so the
 * prototype is lost. These tests pin that, because an `instanceof` check would
 * pass in unit tests and silently fail in production.
 */

import { describe, expect, it } from "vitest";
import { isTokenExpiredError, TOKEN_EXPIRED_MARKER } from "../scraper.workflow";

describe("isTokenExpiredError", () => {
	it("recognises the marker on a plain Error, as it arrives after serialisation", () => {
		expect(isTokenExpiredError(new Error(TOKEN_EXPIRED_MARKER))).toBe(true);
	});

	it("recognises the marker when the runtime wraps the message", () => {
		expect(
			isTokenExpiredError(new Error(`Step failed: ${TOKEN_EXPIRED_MARKER}`)),
		).toBe(true);
	});

	it("recognises a bare string, since a rethrown value need not be an Error", () => {
		expect(isTokenExpiredError(TOKEN_EXPIRED_MARKER)).toBe(true);
	});

	it("does not claim unrelated failures — they must keep failing the job", () => {
		for (const other of [
			new Error("TCAD API returned 500"),
			new Error("KV PUT failed: 413"),
			new Error("Network connection lost"),
			undefined,
			null,
		]) {
			expect(isTokenExpiredError(other)).toBe(false);
		}
	});
});
