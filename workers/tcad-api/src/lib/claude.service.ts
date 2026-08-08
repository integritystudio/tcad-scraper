/**
 * Claude AI natural language search — Workers-compatible.
 * Ported from server/src/lib/claude.service.ts.
 * Key changes: no module-level Anthropic client, API key passed as argument,
 * uses fetch directly instead of Anthropic SDK (lighter for Workers bundle).
 * Supports fallback to Grok (xAI) when the Anthropic balance is unavailable.
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
// Pinned to a dated snapshot, matching CLAUDE_MODEL above. Must be a real id
// from GET /v1/models: xAI silently serves a *substitute* for an unknown name
// rather than erroring (a request for the nonexistent "grok-3" came back
// served_as "grok-4.3"), so a typo here degrades quietly instead of failing.
// Non-reasoning is deliberate — reasoning variants spend MAX_TOKENS on
// reasoning_content before emitting the JSON this prompt requires. Measured
// against the real SYSTEM_PROMPT: 1.4s here vs 6.7s for grok-4.3, and
// grok-4.5 returned assessedValue where appraisedValue was asked for.
const GROK_MODEL = "grok-4.20-0309-non-reasoning";
const MAX_TOKENS = 1024;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// xAI exposes an OpenAI-compatible chat-completions surface, so the request
// and response shapes below are unchanged from the previous OpenAI fallback.
const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

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

/** Which upstream actually answered — the primary or the fallback. */
export type AiProvider = "anthropic" | "grok";

/** Human-readable provider names, for diagnostics that report the source. */
export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
	anthropic: "Anthropic (Claude)",
	grok: "xAI (Grok)",
};

interface ProviderResult {
	filters: SearchFilters;
	/**
	 * Model the provider reports having served. This can differ from the model
	 * requested: xAI substitutes silently for an unknown name rather than
	 * erroring, so reporting the served value is what makes that visible.
	 */
	model?: string;
}

export interface ParsedQuery extends ProviderResult {
	provider: AiProvider;
}

export async function parseNaturalLanguageQuery(
	query: string,
	anthropicKey: string,
	grokKey?: string,
): Promise<ParsedQuery> {
	// Try Anthropic first
	try {
		return {
			...(await callAnthropicAPI(query, anthropicKey)),
			provider: "anthropic",
		};
	} catch (err) {
		const errorMessage = getErrorMessage(err);
		// If Anthropic fails with a billing/quota error and Grok is available, try Grok
		if (grokKey && shouldFallbackToGrok(err)) {
			console.warn(
				`Anthropic API failed (${errorMessage}), falling back to Grok`,
			);
			return { ...(await callGrokAPI(query, grokKey)), provider: "grok" };
		}
		// Otherwise rethrow the original error
		throw err;
	}
}

async function callAnthropicAPI(
	query: string,
	apiKey: string,
): Promise<ProviderResult> {
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
		model?: string;
	};

	const textBlock = data.content.find((b) => b.type === "text");
	if (!textBlock) {
		throw new Error("No text response from Claude");
	}

	try {
		const parsed = JSON.parse(textBlock.text);
		const validated = searchFiltersSchema.parse(parsed);
		return {
			filters: {
				whereClause: validated.whereClause || {},
				orderBy: validated.orderBy,
				explanation: validated.explanation || "Search results",
				answer: validated.answer,
				answerType: validated.answerType,
			} as SearchFilters,
			model: data.model,
		};
	} catch (err) {
		throw new Error(`Failed to parse Claude response: ${getErrorMessage(err)}`);
	}
}

async function callGrokAPI(
	query: string,
	apiKey: string,
): Promise<ProviderResult> {
	const response = await fetch(XAI_API_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: GROK_MODEL,
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
		throw new Error(`xAI API error ${response.status}: ${errText}`);
	}

	const data = (await response.json()) as {
		choices: Array<{ message: { content: string } }>;
		model?: string;
	};

	const textBlock = data.choices[0];
	if (!textBlock) {
		throw new Error("No text response from Grok");
	}

	try {
		const parsed = JSON.parse(textBlock.message.content);
		const validated = searchFiltersSchema.parse(parsed);
		return {
			filters: {
				whereClause: validated.whereClause || {},
				orderBy: validated.orderBy,
				explanation: validated.explanation || "Search results",
				answer: validated.answer,
				answerType: validated.answerType,
			} as SearchFilters,
			model: data.model,
		};
	} catch (err) {
		throw new Error(`Failed to parse Grok response: ${getErrorMessage(err)}`);
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

export function shouldFallbackToGrok(error: unknown): boolean {
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
