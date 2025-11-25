import { describe, test, expect, beforeEach } from 'vitest';
import { SearchTermDeduplicator } from '../search-term-deduplicator';

describe('SearchTermDeduplicator', () => {
  let deduplicator: SearchTermDeduplicator;

  beforeEach(() => {
    deduplicator = new SearchTermDeduplicator();
  });

  describe('Exact Duplicates', () => {
    test('should skip exact duplicates', () => {
      deduplicator.markTermAsUsed('Smith');
      expect(deduplicator.shouldSkipTerm('Smith')).toBe(true);
      expect(deduplicator.getStats().exactDuplicates).toBe(1);
    });

    test('should not skip new unique terms', () => {
      deduplicator.markTermAsUsed('Smith');
      expect(deduplicator.shouldSkipTerm('Jones')).toBe(false);
    });
  });

  describe('Business Entity Supersets', () => {
    test('should skip "Name LLC" when "Name" exists', () => {
      deduplicator.markTermAsUsed('Smith');
      expect(deduplicator.shouldSkipTerm('Smith LLC')).toBe(true);
      expect(deduplicator.getStats().businessSupersets).toBe(1);
    });

    test('should skip various business suffixes', () => {
      deduplicator.markTermAsUsed('Johnson');

      expect(deduplicator.shouldSkipTerm('Johnson Inc')).toBe(true);
      expect(deduplicator.shouldSkipTerm('Johnson Corp')).toBe(true);
      expect(deduplicator.shouldSkipTerm('Johnson Trust')).toBe(true);
      expect(deduplicator.shouldSkipTerm('Johnson Properties')).toBe(true);

      expect(deduplicator.getStats().businessSupersets).toBe(4);
    });

    test('should NOT skip business entity if base name does not exist', () => {
      expect(deduplicator.shouldSkipTerm('NewCompany LLC')).toBe(false);
    });

    test('should NOT skip single word terms', () => {
      deduplicator.markTermAsUsed('Trust');
      expect(deduplicator.shouldSkipTerm('Smith')).toBe(false);
    });
  });

  describe('Two-Word Supersets', () => {
    test('should skip "Oak Street" when both "Oak" and "Street" exist', () => {
      deduplicator.markTermAsUsed('Oak');
      deduplicator.markTermAsUsed('Street');

      expect(deduplicator.shouldSkipTerm('Oak Street')).toBe(true);
      expect(deduplicator.getStats().twoWordSupersets).toBe(1);
    });

    test('should NOT skip "Oak Street" if only "Oak" exists', () => {
      deduplicator.markTermAsUsed('Oak');
      expect(deduplicator.shouldSkipTerm('Oak Street')).toBe(false);
    });

    test('should NOT skip "Oak Street" if only "Street" exists', () => {
      deduplicator.markTermAsUsed('Street');
      expect(deduplicator.shouldSkipTerm('Oak Street')).toBe(false);
    });

    test('should allow if neither word exists', () => {
      expect(deduplicator.shouldSkipTerm('Pine Avenue')).toBe(false);
    });
  });

  describe('Multi-Word Supersets', () => {
    test('should skip when all 3 words exist', () => {
      deduplicator.markTermAsUsed('Oak');
      deduplicator.markTermAsUsed('Hill');
      deduplicator.markTermAsUsed('Drive');

      expect(deduplicator.shouldSkipTerm('Oak Hill Drive')).toBe(true);
      expect(deduplicator.getStats().multiWordSupersets).toBe(1);
    });

    test('should NOT skip if any word is missing', () => {
      deduplicator.markTermAsUsed('Oak');
      deduplicator.markTermAsUsed('Hill');
      // Missing "Drive"

      expect(deduplicator.shouldSkipTerm('Oak Hill Drive')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should skip terms shorter than 4 characters', () => {
      expect(deduplicator.shouldSkipTerm('Oak')).toBe(true);
      expect(deduplicator.shouldSkipTerm('AB')).toBe(true);
      expect(deduplicator.shouldSkipTerm('A')).toBe(true);
    });

    test('should skip empty or null terms', () => {
      expect(deduplicator.shouldSkipTerm('')).toBe(true);
      expect(deduplicator.shouldSkipTerm('   ')).toBe(true);
    });

    test('should handle case sensitivity correctly', () => {
      deduplicator.markTermAsUsed('Smith');
      // Assuming case-sensitive matching
      expect(deduplicator.shouldSkipTerm('smith')).toBe(false);
    });
  });

  describe('Statistics Tracking', () => {
    test('should track multiple types of skips', () => {
      deduplicator.markTermAsUsed('Smith');
      deduplicator.markTermAsUsed('Oak');
      deduplicator.markTermAsUsed('Street');

      deduplicator.shouldSkipTerm('Smith'); // exact duplicate
      deduplicator.shouldSkipTerm('Smith LLC'); // business superset
      deduplicator.shouldSkipTerm('Oak Street'); // two-word superset

      const stats = deduplicator.getStats();
      expect(stats.exactDuplicates).toBe(1);
      expect(stats.businessSupersets).toBe(1);
      expect(stats.twoWordSupersets).toBe(1);
      expect(deduplicator.getTotalSkipped()).toBe(3);
    });

    test('should reset statistics', () => {
      deduplicator.markTermAsUsed('Smith');
      deduplicator.shouldSkipTerm('Smith');

      expect(deduplicator.getTotalSkipped()).toBe(1);

      deduplicator.resetStats();
      expect(deduplicator.getTotalSkipped()).toBe(0);
    });
  });

  describe('Utility Methods', () => {
    test('should track used terms count', () => {
      expect(deduplicator.getUsedTermsCount()).toBe(0);

      deduplicator.markTermAsUsed('Smith');
      deduplicator.markTermAsUsed('Jones');

      expect(deduplicator.getUsedTermsCount()).toBe(2);
    });

    test('should return used terms array', () => {
      deduplicator.markTermAsUsed('Smith');
      deduplicator.markTermAsUsed('Jones');

      const terms = deduplicator.getUsedTerms();
      expect(terms).toContain('Smith');
      expect(terms).toContain('Jones');
      expect(terms.length).toBe(2);
    });
  });

  describe('Integration with Existing Terms', () => {
    test('should initialize with existing terms', () => {
      const existingTerms = new Set(['Smith', 'Jones', 'Williams']);
      const dedup = new SearchTermDeduplicator(existingTerms);

      expect(dedup.shouldSkipTerm('Smith')).toBe(true);
      expect(dedup.shouldSkipTerm('Smith LLC')).toBe(true);
      expect(dedup.shouldSkipTerm('Brown')).toBe(false);
    });
  });
});
