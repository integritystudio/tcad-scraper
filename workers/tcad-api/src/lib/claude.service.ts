/**
 * Claude AI natural language search — Workers-compatible.
 * Ported from server/src/lib/claude.service.ts.
 * Key changes: no module-level Anthropic client, API key passed as argument,
 * uses fetch directly instead of Anthropic SDK (lighter for Workers bundle).
 */

import type { Prisma } from "@prisma/client";
import type { AnswerType } from "../types/property.types";
import { getErrorMessage } from "../utils/error-helpers";

interface SearchFilters {
  whereClause: Prisma.PropertyWhereInput;
  orderBy?: Prisma.PropertyOrderByWithRelationInput;
  explanation: string;
  answer?: string;
  answerType?: AnswerType;
}

const CLAUDE_MODEL = "claude-3-haiku-20240307";
const MAX_TOKENS = 1024;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

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

Generate a JSON response with these fields:
1. "whereClause": Prisma where clause as JSON (use "contains" for text searches with "mode": "insensitive", "gte"/"lte" for number ranges)
2. "orderBy": Prisma orderBy clause (optional)
3. "explanation": Brief explanation of what you're searching for
4. "answer": (REQUIRED for quantitative questions) Natural language answer template using {count} and {totalValue} placeholders
5. "answerType": One of "count", "statistical", or "descriptive"

Respond with ONLY valid JSON, no markdown fences.`;

export async function parseNaturalLanguageQuery(
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
      messages: [{ role: "user", content: `${SYSTEM_PROMPT}\n\nUser query: "${query}"` }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const textBlock = data.content.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("No text response from Claude");
  }

  try {
    const parsed = JSON.parse(textBlock.text) as SearchFilters;
    return {
      whereClause: parsed.whereClause || {},
      orderBy: parsed.orderBy,
      explanation: parsed.explanation || "Search results",
      answer: parsed.answer,
      answerType: parsed.answerType,
    };
  } catch (err) {
    throw new Error(`Failed to parse Claude response: ${getErrorMessage(err)}`);
  }
}
