import { Prisma } from '@prisma/client';
interface SearchFilters {
    whereClause: Prisma.PropertyWhereInput;
    orderBy?: Prisma.PropertyOrderByWithRelationInput;
    explanation: string;
}
export declare class ClaudeSearchService {
    parseNaturalLanguageQuery(query: string): Promise<SearchFilters>;
}
export declare const claudeSearchService: ClaudeSearchService;
export {};
//# sourceMappingURL=claude.service.d.ts.map