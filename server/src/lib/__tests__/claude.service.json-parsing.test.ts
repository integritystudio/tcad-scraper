/**
 * Claude JSON Parsing Regression Tests
 *
 * Regression tests for ERROR #4: Claude JSON Parsing Crashes (Nov 26, 2025)
 *
 * These tests verify that:
 * 1. JSON response validation works correctly
 * 2. Markdown code block stripping (```json...```) works
 * 3. Try-catch with fallback behavior works
 * 4. Various malformed responses are handled gracefully
 *
 * Fix Location: server/src/lib/claude.service.ts:205-232
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to declare mocks before they're used
const { mockCreate, MockAnthropic } = vi.hoisted(() => {
	const mockCreate = vi.fn();
	class MockAnthropic {
		messages = {
			create: mockCreate,
		};
	}
	return { mockCreate, MockAnthropic };
});

// Mock the config module
vi.mock("../../config", () => ({
	config: {
		claude: {
			apiKey: "test-api-key",
			model: "claude-3-haiku-20240307",
			maxTokens: 1024,
		},
	},
}));

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => ({
	default: MockAnthropic,
}));

// Import after mocks are set up
import { ClaudeSearchService } from "../claude.service";

describe("Claude JSON Parsing - Regression Tests", () => {
	let service: ClaudeSearchService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new ClaudeSearchService();
	});

	describe("Markdown Code Block Stripping (FIX)", () => {
		it("should strip ```json...``` wrapper from response", async () => {
			const validJSON = {
				whereClause: { city: "Austin" },
				explanation: "Searching for Austin properties",
			};

			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: `\`\`\`json\n${JSON.stringify(validJSON)}\n\`\`\``,
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result =
				await service.parseNaturalLanguageQuery("Austin properties");

			expect(result.whereClause).toEqual({ city: "Austin" });
			expect(result.explanation).toBe("Searching for Austin properties");
		});

		it("should strip ``` wrapper without json tag", async () => {
			const validJSON = {
				whereClause: { city: "Dallas" },
				explanation: "Searching for Dallas properties",
			};

			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: `\`\`\`\n${JSON.stringify(validJSON)}\n\`\`\``,
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result =
				await service.parseNaturalLanguageQuery("Dallas properties");

			expect(result.whereClause).toEqual({ city: "Dallas" });
		});

		it("should handle response with whitespace around code block", async () => {
			const validJSON = {
				whereClause: { city: "Houston" },
				explanation: "Searching for Houston properties",
			};

			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: `\n\n\`\`\`json\n  ${JSON.stringify(validJSON)}  \n\`\`\`\n\n`,
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result =
				await service.parseNaturalLanguageQuery("Houston properties");

			expect(result.whereClause).toEqual({ city: "Houston" });
		});

		it("should parse clean JSON without code blocks", async () => {
			const validJSON = {
				whereClause: { city: "San Antonio" },
				explanation: "Searching for San Antonio properties",
			};

			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: JSON.stringify(validJSON),
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result = await service.parseNaturalLanguageQuery(
				"San Antonio properties",
			);

			expect(result.whereClause).toEqual({ city: "San Antonio" });
		});
	});

	describe("JSON Validation (FIX)", () => {
		it("should extract JSON from response with text prefix", async () => {
			// Updated: Our new multi-stage JSON extraction NOW successfully extracts
			// JSON from responses with text prefixes like "Here is the result:\n{...}"
			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: 'Here is the search result:\n{"whereClause": {"city": "Austin"}, "explanation": "Test"}',
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result = await service.parseNaturalLanguageQuery("test query");

			// Should successfully extract and parse the JSON
			expect(result.whereClause).toEqual({ city: "Austin" });
			expect(result.explanation).toBe("Test");
		});

		it("should accept response starting with {", async () => {
			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: '{"whereClause": {"city": "Austin"}, "explanation": "Test"}',
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result = await service.parseNaturalLanguageQuery("Austin");

			expect(result.whereClause).toEqual({ city: "Austin" });
		});

		it("should accept response starting with [", async () => {
			// Although our service doesn't expect arrays, JSON validation should pass
			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: '[{"test": true}]',
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			// This will parse but then fail to extract whereClause
			const result = await service.parseNaturalLanguageQuery("test");

			// Should return empty whereClause when parsing non-object
			expect(result.whereClause).toEqual({});
		});
	});

	describe("Try-Catch Fallback Behavior (FIX)", () => {
		it("should fallback on malformed JSON", async () => {
			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: '{"whereClause": { invalid json }',
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result = await service.parseNaturalLanguageQuery("test query");

			// Should fallback to simple text search
			expect(result.whereClause.OR).toBeDefined();
			expect(result.explanation).toContain("test query");
		});

		it("should fallback on truncated JSON", async () => {
			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: '{"whereClause": {"city": "Austin", "appraisedValue":',
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result = await service.parseNaturalLanguageQuery("test");

			expect(result.whereClause.OR).toBeDefined();
		});

		it("should fallback on empty response", async () => {
			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: "",
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result = await service.parseNaturalLanguageQuery("test");

			expect(result.whereClause.OR).toBeDefined();
		});

		it("should fallback on whitespace-only response", async () => {
			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: "   \n\n   ",
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result = await service.parseNaturalLanguageQuery("test");

			expect(result.whereClause.OR).toBeDefined();
		});

		it("should fallback on API exception", async () => {
			mockCreate.mockRejectedValue(new Error("API timeout"));

			const result = await service.parseNaturalLanguageQuery("test");

			expect(result.whereClause.OR).toBeDefined();
			expect(result.explanation).toContain("test");
		});

		it("should fallback on network error", async () => {
			mockCreate.mockRejectedValue(new Error("ECONNREFUSED"));

			const result = await service.parseNaturalLanguageQuery("Austin homes");

			expect(result.whereClause.OR).toBeDefined();
			expect(result.explanation).toContain("Austin homes");
		});
	});

	describe("Fallback Query Structure", () => {
		it("should create OR clause searching all text fields", async () => {
			mockCreate.mockRejectedValue(new Error("API Error"));

			const result = await service.parseNaturalLanguageQuery("Smith Trust");

			expect(result.whereClause.OR).toEqual([
				{ name: { contains: "Smith Trust", mode: "insensitive" } },
				{ propertyAddress: { contains: "Smith Trust", mode: "insensitive" } },
				{ city: { contains: "Smith Trust", mode: "insensitive" } },
				{ description: { contains: "Smith Trust", mode: "insensitive" } },
			]);
		});

		it("should include user query in fallback explanation", async () => {
			mockCreate.mockRejectedValue(new Error("Rate limited"));

			const result = await service.parseNaturalLanguageQuery(
				"expensive downtown properties",
			);

			// Updated: New error message format includes categorized error type and fallback indicator
			expect(result.explanation).toContain("expensive downtown properties");
			expect(result.explanation).toContain("text search fallback");
		});
	});

	describe("Edge Cases", () => {
		it("should handle JSON with nested objects", async () => {
			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: JSON.stringify({
							whereClause: {
								AND: [
									{ city: { contains: "Austin", mode: "insensitive" } },
									{ appraisedValue: { gte: 500000 } },
								],
							},
							explanation: "Complex query",
						}),
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result =
				await service.parseNaturalLanguageQuery("Austin expensive");

			expect(result.whereClause.AND).toBeDefined();
			expect(result.whereClause.AND).toHaveLength(2);
		});

		it("should handle JSON with special characters in strings", async () => {
			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: JSON.stringify({
							whereClause: {
								name: { contains: "O'Brien & Associates", mode: "insensitive" },
							},
							explanation: "Searching for O'Brien",
						}),
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result =
				await service.parseNaturalLanguageQuery("O'Brien properties");

			expect(result.whereClause.name.contains).toBe("O'Brien & Associates");
		});

		it("should handle unicode characters in response", async () => {
			mockCreate.mockResolvedValue({
				content: [
					{
						type: "text",
						text: JSON.stringify({
							whereClause: { city: "Austin" },
							explanation:
								"Searching for properties in Austin (valued at > $1M)",
						}),
					},
				],
				usage: { input_tokens: 100, output_tokens: 50 },
			});

			const result = await service.parseNaturalLanguageQuery("Austin");

			expect(result.whereClause.city).toBe("Austin");
		});
	});

	describe("100% Uptime Requirement", () => {
		it("should NEVER throw an exception to the caller", async () => {
			// Test various failure scenarios - all should return gracefully
			const failureScenarios = [
				() => mockCreate.mockRejectedValue(new Error("API Error")),
				() => mockCreate.mockRejectedValue(new Error("401 Unauthorized")),
				() => mockCreate.mockRejectedValue(new Error("429 Too Many Requests")),
				() =>
					mockCreate.mockRejectedValue(new Error("500 Internal Server Error")),
				() =>
					mockCreate.mockRejectedValue(new TypeError("Cannot read property")),
				() =>
					mockCreate.mockResolvedValue({
						content: [{ type: "text", text: "" }],
						usage: { input_tokens: 0, output_tokens: 0 },
					}),
				() =>
					mockCreate.mockResolvedValue({
						content: [{ type: "text", text: "not json" }],
						usage: { input_tokens: 0, output_tokens: 0 },
					}),
				() =>
					mockCreate.mockResolvedValue({
						content: [{ type: "text", text: "{invalid}" }],
						usage: { input_tokens: 0, output_tokens: 0 },
					}),
			];

			for (const setupMock of failureScenarios) {
				setupMock();
				vi.clearAllMocks();

				// Should NEVER throw - always return a valid SearchFilters object
				const result = await service.parseNaturalLanguageQuery("test query");

				expect(result).toBeDefined();
				expect(result.whereClause).toBeDefined();
				expect(result.explanation).toBeDefined();
				expect(typeof result.explanation).toBe("string");
			}
		});
	});
});
