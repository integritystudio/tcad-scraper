import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import logger from './logger';
import { config } from '../config';
import { prisma } from './prisma';
import { calculateClaudeCost } from './claude-pricing';

const anthropic = new Anthropic({
  apiKey: config.claude.apiKey,
});

interface SearchFilters {
  whereClause: Prisma.PropertyWhereInput;
  orderBy?: Prisma.PropertyOrderByWithRelationInput;
  explanation: string;
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
    errorMessage?: string
  ): Promise<void> {
    try {
      const queryCost = calculateClaudeCost(model, inputTokens, outputTokens);
      const environment = config.env.nodeEnv || 'development';

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
        `Claude API usage logged: ${inputTokens} input + ${outputTokens} output tokens, cost: $${queryCost.toFixed(6)}, success: ${success}`
      );
    } catch (error) {
      // Don't fail the main request if logging fails
      const errorMsg = error instanceof Error ? error.message : String(error);
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
            role: 'user',
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

Examples:

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

Now generate the JSON for the user's query above.`,
          },
        ],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      logger.info(`Claude response: ${responseText.substring(0, 200)}...`);

      // Extract token usage from the response
      inputTokens = message.usage.input_tokens;
      outputTokens = message.usage.output_tokens;

      // Validate and parse the JSON response
      let cleanedResponse = responseText.trim();

      // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json...```)
      if (cleanedResponse.startsWith('```')) {
        const match = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          cleanedResponse = match[1].trim();
          logger.info('Stripped markdown code block from response');
        }
      }

      // Validate response starts with { or [ (valid JSON)
      if (!cleanedResponse.startsWith('{') && !cleanedResponse.startsWith('[')) {
        throw new Error(
          `Invalid JSON response from Claude: Response starts with "${cleanedResponse.substring(0, 50)}..."`
        );
      }

      // Parse with error handling
      let parsed: Partial<SearchFilters>;
      try {
        parsed = JSON.parse(cleanedResponse) as Partial<SearchFilters>;
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        logger.error(`JSON parse failed: ${errorMsg}`);
        logger.error(`Failed to parse response: ${cleanedResponse.substring(0, 500)}`);
        throw new Error(`Failed to parse Claude response as JSON: ${errorMsg}`);
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
        responseTime
      );

      return {
        whereClause: parsed.whereClause || {},
        orderBy: parsed.orderBy,
        explanation: parsed.explanation || 'Searching properties based on your query',
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      errorMessage = error instanceof Error ? error.message : String(error);
      // Safely log the error without risking serialization issues
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      };
      logger.error(`Error parsing natural language query with Claude: ${JSON.stringify(errorDetails)}`);
      logger.error(`Claude API Error Details: ${JSON.stringify(errorDetails, null, 2)}`);

      // Log failed API usage (even if we don't have token counts)
      await this.logApiUsage(
        query,
        inputTokens,
        outputTokens,
        config.claude.model,
        false, // success = false
        responseTime,
        errorMessage
      );

      // Fallback: simple text search across multiple fields
      return {
        whereClause: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { propertyAddress: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        explanation: `Searching for "${query}" across property names, addresses, cities, and descriptions`,
      };
    }
  }
}

export const claudeSearchService = new ClaudeSearchService();
