"use strict";
// Quick test to show the optimized search term generation
class SearchPatternGenerator {
    usedTerms = new Set();
    firstNames = ['James', 'Mary', 'John', 'Robert', 'Michael', 'William'];
    lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'];
    streetNames = ['Main', 'Oak', 'Lamar', 'Congress', 'Guadalupe', 'Burnet'];
    propertyTypes = ['Apartments', 'Condos', 'Townhomes', 'Office', 'Retail'];
    businessSuffixes = ['LLC', 'Inc', 'Corp', 'Trust', 'Properties'];
    neighborhoods = ['Hyde Park', 'Mueller', 'East Austin', 'Travis Heights'];
    propertyDescriptors = ['Home', 'House', 'Property', 'Land'];
    getNextBatch(batchSize) {
        const batch = [];
        const strategies = [
            { fn: () => this.generateFullName(), weight: 20 },
            { fn: () => this.generateLastNameOnly(), weight: 15 },
            { fn: () => this.generateStreetAddress(), weight: 18 },
            { fn: () => this.generateBusinessName(), weight: 12 },
            { fn: () => this.generateNeighborhood(), weight: 7 },
            { fn: () => this.generateCompoundName(), weight: 10 },
            { fn: () => this.generateStreetNumber(), weight: 12 },
        ];
        const weightedStrategies = [];
        strategies.forEach(s => {
            for (let i = 0; i < s.weight; i++) {
                weightedStrategies.push(s.fn);
            }
        });
        let attempts = 0;
        const maxAttempts = batchSize * 10;
        while (batch.length < batchSize && attempts < maxAttempts) {
            attempts++;
            const strategy = weightedStrategies[Math.floor(Math.random() * weightedStrategies.length)];
            const term = strategy();
            if (term && term.length >= 4 && !this.usedTerms.has(term)) {
                this.usedTerms.add(term);
                batch.push(term);
            }
        }
        return batch;
    }
    generateFullName() {
        const first = this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
        const last = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
        return `${first} ${last}`;
    }
    generateLastNameOnly() {
        return this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    }
    generateStreetAddress() {
        const number = Math.floor(Math.random() * 9999) + 1;
        const street = this.streetNames[Math.floor(Math.random() * this.streetNames.length)];
        return `${number} ${street}`;
    }
    generateBusinessName() {
        const name = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
        const suffix = this.businessSuffixes[Math.floor(Math.random() * this.businessSuffixes.length)];
        return `${name} ${suffix}`;
    }
    generateNeighborhood() {
        return this.neighborhoods[Math.floor(Math.random() * this.neighborhoods.length)];
    }
    generateCompoundName() {
        const last1 = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
        const last2 = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
        const patterns = [
            `${last1} & ${last2}`,
            `${last1} Family`,
            `${last1} Estate`,
            `${last1} Trust`,
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
    }
    generateStreetNumber() {
        return (Math.floor(Math.random() * 9999) + 1).toString();
    }
}
console.log('🎯 Optimized Search Term Generation Test\n');
const generator = new SearchPatternGenerator();
const batch = generator.getNextBatch(20);
console.log(`Generated ${batch.length} diverse search terms:\n`);
batch.forEach((term, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${term}`);
});
console.log('\n✅ Key Improvements:');
console.log('  • Weighted strategies favor high-yield patterns');
console.log('  • Street addresses get 18% of searches (very high yield)');
console.log('  • Full names get 20% (high yield)');
console.log('  • Added compound names (Trusts, Families, Estates)');
console.log('  • Added neighborhood searches');
console.log('  • Added street number-only searches');
console.log('  • Expanded street names, property types, and business suffixes');
//# sourceMappingURL=test-optimized-search.js.map