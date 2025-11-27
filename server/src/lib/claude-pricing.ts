/**
 * Claude API Pricing Calculator
 * Pricing as of November 2024
 * Source: https://www.anthropic.com/pricing
 */

export interface ClaudePricing {
  inputCostPer1M: number; // Cost per 1M input tokens in USD
  outputCostPer1M: number; // Cost per 1M output tokens in USD
}

// Pricing for different Claude models (as of November 2024)
export const CLAUDE_PRICING: Record<string, ClaudePricing> = {
  'claude-3-5-sonnet-20241022': {
    inputCostPer1M: 3.0,    // $3 per 1M input tokens
    outputCostPer1M: 15.0,  // $15 per 1M output tokens
  },
  'claude-3-5-haiku-20241022': {
    inputCostPer1M: 0.8,    // $0.80 per 1M input tokens
    outputCostPer1M: 4.0,   // $4 per 1M output tokens
  },
  'claude-3-opus-20240229': {
    inputCostPer1M: 15.0,   // $15 per 1M input tokens
    outputCostPer1M: 75.0,  // $75 per 1M output tokens
  },
  'claude-3-sonnet-20240229': {
    inputCostPer1M: 3.0,    // $3 per 1M input tokens
    outputCostPer1M: 15.0,  // $15 per 1M output tokens
  },
  'claude-3-haiku-20240307': {
    inputCostPer1M: 0.25,   // $0.25 per 1M input tokens
    outputCostPer1M: 1.25,  // $1.25 per 1M output tokens
  },
};

/**
 * Calculate the cost of a Claude API call
 * @param model - The Claude model identifier
 * @param inputTokens - Number of input tokens used
 * @param outputTokens - Number of output tokens generated
 * @returns Cost in USD
 */
export function calculateClaudeCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = CLAUDE_PRICING[model];

  if (!pricing) {
    // Default to Sonnet pricing if model not found
    const defaultPricing = CLAUDE_PRICING['claude-3-5-sonnet-20241022'];
    const inputCost = (inputTokens / 1_000_000) * defaultPricing.inputCostPer1M;
    const outputCost = (outputTokens / 1_000_000) * defaultPricing.outputCostPer1M;
    return inputCost + outputCost;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPer1M;

  return inputCost + outputCost;
}

/**
 * Format cost as USD string
 * @param cost - Cost in USD
 * @returns Formatted string like "$0.0045"
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(6)}`;
}

/**
 * Get the display name for a model
 * @param model - The Claude model identifier
 * @returns Human-readable model name
 */
export function getModelDisplayName(model: string): string {
  const modelNames: Record<string, string> = {
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
    'claude-3-opus-20240229': 'Claude 3 Opus',
    'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
    'claude-3-haiku-20240307': 'Claude 3 Haiku',
  };

  return modelNames[model] || model;
}
