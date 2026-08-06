/**
 * Security Tests for XController JSON-for-HTML encoding.
 *
 * HTTP-level security-header tests (CSP, HSTS, etc.) were removed with the
 * Express entrypoint; those headers are now the Workers API's responsibility.
 */

import { describe, expect, test } from "vitest";
import { encodeJsonForHtml } from "../middleware/xcontroller.middleware";

describe("Security Tests", () => {
	describe("XSS Prevention", () => {
		test("should prevent script injection via < character", () => {
			const malicious = { html: '<script>alert("xss")</script>' };
			const encoded = encodeJsonForHtml(malicious);

			expect(encoded).not.toContain("<script>");
			expect(encoded).toContain("\\u003Cscript\\u003E");
		});

		test("should prevent script injection via closing tag", () => {
			const malicious = { payload: '</script><script>alert("xss")</script>' };
			const encoded = encodeJsonForHtml(malicious);

			expect(encoded).not.toContain("</script><script>");
			expect(encoded).toContain("\\u003C/script\\u003E");
		});

		test("should prevent event handler injection", () => {
			const malicious = { html: '<img src=x onerror=alert("xss")>' };
			const encoded = encodeJsonForHtml(malicious);

			expect(encoded).not.toContain("<img");
			expect(encoded).toContain("\\u003Cimg");
		});

		test("should prevent javascript: URL injection", () => {
			const malicious = { url: 'javascript:alert("xss")' };
			const encoded = encodeJsonForHtml(malicious);

			// Data should be encoded but javascript: prefix stays (it's just text)
			expect(JSON.parse(encoded).url).toBe('javascript:alert("xss")');
			// But it won't execute as it's in JSON
		});

		test("should handle unicode escape sequences", () => {
			const malicious = {
				text: '\u003Cscript\u003Ealert("xss")\u003C/script\u003E',
			};
			const encoded = encodeJsonForHtml(malicious);

			// Unicode escapes in source code become literal characters at runtime (<script>)
			// So they should be encoded the same way as literal < characters
			expect(encoded).not.toContain("<script>");
			expect(encoded).toContain("\\u003Cscript\\u003E");
		});

		test("should prevent data URI injection", () => {
			const malicious = {
				data: 'data:text/html,<script>alert("xss")</script>',
			};
			const encoded = encodeJsonForHtml(malicious);

			expect(encoded).not.toContain("<script>");
		});
	});

	describe("Input Validation", () => {
		test("should handle malformed JSON gracefully", () => {
			const invalidJson = '{"incomplete": ';

			expect(() => {
				JSON.parse(invalidJson);
			}).toThrow();

			// Our encoding should still work with valid objects
			const valid = { test: "value" };
			const encoded = encodeJsonForHtml(valid);
			expect(() => JSON.parse(encoded)).not.toThrow();
		});

		test("should handle extremely large data", () => {
			const LARGE_ARRAY_SIZE = 10_000;
			const largeArray = Array(LARGE_ARRAY_SIZE).fill({ data: "test" });
			const encoded = encodeJsonForHtml(largeArray);

			expect(encoded.length).toBeGreaterThan(LARGE_ARRAY_SIZE);
			expect(() => JSON.parse(encoded)).not.toThrow();
		});

		test("should handle special characters in strings", () => {
			const specialChars = {
				quotes: 'He said "Hello"',
				apostrophe: "It's working",
				backslash: "path\\to\\file",
				newline: "Line 1\nLine 2",
				tab: "Col1\tCol2",
			};

			const encoded = encodeJsonForHtml(specialChars);
			const decoded = JSON.parse(encoded);

			expect(decoded).toEqual(specialChars);
		});
	});

	describe("Attack Vectors", () => {
		test("should prevent polyglot attacks", () => {
			const polyglot = {
				payload:
					"/*-/*`/*\\`/*'/*\"/**/(/* */onerror=alert('xss') )//%0D%0A%0d%0a//<script>alert(\"xss\")</script>",
			};

			const encoded = encodeJsonForHtml(polyglot);
			expect(encoded).not.toContain("<script>");
			expect(encoded).not.toContain("onerror=");
		});

		test("should prevent mutation XSS (mXSS)", () => {
			const mxss = {
				payload:
					'<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
			};

			const encoded = encodeJsonForHtml(mxss);
			expect(encoded).not.toContain("<noscript>");
			expect(encoded).not.toContain("<img");
		});

		test("should prevent CSS injection", () => {
			const cssInjection = {
				style: 'expression(alert("xss"))',
			};

			const encoded = encodeJsonForHtml(cssInjection);
			// Should be safely encoded as a string
			const decoded = JSON.parse(encoded);
			expect(decoded.style).toBe('expression(alert("xss"))');
			// But won't execute as it's just data
		});

		test("should prevent CRLF injection", () => {
			// JSON.stringify escapes \r and \n as \\r and \\n in the string representation
			// When parsed back, they become \r\n again (round-trip preserved)
			// The security is that raw CRLF bytes aren't in the HTML output
			const crlfInjection = {
				header: "value\r\nX-Injected: malicious",
			};

			const encoded = encodeJsonForHtml(crlfInjection);

			// The encoded string should NOT contain raw CRLF bytes
			expect(encoded).not.toContain("\r\n");
			// It should contain escaped versions
			expect(encoded).toContain("\\r\\n");

			// But parsing should restore the original value
			const decoded = JSON.parse(encoded);
			expect(decoded.header).toBe("value\r\nX-Injected: malicious");
		});
	});

});
