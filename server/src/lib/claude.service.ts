import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { config } from "../config";
import { getErrorMessage } from "../utils/error-helpers";
import { calculateClaudeCost } from "./claude-pricing";
import logger from "./logger";
import { prisma } from "./prisma";

const anthropic = new Anthropic({
	apiKey: config.claude.apiKey,
});

import type { AnswerType } from "../types/property.types";

interface SearchFilters {
	whereClause: Prisma.PropertyWhereInput;
	orderBy?: Prisma.PropertyOrderByWithRelationInput;
	explanation: string;
	answer?: string;
	answerType?: AnswerType;
}

/**
 * Error categorization for actionable error messages (ERROR #5 fix)
 */
interface ClaudeErrorDetails {
	type:
		| "authentication"
		| "model"
		| "timeout"
		| "rate_limit"
		| "invalid_request"
		| "api_error";
	message: string;
	actionable: string;
	retryable: boolean;
}

function categorizeClaudeError(error: unknown): ClaudeErrorDetails {
	const errorMsg = getErrorMessage(error);

	// Authentication errors
	if (
		errorMsg.includes("401") ||
		errorMsg.includes("authentication_error") ||
		errorMsg.includes("invalid x-api-key")
	) {
		return {
			type: "authentication",
			message: "Claude API authentication failed",
			actionable:
				"Check ANTHROPIC_API_KEY environment variable is set correctly",
			retryable: false,
		};
	}

	// Model errors
	if (
		errorMsg.includes("404") ||
		errorMsg.includes("not_found_error") ||
		errorMsg.includes("model:")
	) {
		return {
			type: "model",
			message: "Claude model not found or unavailable",
			actionable: `Check model name in config (current: ${config.claude.model})`,
			retryable: false,
		};
	}

	// Timeout errors
	if (
		errorMsg.includes("timeout") ||
		errorMsg.includes("ETIMEDOUT") ||
		errorMsg.includes("ECONNABORTED")
	) {
		return {
			type: "timeout",
			message: "Claude API request timed out",
			actionable: "Retry request or check network connectivity",
			retryable: true,
		};
	}

	// Rate limiting
	if (errorMsg.includes("429") || errorMsg.includes("rate_limit")) {
		return {
			type: "rate_limit",
			message: "Claude API rate limit exceeded",
			actionable: "Wait before retrying or upgrade API plan",
			retryable: true,
		};
	}

	// Invalid request
	if (errorMsg.includes("400") || errorMsg.includes("invalid_request")) {
		return {
			type: "invalid_request",
			message: "Invalid request to Claude API",
			actionable: "Check request parameters and format",
			retryable: false,
		};
	}

	// Generic API error
	return {
		type: "api_error",
		message: "Claude API error",
		actionable: "Check API status and logs for details",
		retryable: true,
	};
}

export class ClaudeSearchService {
	/**
	 * Log API usage to the database for monitoring and cost tracking
	 */
	private async logApiUsage(
		queryText: string,
		inputTokens: number,
		outputTokens: number,
		model: string,
		success: boolean,
		responseTime: number,
		errorMessage?: string,
	): Promise<void> {
		try {
			const queryCost = calculateClaudeCost(model, inputTokens, outputTokens);
			const environment = config?.env?.nodeEnv || "development";

			await prisma.apiUsageLog.create({
				data: {
					queryText,
					queryCost,
					inputTokens,
					outputTokens,
					model,
					environment,
					success,
					errorMessage,
					responseTime,
				},
			});

			logger.info(
				`Claude API usage logged: ${inputTokens} input + ${outputTokens} output tokens, cost: $${queryCost.toFixed(6)}, success: ${success}`,
			);
		} catch (error) {
			// Don't fail the main request if logging fails
			const errorMsg = getErrorMessage(error);
			logger.error(`Failed to log API usage: ${errorMsg}`);
		}
	}

	async parseNaturalLanguageQuery(query: string): Promise<SearchFilters> {
		const startTime = Date.now();
		let inputTokens = 0;
		let outputTokens = 0;
		let success = false;
		let errorMessage: string | undefined;

		try {
			const message = await anthropic.messages.create({
				model: config.claude.model,
				max_tokens: config.claude.maxTokens,
				messages: [
					{
						role: "user",
						content: `You are a database query generator for a property search system. Convert the user's natural language query into Prisma query filters.

Available fields in the properties table:
- id (text): unique identifier
- propertyId (text): property ID from TCAD
- name (text): owner name
- propType (text): property type (e.g., "Residential", "Commercial", "Industrial")
- city (text): city name
- propertyAddress (text): full address
- assessedValue (number): assessed value in dollars
- appraisedValue (number): appraised value in dollars
- geoId (text): geographic ID
- description (text): property description
- searchTerm (text): original search term used to find this property
- scrapedAt (datetime): when the data was scraped
- createdAt (datetime): record creation time
- updatedAt (datetime): last update time

User query: "${query}"

Generate a JSON response with these fields:
1. "whereClause": Prisma where clause as JSON (use "contains" for text searches with "mode": "insensitive" for case-insensitive, "gte"/"lte" for number ranges, "gt"/"lt" for comparisons)
2. "orderBy": Prisma orderBy clause (optional, use "asc" or "desc")
3. "explanation": Brief explanation of what you're searching for
4. "answer": (REQUIRED for quantitative questions) A natural language answer template. Use {count} as placeholder for the number of results and {totalValue} for sum of appraised values. For example: "{count} properties found with appraisal value over $5,000,000" or "Found {count} commercial properties with total value of {totalValue}"
5. "answerType": (REQUIRED if answer is provided) One of: "count" (for how many questions), "statistical" (for averages, totals, comparisons), or "descriptive" (for general searches)

Examples:

Query: "how many properties are worth over 5 million in Austin?"
Response:
{
  "whereClause": {
    "city": "Austin",
    "appraisedValue": { "gte": 5000000 }
  },
  "orderBy": { "appraisedValue": "desc" },
  "explanation": "Searching for properties in Austin with appraised value over $5,000,000",
  "answer": "{count} properties found in Austin with appraisal value over $5,000,000",
  "answerType": "count"
}

Query: "what is the total value of commercial properties?"
Response:
{
  "whereClause": {
    "propType": { "contains": "Commercial", "mode": "insensitive" }
  },
  "orderBy": { "appraisedValue": "desc" },
  "explanation": "Searching for commercial properties",
  "answer": "Found {count} commercial properties with total appraised value of {totalValue}",
  "answerType": "statistical"
}

Query: "properties in Austin worth over 500k"
Response:
{
  "whereClause": {
    "city": "Austin",
    "appraisedValue": { "gte": 500000 }
  },
  "orderBy": { "appraisedValue": "desc" },
  "explanation": "Searching for properties in Austin with appraised value over $500,000, sorted by value (highest first)"
}

Query: "commercial properties owned by Smith"
Response:
{
  "whereClause": {
    "propType": { "contains": "Commercial", "mode": "insensitive" },
    "name": { "contains": "Smith", "mode": "insensitive" }
  },
  "explanation": "Searching for commercial properties where owner name contains 'Smith'"
}

Query: "show me the most expensive residential properties"
Response:
{
  "whereClause": {
    "propType": { "contains": "Residential", "mode": "insensitive" }
  },
  "orderBy": { "appraisedValue": "desc" },
  "explanation": "Showing residential properties sorted by appraised value (highest first)"
}

Query: "properties on Congress Ave"
Response:
{
  "whereClause": {
    "propertyAddress": { "contains": "Congress", "mode": "insensitive" }
  },
  "explanation": "Searching for properties with 'Congress' in the address"
}

Query: "find properties appraised between 300k and 600k"
Response:
{
  "whereClause": {
    "appraisedValue": { "gte": 300000, "lte": 600000 }
  },
  "orderBy": { "appraisedValue": "asc" },
  "explanation": "Searching for properties with appraised value between $300,000 and $600,000"
}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- Use "mode": "insensitive" for all text searches
- Convert dollar amounts (like "500k" or "$1M") to numbers (500000, 1000000)
- For text searches, use "contains" with "mode": "insensitive"
- Only include orderBy if the query implies sorting
- Keep explanations brief and user-friendly
- For questions starting with "how many", "what is the total", "count", "average", etc., ALWAYS include answer and answerType fields
- Use {count} placeholder in answer for the number of matching properties
- Use {totalValue} placeholder in answer when discussing total values

Now generate the JSON for the user's query above.`,
					},
				],
			});

			const responseText =
				message.content[0].type === "text" ? message.content[0].text : "";
			logger.info(`Claude response: ${responseText.substring(0, 200)}...`);

			// Extract token usage from the response with null-safe access (ERROR #2 fix)
			inputTokens = message.usage?.input_tokens ?? 0;
			outputTokens = message.usage?.output_tokens ?? 0;

			if (!message.usage) {
				logger.warn(
					"Claude API response missing usage metadata, defaulting to 0 tokens",
				);
			}

			// Validate and parse the JSON response with multi-stage extraction (ERROR #3, #4 fix)
			let cleanedResponse = responseText.trim();

			// Stage 1: Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json...```)
			if (cleanedResponse.startsWith("```")) {
				const match = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
				if (match) {
					cleanedResponse = match[1].trim();
					logger.debug("Extracted JSON from markdown code block");
				}
			}

			// Stage 2: If response doesn't start with { or [, try to extract JSON from text
			if (
				!cleanedResponse.startsWith("{") &&
				!cleanedResponse.startsWith("[")
			) {
				logger.info("Response has text prefix, attempting JSON extraction");

				// Try to extract JSON object from text (e.g., "Here is the result:\n{...}")
				const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					cleanedResponse = jsonMatch[0];
					logger.info("Successfully extracted JSON from text response");
				} else {
					logger.warn(
						`Could not extract JSON from response starting with: "${cleanedResponse.substring(0, 100)}..."`,
					);
					// Don't throw - fall through to parse attempt which will fail and trigger fallback
				}
			}

			// Stage 3: Parse with error handling and fallback
			let parsed: Partial<SearchFilters>;
			try {
				parsed = JSON.parse(cleanedResponse) as Partial<SearchFilters>;

				// Validate critical fields exist
				if (!parsed.whereClause || typeof parsed.whereClause !== "object") {
					logger.warn(
						"Parsed JSON missing or invalid whereClause, using empty clause",
					);
					parsed.whereClause = {};
				}

				logger.info("Successfully parsed and validated Claude response");
			} catch (parseError) {
				const errorMsg =
					parseError instanceof Error ? parseError.message : String(parseError);
				logger.warn(
					`JSON parse failed: ${errorMsg}, falling back to generic search`,
				);
				logger.debug(`Failed to parse: ${cleanedResponse.substring(0, 200)}`);

				// Return fallback immediately instead of throwing (ERROR #4 fix)
				const responseTime = Date.now() - startTime;
				await this.logApiUsage(
					query,
					inputTokens,
					outputTokens,
					config.claude.model,
					false, // Parsing failed, but API call worked
					responseTime,
					`JSON parse failed: ${errorMsg}`,
				);

				return {
					whereClause: {
						OR: [
							{ name: { contains: query, mode: "insensitive" } },
							{ propertyAddress: { contains: query, mode: "insensitive" } },
							{ city: { contains: query, mode: "insensitive" } },
							{ description: { contains: query, mode: "insensitive" } },
						],
					},
					explanation: `Searching for "${query}" (Claude response parsing failed, using text search)`,
				};
			}

			success = true;
			const responseTime = Date.now() - startTime;

			// Log successful API usage
			await this.logApiUsage(
				query,
				inputTokens,
				outputTokens,
				config.claude.model,
				success,
				responseTime,
			);

			return {
				whereClause: parsed.whereClause || {},
				orderBy: parsed.orderBy,
				explanation:
					parsed.explanation || "Searching properties based on your query",
				answer: parsed.answer,
				answerType: parsed.answerType,
			};
		} catch (error) {
			const responseTime = Date.now() - startTime;

			// Categorize the error for actionable messages (ERROR #5 fix)
			const errorDetails = categorizeClaudeError(error);

			// Log with categorized error details (Pino expects object first, then message)
			logger.error(
				{
					query,
					errorType: errorDetails.type,
					actionable: errorDetails.actionable,
					retryable: errorDetails.retryable,
					originalError: getErrorMessage(error),
				},
				`Claude API error [${errorDetails.type}]: ${errorDetails.message}`,
			);

			errorMessage = `${errorDetails.message} - ${errorDetails.actionable}`;

			// Log failed API usage (even if we don't have token counts)
			await this.logApiUsage(
				query,
				inputTokens,
				outputTokens,
				config.claude.model,
				false, // success = false
				responseTime,
				errorMessage,
			);

			// Fallback: simple text search across multiple fields
			return {
				whereClause: {
					OR: [
						{ name: { contains: query, mode: "insensitive" } },
						{ propertyAddress: { contains: query, mode: "insensitive" } },
						{ city: { contains: query, mode: "insensitive" } },
						{ description: { contains: query, mode: "insensitive" } },
					],
				},
				explanation: `Searching for "${query}" (${errorDetails.message}, using text search fallback)`,
			};
		}
	}
}

export const claudeSearchService = new ClaudeSearchService();
