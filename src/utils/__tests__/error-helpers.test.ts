import { describe, expect, it } from "vitest";
import { getErrorMessage } from "../error-helpers";

describe("getErrorMessage", () => {
	it("returns the message of an Error instance", () => {
		expect(getErrorMessage(new Error("boom"))).toBe("boom");
	});

	it("returns the provided fallback for a non-Error value", () => {
		expect(getErrorMessage("boom", "An error occurred")).toBe(
			"An error occurred",
		);
	});

	it("falls back to String(error) when no fallback is given", () => {
		expect(getErrorMessage("boom")).toBe("boom");
		expect(getErrorMessage(null)).toBe("null");
	});

	it("prefers the Error message over the fallback", () => {
		expect(getErrorMessage(new Error("boom"), "fallback")).toBe("boom");
	});
});
