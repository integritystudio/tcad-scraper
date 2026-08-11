/**
 * Contract for shouldFallbackToGrok: the Grok fallback fires for two kinds of
 * Anthropic failure, and nothing else.
 *
 * 1. Anthropic specifically rejected the request and another provider might
 *    not — auth/billing/rate-limit statuses, plus the credit-balance case
 *    Anthropic reports as HTTP 400 invalid_request_error instead of 402.
 * 2. No answer came back at all — a timeout, which says nothing about Grok's
 *    health and so is worth retrying rather than treating as terminal.
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

	// A slow Anthropic says nothing about Grok's health. Without these cases the
	// timeout added for T17 would route a timed-out request straight to keyword
	// search, skipping a healthy Grok.
	it("falls back on the DOMException AbortSignal.timeout actually rejects with", async () => {
		const signal = AbortSignal.timeout(1);
		await new Promise((resolve) =>
			signal.addEventListener("abort", resolve, { once: true }),
		);

		// signal.reason is the exact value fetch() rejects with on timeout.
		expect(shouldFallbackToGrok(signal.reason)).toBe(true);
	});

	it("falls back on a TimeoutError carrying no status", () => {
		const error = new DOMException(
			"The operation was aborted due to timeout",
			"TimeoutError",
		);

		expect(shouldFallbackToGrok(error)).toBe(true);
	});

	it("does not fall back on a caller-initiated AbortError", () => {
		// Only AbortSignal.timeout() is treated as provider slowness; a manual
		// abort means the caller gave up, so retrying against Grok is waste.
		const error = new DOMException("This operation was aborted", "AbortError");

		expect(shouldFallbackToGrok(error)).toBe(false);
	});
});
