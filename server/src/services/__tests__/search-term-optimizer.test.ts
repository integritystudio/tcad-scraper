import { OPTIMIZED_4_CHAR_STARTER_TERMS } from '../search-term-optimizer';

describe('Search Term Optimizer', () => {
  describe('OPTIMIZED_4_CHAR_STARTER_TERMS', () => {
    it('should export an array of search terms', () => {
      expect(Array.isArray(OPTIMIZED_4_CHAR_STARTER_TERMS)).toBe(true);
      expect(OPTIMIZED_4_CHAR_STARTER_TERMS.length).toBeGreaterThan(0);
    });

    it('should contain only string values', () => {
      OPTIMIZED_4_CHAR_STARTER_TERMS.forEach(term => {
        expect(typeof term).toBe('string');
      });
    });

    it('should contain terms with length of at least 4 characters', () => {
      OPTIMIZED_4_CHAR_STARTER_TERMS.forEach(term => {
        expect(term.length).toBeGreaterThanOrEqual(4);
      });
    });

    it('should not contain empty strings', () => {
      OPTIMIZED_4_CHAR_STARTER_TERMS.forEach(term => {
        expect(term.trim()).not.toBe('');
      });
    });

    it('should contain common entity terms', () => {
      const entityTerms = ['Trus', 'LLC.', 'Corp', 'Part'];
      entityTerms.forEach(term => {
        expect(OPTIMIZED_4_CHAR_STARTER_TERMS).toContain(term);
      });
    });

    it('should contain real estate related terms', () => {
      const realEstateTerms = ['Real', 'Prop', 'Home'];
      realEstateTerms.forEach(term => {
        expect(OPTIMIZED_4_CHAR_STARTER_TERMS).toContain(term);
      });
    });
  });
});
