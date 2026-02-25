/**
 * Claude Search Service Tests
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createPrismaMock } from "./helpers/claude-mock";

const { mockCreate, MockAnthropic } = vi.hoisted(() => {
	const mockCreate = vi.fn();
	class MockAnthropic {
		messages = {
			create: mockCreate,
		};
	}
	return { mockCreate, MockAnthropic };
});

vi.mock("../prisma", () => createPrismaMock());
vi.mock("@anthropic-ai/sdk", () => ({
	default: MockAnthropic,
}));

// Import after mocks are set up
import { ClaudeSearchService } from "../claude.service";

describe("ClaudeSearchService", () => {
	let service: ClaudeSearchService;

	beforeEach(() => {
		// Reset mocks before each test
		vi.clearAllMocks();
		service = new ClaudeSearchService();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("parseNaturalLanguageQuery", () => {
		describe("Successful Claude API Responses", () => {
			test("should parse city-based query", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									city: { contains: "Austin", mode: "insensitive" },
								},
								explanation: "Searching for properties in Austin",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"properties in Austin",
				);

				expect(result.whereClause).toEqual({
					city: { contains: "Austin", mode: "insensitive" },
				});
				expect(result.explanation).toBe("Searching for properties in Austin");
				expect(mockCreate).toHaveBeenCalledTimes(1);
			});

			test("should parse value-based query with range", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									appraisedValue: { gte: 300000, lte: 600000 },
								},
								orderBy: { appraisedValue: "asc" },
								explanation:
									"Searching for properties with appraised value between $300,000 and $600,000",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"properties appraised between 300k and 600k",
				);

				expect(result.whereClause).toEqual({
					appraisedValue: { gte: 300000, lte: 600000 },
				});
				expect(result.orderBy).toEqual({ appraisedValue: "asc" });
				expect(mockCreate).toHaveBeenCalledTimes(1);
			});

			test("should parse owner name query", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									name: { contains: "Smith", mode: "insensitive" },
								},
								explanation: "Searching for properties owned by Smith",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"properties owned by Smith",
				);

				expect(result.whereClause).toEqual({
					name: { contains: "Smith", mode: "insensitive" },
				});
				expect(mockCreate).toHaveBeenCalledTimes(1);
			});

			test("should parse property type query", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									propType: { contains: "Commercial", mode: "insensitive" },
								},
								explanation: "Searching for commercial properties",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"commercial properties",
				);

				expect(result.whereClause).toEqual({
					propType: { contains: "Commercial", mode: "insensitive" },
				});
				expect(mockCreate).toHaveBeenCalledTimes(1);
			});

			test("should parse address-based query", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									propertyAddress: {
										contains: "Congress",
										mode: "insensitive",
									},
								},
								explanation:
									"Searching for properties with 'Congress' in the address",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"properties on Congress Ave",
				);

				expect(result.whereClause).toEqual({
					propertyAddress: { contains: "Congress", mode: "insensitive" },
				});
				expect(mockCreate).toHaveBeenCalledTimes(1);
			});

			test("should parse complex combined query", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									city: "Austin",
									propType: { contains: "Residential", mode: "insensitive" },
									appraisedValue: { gte: 500000 },
								},
								orderBy: { appraisedValue: "desc" },
								explanation:
									"Searching for residential properties in Austin with appraised value over $500,000, sorted by value (highest first)",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"residential properties in Austin worth over 500k",
				);

				expect(result.whereClause).toEqual({
					city: "Austin",
					propType: { contains: "Residential", mode: "insensitive" },
					appraisedValue: { gte: 500000 },
				});
				expect(result.orderBy).toEqual({ appraisedValue: "desc" });
				expect(mockCreate).toHaveBeenCalledTimes(1);
			});

			test("should handle orderBy being optional", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									city: { contains: "Austin", mode: "insensitive" },
								},
								explanation: "Searching for properties in Austin",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"properties in Austin",
				);

				expect(result.whereClause).toBeDefined();
				expect(result.orderBy).toBeUndefined();
				expect(mockCreate).toHaveBeenCalledTimes(1);
			});
		});

		describe("Error Handling and Fallback", () => {
			test("should fallback to simple text search on API error", async () => {
				mockCreate.mockRejectedValue(new Error("API Error"));

				const result = await service.parseNaturalLanguageQuery("test query");

				expect(result.whereClause).toEqual({
					OR: [
						{ name: { contains: "test query", mode: "insensitive" } },
						{
							propertyAddress: { contains: "test query", mode: "insensitive" },
						},
						{ city: { contains: "test query", mode: "insensitive" } },
						{ description: { contains: "test query", mode: "insensitive" } },
					],
				});
				// Updated to match new error message format with categorized errors
				expect(result.explanation).toContain("test query");
				expect(result.explanation).toContain("text search fallback");
			});

			test("should fallback on authentication error", async () => {
				mockCreate.mockRejectedValue(
					new Error("401 authentication_error: invalid x-api-key"),
				);

				const result =
					await service.parseNaturalLanguageQuery("Austin properties");

				expect(result.whereClause.OR).toBeDefined();
				expect(result.whereClause.OR).toHaveLength(4);
			});

			test("should fallback on model not found error", async () => {
				mockCreate.mockRejectedValue(
					new Error("404 not_found_error: model: claude-3-5-sonnet-20241022"),
				);

				const result =
					await service.parseNaturalLanguageQuery("Austin properties");

				expect(result.whereClause.OR).toBeDefined();
				expect(result.explanation).toContain("Austin properties");
			});

			test("should fallback on invalid JSON response", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: "Invalid JSON response",
						},
					],
				});

				const result = await service.parseNaturalLanguageQuery("test query");

				expect(result.whereClause.OR).toBeDefined();
			});

			test("should fallback on empty response", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: "",
						},
					],
				});

				const result = await service.parseNaturalLanguageQuery("test query");

				expect(result.whereClause.OR).toBeDefined();
			});

			test("should handle missing whereClause in response", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								explanation: "Some explanation",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery("test query");

				expect(result.whereClause).toEqual({});
				expect(result.explanation).toBe("Some explanation");
			});

			test("should provide default explanation when missing", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: { city: "Austin" },
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery("test query");

				expect(result.explanation).toBe(
					"Searching properties based on your query",
				);
			});
		});

		describe("API Request Parameters", () => {
			test("should use correct model", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({ whereClause: {}, explanation: "Test" }),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				await service.parseNaturalLanguageQuery("test");

				expect(mockCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						model: "claude-3-haiku-20240307",
					}),
				);
			});

			test("should set appropriate max_tokens", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({ whereClause: {}, explanation: "Test" }),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				await service.parseNaturalLanguageQuery("test");

				expect(mockCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						max_tokens: 1024,
					}),
				);
			});

			test("should include user query in prompt", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({ whereClause: {}, explanation: "Test" }),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				await service.parseNaturalLanguageQuery("find expensive homes");

				const callArgs = mockCreate.mock.calls[0][0];
				expect(callArgs.messages[0].content).toContain("find expensive homes");
			});
		});

		describe("Edge Cases", () => {
			test("should handle empty query string", async () => {
				mockCreate.mockRejectedValue(new Error("Empty query"));

				const result = await service.parseNaturalLanguageQuery("");

				expect(result.whereClause.OR).toBeDefined();
			});

			test("should handle very long query", async () => {
				const longQuery = "properties ".repeat(100);
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: { city: "Austin" },
								explanation: "Processed long query",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(longQuery);

				expect(result.whereClause).toBeDefined();
				expect(mockCreate).toHaveBeenCalledTimes(1);
			});

			test("should handle special characters in query", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									propertyAddress: {
										contains: "O'Connor",
										mode: "insensitive",
									},
								},
								explanation: "Searching for properties on O'Connor",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"properties on O'Connor St",
				);

				expect(result.whereClause).toBeDefined();
			});

			test("should handle Unicode characters", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									city: { contains: "São Paulo", mode: "insensitive" },
								},
								explanation: "Searching for properties in São Paulo",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"properties in São Paulo",
				);

				expect(result.whereClause).toBeDefined();
			});
		});

		describe("Schema Field Names", () => {
			test("should use searchTerm field (camelCase) not search_term", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									searchTerm: { contains: "Smith", mode: "insensitive" },
								},
								explanation:
									"Searching for properties found via Smith search term",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"properties from Smith search",
				);

				expect(result.whereClause).toEqual({
					searchTerm: { contains: "Smith", mode: "insensitive" },
				});
				expect(result.explanation).toBe(
					"Searching for properties found via Smith search term",
				);
			});

			test("should use propType field (camelCase) not prop_type", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									propType: { contains: "Residential", mode: "insensitive" },
								},
								explanation: "Searching for residential properties",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"residential properties",
				);

				expect(result.whereClause).toHaveProperty("propType");
				expect(result.whereClause).not.toHaveProperty("prop_type");
			});

			test("should use propertyAddress field (camelCase) not property_address", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									propertyAddress: { contains: "Main St", mode: "insensitive" },
								},
								explanation: "Searching for properties on Main St",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"properties on Main St",
				);

				expect(result.whereClause).toHaveProperty("propertyAddress");
				expect(result.whereClause).not.toHaveProperty("property_address");
			});

			test("should use appraisedValue field (camelCase) not appraised_value", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({
								whereClause: {
									appraisedValue: { gte: 500000 },
								},
								orderBy: { appraisedValue: "desc" },
								explanation: "Searching for properties appraised over $500,000",
							}),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				const result = await service.parseNaturalLanguageQuery(
					"properties worth over 500k",
				);

				expect(result.whereClause).toHaveProperty("appraisedValue");
				expect(result.whereClause).not.toHaveProperty("appraised_value");
				expect(result.orderBy).toHaveProperty("appraisedValue");
			});

			test("should verify prompt includes correct Prisma field names", async () => {
				mockCreate.mockResolvedValue({
					content: [
						{
							type: "text",
							text: JSON.stringify({ whereClause: {}, explanation: "Test" }),
						},
					],
					usage: { input_tokens: 100, output_tokens: 50 },
				});

				await service.parseNaturalLanguageQuery("test");

				const callArgs = mockCreate.mock.calls[0][0];
				const prompt = callArgs.messages[0].content;

				// Verify the prompt uses camelCase Prisma field names, not snake_case DB names
				expect(prompt).toContain("searchTerm");
				expect(prompt).toContain("propType");
				expect(prompt).toContain("propertyAddress");
				expect(prompt).toContain("appraisedValue");
				expect(prompt).toContain("assessedValue");
				expect(prompt).toContain("geoId");
				expect(prompt).toContain("scrapedAt");
				expect(prompt).toContain("createdAt");
				expect(prompt).toContain("updatedAt");

				// Should NOT contain snake_case versions
				expect(prompt).not.toContain("search_term");
				expect(prompt).not.toContain("prop_type");
				expect(prompt).not.toContain("property_address");
				expect(prompt).not.toContain("appraised_value");
				expect(prompt).not.toContain("assessed_value");
			});
		});
	});
});
