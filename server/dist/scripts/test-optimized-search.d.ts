declare class SearchPatternGenerator {
    private usedTerms;
    private firstNames;
    private lastNames;
    private streetNames;
    private propertyTypes;
    private businessSuffixes;
    private neighborhoods;
    private propertyDescriptors;
    getNextBatch(batchSize: number): string[];
    private generateFullName;
    private generateLastNameOnly;
    private generateStreetAddress;
    private generateBusinessName;
    private generateNeighborhood;
    private generateCompoundName;
    private generateStreetNumber;
}
declare const generator: SearchPatternGenerator;
declare const batch: string[];
//# sourceMappingURL=test-optimized-search.d.ts.map