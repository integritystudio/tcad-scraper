export interface Property {
  id: string;
  property_id: string;
  name: string;
  prop_type: string;
  city: string | null;
  property_address: string;
  assessed_value: number | null;  // Can be null per Prisma schema
  appraised_value: number;
  geo_id: string | null;
  description: string | null;
  search_term: string | null;
  scraped_at: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Natural Language Answer Types
// ============================================================================

/**
 * Type of answer generated for quantitative queries
 */
export type AnswerType = 'count' | 'statistical' | 'descriptive';

/**
 * Statistics for property search results
 * Used when answering quantitative questions
 */
export interface AnswerStatistics {
  avgValue?: number;
  totalValue?: number;
  priceRange?: {
    min: number;
    max: number;
  };
  topCity?: {
    name: string;
    count: number;
  };
  propertyTypes?: Array<{
    type: string;
    count: number;
  }>;
}

/**
 * State type for AnswerBox component
 */
export type AnswerBoxState = 'idle' | 'loading' | 'success' | 'error' | 'no-results' | 'partial';

/**
 * Props for the AnswerBox component
 */
export interface AnswerBoxProps {
  answer: string;
  totalResults: number;
  statistics?: AnswerStatistics;
  searchQuery: string;
  state: AnswerBoxState;
  error?: string;
  answerType?: AnswerType;
}
