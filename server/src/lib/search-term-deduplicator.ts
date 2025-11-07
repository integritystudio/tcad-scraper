/**
 * Search Term Deduplicator
 *
 * Smart containment checking to avoid redundant search terms while allowing
 * useful variations that might yield unique results.
 */

export interface DeduplicationStats {
  exactDuplicates: number;
  businessSupersets: number;
  twoWordSupersets: number;
  multiWordSupersets: number;
  tooCommonTerms: number;
}

export class SearchTermDeduplicator {
  private usedTerms: Set<string>;
  private stats: DeduplicationStats;

  // Known terms that are too common and cause TCAD API timeouts (HTTP 504)
  // These terms likely have 20,000+ properties which exceeds TCAD's result limits
  private static readonly TOO_COMMON_TERMS = new Set([
    'Street', 'Drive', 'Lane', 'Road', 'Way', 'Court', 'Place', 'Circle',
    'Avenue', 'Boulevard', // These work but are at the edge
  ]);

  constructor(usedTerms: Set<string> = new Set()) {
    this.usedTerms = usedTerms;
    this.stats = {
      exactDuplicates: 0,
      businessSupersets: 0,
      twoWordSupersets: 0,
      multiWordSupersets: 0,
      tooCommonTerms: 0,
    };
  }

  /**
   * Check if a search term should be skipped based on duplication rules
   * @param term - The search term to check
   * @returns true if the term should be skipped, false if it's unique enough
   */
  public shouldSkipTerm(term: string): boolean {
    if (!term || term.length < 4) {
      return true; // Skip invalid/too-short terms
    }

    // Check if term is too common (causes TCAD API timeouts)
    if (this.isTooCommon(term)) {
      this.stats.tooCommonTerms++;
      return true;
    }

    // Check exact duplicate
    if (this.isExactDuplicate(term)) {
      this.stats.exactDuplicates++;
      return true;
    }

    // Check business entity superset (e.g., "Smith LLC" when "Smith" exists)
    if (this.isBusinessSuperset(term)) {
      this.stats.businessSupersets++;
      return true;
    }

    // Check two-word superset (e.g., "Oak Street" when both "Oak" and "Street" exist)
    if (this.isTwoWordSuperset(term)) {
      this.stats.twoWordSupersets++;
      return true;
    }

    // Check multi-word superset (e.g., "Oak Hill Street" when all three words exist)
    if (this.isMultiWordSuperset(term)) {
      this.stats.multiWordSupersets++;
      return true;
    }

    return false;
  }

  /**
   * Mark a term as used (adds to the set of known terms)
   */
  public markTermAsUsed(term: string): void {
    this.usedTerms.add(term);
  }

  /**
   * Get current deduplication statistics
   */
  public getStats(): DeduplicationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics counters
   */
  public resetStats(): void {
    this.stats = {
      exactDuplicates: 0,
      businessSupersets: 0,
      twoWordSupersets: 0,
      multiWordSupersets: 0,
      tooCommonTerms: 0,
    };
  }

  /**
   * Get total number of skipped terms
   */
  public getTotalSkipped(): number {
    return (
      this.stats.exactDuplicates +
      this.stats.businessSupersets +
      this.stats.twoWordSupersets +
      this.stats.multiWordSupersets +
      this.stats.tooCommonTerms
    );
  }

  // Private helper methods

  private isTooCommon(term: string): boolean {
    // Check if term is in the known too-common list
    // These terms cause HTTP 504 timeouts from TCAD API because they return 20,000+ results
    return SearchTermDeduplicator.TOO_COMMON_TERMS.has(term);
  }

  private isExactDuplicate(term: string): boolean {
    return this.usedTerms.has(term);
  }

  private isBusinessSuperset(term: string): boolean {
    const words = term.split(/\s+/);

    // Only check two-word combinations
    if (words.length !== 2) {
      return false;
    }

    const [base, suffix] = words;
    const businessSuffixes = /^(LLC|Inc|LTD|Ltd|Corp|Company|Partner|Partners|Assoc|Associates|Holding|Holdings|Properties|Property|Real|Develop|Development|Trust|Trusts|Estate|Estates)$/i;

    // Skip if it's a business suffix added to an existing term
    // Example: Skip "Smith LLC" if "Smith" already exists
    return businessSuffixes.test(suffix) && this.usedTerms.has(base);
  }

  private isTwoWordSuperset(term: string): boolean {
    const words = term.split(/\s+/);

    // Only check two-word combinations
    if (words.length !== 2) {
      return false;
    }

    // Skip if BOTH words already exist individually
    // Example: Skip "Oak Street" when we have both "Oak" and "Street"
    // This prevents redundant searches that would just find a subset of existing results
    return this.usedTerms.has(words[0]) && this.usedTerms.has(words[1]);
  }

  private isMultiWordSuperset(term: string): boolean {
    const words = term.split(/\s+/);

    // Only check 3+ word combinations
    if (words.length < 3) {
      return false;
    }

    // Skip if ALL words already exist individually
    // Example: Skip "Oak Hill Street" when we have "Oak", "Hill", and "Street"
    return words.every((word) => this.usedTerms.has(word));
  }

  /**
   * Get all used terms (useful for debugging or reporting)
   */
  public getUsedTerms(): string[] {
    return Array.from(this.usedTerms);
  }

  /**
   * Get count of unique terms tracked
   */
  public getUsedTermsCount(): number {
    return this.usedTerms.size;
  }
}
