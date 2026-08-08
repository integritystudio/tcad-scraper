/**
 * Contract for shouldFallbackToGrok: the Grok fallback fires only for
 * Anthropic failures that a different provider could actually cure —
 * auth/billing/rate-limit statuses, plus the credit-balance case Anthropic
 * reports as HTTP 400 invalid_request_error instead of 402.
 */

import { describe, expect, it } from "vitest";
import { shouldFallbackToGrok } from "../claude.service";

function apiError(message: string, status?: number): Error {
	const error = new Error(message);
	if (status !== undefined) {
		(error as Error & { status?: number }).status = status;
	}
	return error;
}

describe("shouldFallbackToGrok", () => {
	it("rejects non-Error values", () => {
		expect(shouldFallbackToGrok("Claude API error 401")).toBe(false);
		expect(shouldFallbackToGrok(null)).toBe(false);
	});

	it("detects the credit-balance error Anthropic reports as 400", () => {
		const error = apiError(
			"Claude API error 400: Your credit balance is too low to access the Anthropic API",
			400,
		);

		expect(shouldFallbackToGrok(error)).toBe(true);
	});

	it("ignores unrelated 400 errors", () => {
		const error = apiError("Claude API error 400: invalid request", 400);

		expect(shouldFallbackToGrok(error)).toBe(false);
	});

	it.each([
		[401, "unauthorized"],
		[402, "payment required"],
		[429, "rate limited"],
	])("falls back on status %i (%s)", (status) => {
		expect(shouldFallbackToGrok(apiError("Claude API error", status))).toBe(
			true,
		);
	});

	it.each([
		[403, "forbidden"],
		[500, "server error"],
	])("does not fall back on status %i (%s)", (status) => {
		expect(shouldFallbackToGrok(apiError("Claude API error", status))).toBe(
			false,
		);
	});

	it("falls back on a fallback status embedded in the message when status is absent", () => {
		const error = apiError("Claude API error 429: rate limited");

		expect(shouldFallbackToGrok(error)).toBe(true);
	});

	it("does not fall back on a non-fallback status embedded in the message", () => {
		const error = apiError("Claude API error 500: internal error");

		expect(shouldFallbackToGrok(error)).toBe(false);
	});
});
