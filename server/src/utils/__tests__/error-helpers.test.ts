import { describe, expect, it } from "vitest";
import { getErrorMessage } from "../error-helpers";

describe("getErrorMessage", () => {
	it("should extract message from Error instance", () => {
		const error = new Error("something went wrong");
		expect(getErrorMessage(error)).toBe("something went wrong");
	});

	it("should extract message from TypeError", () => {
		const error = new TypeError("invalid type");
		expect(getErrorMessage(error)).toBe("invalid type");
	});

	it("should convert string to message", () => {
		expect(getErrorMessage("plain string error")).toBe("plain string error");
	});

	it("should convert number to string", () => {
		expect(getErrorMessage(404)).toBe("404");
	});

	it("should handle null", () => {
		expect(getErrorMessage(null)).toBe("null");
	});

	it("should handle undefined", () => {
		expect(getErrorMessage(undefined)).toBe("undefined");
	});

	it("should handle object with toString", () => {
		const error = { code: "ERR_TIMEOUT", toString: () => "timeout error" };
		expect(getErrorMessage(error)).toBe("timeout error");
	});

	it("should handle empty Error message", () => {
		const error = new Error("");
		expect(getErrorMessage(error)).toBe("");
	});
});
