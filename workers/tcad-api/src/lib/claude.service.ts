/**
 * Claude AI natural language search — Workers-compatible.
 * Ported from server/src/lib/claude.service.ts.
 * Key changes: no module-level Anthropic client, API key passed as argument,
 * uses fetch directly instead of Anthropic SDK (lighter for Workers bundle).
 * Supports fallback to OpenAI when Anthropic balance is unavailable.
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpStatus } from "../../../../utils/http-errors";
import { getErrorMessage } from "../utils/error-helpers";

const searchFiltersSchema = z.object({
	whereClause: z.record(z.any()),
	orderBy: z.record(z.any()).optional(),
	explanation: z.string(),
	answer: z.string().optional(),
	answerType: z.enum(["count", "statistical", "descriptive"]).optional(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema> & {
	whereClause: Prisma.PropertyWhereInput;
	orderBy?: Prisma.PropertyOrderByWithRelationInput;
};

const CLAUDE_MODEL = "claude-3-haiku-20240307";
const GPT_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 1024;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are a database query generator for a property search system. Convert the user's natural language query into Prisma query filters.

Available fields in the properties table:
- propertyId (text): property ID from TCAD
- name (text): owner name
- propType (text): property type (e.g., "Residential", "Commercial", "Industrial")
- city (text): city name
- propertyAddress (text): full address
- assessedValue (number): assessed value in dollars
- appraisedValue (number): appraised value in dollars
- geoId (text): geographic ID
- description (text): property description
- dba (text): "doing business as" name; altDba (text): alternate DBA
- ownerName (text): raw owner name; firstName, lastName, spouseFirstName, spouseLastName, nameSecondary (text): owner name parts
- latitude, longitude (number): coordinates
- zip (text): property ZIP code; state (text); country (text)
- fullSitus (text): full address including city/state/zip
- streetNum, streetName, streetPrefix, streetSuffix, streetSecondary (text): address parts
- addrDeliveryLine, addrCity, addrZip, addrState (text): owner mailing address (differs from property address for absentee owners)
- landValue, improvementValue (number): land/building value breakdown in dollars
- legalAcreage, effectiveSizeAcres (number): parcel size in acres
- zoning (text): zoning code (e.g., "CBD"); useCd (text): use code; sicCd (text): SIC industry code; marketArea (text): market area code
- block, lot, tract (text): plat references
- ownerId (number): TCAD owner ID; ownerPct (number): ownership percentage
- active, arbHearing (text): "Yes"/"No" flags (arbHearing = ARB protest)

Fields from dba onward are null for rows not re-scraped since 2026-08-08 — mention this caveat in "explanation" when filtering on them.

Generate a JSON response with these fields:
1. "whereClause": Prisma where clause as JSON (use "contains" for text searches — do NOT include "mode": "insensitive", use "gte"/"lte" for number ranges)
2. "orderBy": Prisma orderBy clause (optional)
3. "explanation": Brief explanation of what you're searching for
4. "answer": (REQUIRED for quantitative questions) Natural language answer template using {count} and {totalValue} placeholders
5. "answerType": One of "count", "statistical", or "descriptive"

Respond with ONLY valid JSON, no markdown fences.`;

/**
 * Remove "mode": "insensitive" from AI-generated where clauses.
 * D1/SQLite doesn't support Prisma's mode: "insensitive" option.
 * SQLite LIKE is case-insensitive for ASCII by default.
 */
export function sanitizeWhereClause(
	clause: Record<string, unknown>,
): Record<string, unknown> {
	const sanitized = { ...clause };
	for (const [key, value] of Object.entries(sanitized)) {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			const obj = value as Record<string, unknown>;
			if ("mode" in obj && obj.mode === "insensitive") {
				delete obj.mode;
			}
			sanitized[key] = sanitizeWhereClause(obj);
		}
		if (Array.isArray(value)) {
			sanitized[key] = value.map((item) =>
				typeof item === "object" && item !== null
					? sanitizeWhereClause(item as Record<string, unknown>)
					: item,
			);
		}
	}
	return sanitized;
}

export async function parseNaturalLanguageQuery(
	query: string,
	anthropicKey: string,
	openaiKey?: string,
): Promise<SearchFilters> {
	// Try Anthropic first
	try {
		return await callAnthropicAPI(query, anthropicKey);
	} catch (err) {
		const errorMessage = getErrorMessage(err);
		// If Anthropic fails with billing/quota error and OpenAI is available, try OpenAI
		if (openaiKey && shouldFallbackToOpenAI(err)) {
			console.warn(
				`Anthropic API failed (${errorMessage}), falling back to OpenAI`,
			);
			return await callOpenAIAPI(query, openaiKey);
		}
		// Otherwise rethrow the original error
		throw err;
	}
}

async function callAnthropicAPI(
	query: string,
	apiKey: string,
): Promise<SearchFilters> {
	const response = await fetch(ANTHROPIC_API_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify({
			model: CLAUDE_MODEL,
			max_tokens: MAX_TOKENS,
			messages: [
				{ role: "user", content: `${SYSTEM_PROMPT}\n\nUser query: "${query}"` },
			],
		}),
	});

	if (!response.ok) {
		const errText = await response.text();
		const error = new Error(`Claude API error ${response.status}: ${errText}`);
		(error as Error & { status?: number }).status = response.status;
		throw error;
	}

	const data = (await response.json()) as {
		content: Array<{ type: string; text: string }>;
	};

	const textBlock = data.content.find((b) => b.type === "text");
	if (!textBlock) {
		throw new Error("No text response from Claude");
	}

	try {
		const parsed = JSON.parse(textBlock.text);
		const validated = searchFiltersSchema.parse(parsed);
		return {
			whereClause: validated.whereClause || {},
			orderBy: validated.orderBy,
			explanation: validated.explanation || "Search results",
			answer: validated.answer,
			answerType: validated.answerType,
		} as SearchFilters;
	} catch (err) {
		throw new Error(`Failed to parse Claude response: ${getErrorMessage(err)}`);
	}
}

async function callOpenAIAPI(
	query: string,
	apiKey: string,
): Promise<SearchFilters> {
	const response = await fetch(OPENAI_API_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: GPT_MODEL,
			max_tokens: MAX_TOKENS,
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: `User query: "${query}"` },
			],
			temperature: 0,
		}),
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`OpenAI API error ${response.status}: ${errText}`);
	}

	const data = (await response.json()) as {
		choices: Array<{ message: { content: string } }>;
	};

	const textBlock = data.choices[0];
	if (!textBlock) {
		throw new Error("No text response from OpenAI");
	}

	try {
		const parsed = JSON.parse(textBlock.message.content);
		const validated = searchFiltersSchema.parse(parsed);
		return {
			whereClause: validated.whereClause || {},
			orderBy: validated.orderBy,
			explanation: validated.explanation || "Search results",
			answer: validated.answer,
			answerType: validated.answerType,
		} as SearchFilters;
	} catch (err) {
		throw new Error(`Failed to parse OpenAI response: ${getErrorMessage(err)}`);
	}
}

const FALLBACK_STATUSES: readonly number[] = [
	HttpStatus.UNAUTHORIZED,
	HttpStatus.PAYMENT_REQUIRED,
	HttpStatus.TOO_MANY_REQUESTS,
];

// Anthropic reports an exhausted credit balance as HTTP 400
// invalid_request_error ("Your credit balance is too low..."), not 402.
const CREDIT_BALANCE_ERROR = /credit balance/i;

export function shouldFallbackToOpenAI(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	// Fallback on 400 (credit balance exhausted), 401 (unauthorized),
	// 402 (payment required), 429 (rate limit)
	const status = (error as Error & { status?: number }).status;
	if (status === HttpStatus.BAD_REQUEST) {
		return CREDIT_BALANCE_ERROR.test(error.message);
	}
	if (status !== undefined) return FALLBACK_STATUSES.includes(status);
	return /error (401|402|429)/.test(error.message.toLowerCase());
}
