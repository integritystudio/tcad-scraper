import { z } from 'zod';
export declare const scrapeRequestSchema: z.ZodObject<{
    searchTerm: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    searchTerm: string;
    userId?: string | undefined;
}, {
    searchTerm: string;
    userId?: string | undefined;
}>;
export declare const propertyFilterSchema: z.ZodObject<{
    searchTerm: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    propType: z.ZodOptional<z.ZodString>;
    minValue: z.ZodOptional<z.ZodNumber>;
    maxValue: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    propType?: string | undefined;
    city?: string | undefined;
    searchTerm?: string | undefined;
    minValue?: number | undefined;
    maxValue?: number | undefined;
}, {
    propType?: string | undefined;
    city?: string | undefined;
    searchTerm?: string | undefined;
    minValue?: number | undefined;
    maxValue?: number | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const naturalLanguageSearchSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    offset?: number | undefined;
}, {
    query: string;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const historyQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
}, {
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const monitorRequestSchema: z.ZodObject<{
    searchTerm: z.ZodString;
    frequency: z.ZodDefault<z.ZodEnum<["hourly", "daily", "weekly"]>>;
}, "strip", z.ZodTypeAny, {
    searchTerm: string;
    frequency: "hourly" | "daily" | "weekly";
}, {
    searchTerm: string;
    frequency?: "hourly" | "daily" | "weekly" | undefined;
}>;
export type ScrapeRequestBody = z.infer<typeof scrapeRequestSchema>;
export type PropertyFilters = z.infer<typeof propertyFilterSchema>;
export type NaturalLanguageSearchBody = z.infer<typeof naturalLanguageSearchSchema>;
export type HistoryQueryParams = z.infer<typeof historyQuerySchema>;
export type MonitorRequestBody = z.infer<typeof monitorRequestSchema>;
export interface PaginationMeta {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMeta;
}
export interface JobStatusResponse {
    id: string;
    status: string;
    progress: number;
    resultCount?: number;
    error?: string | null;
    createdAt: Date;
    completedAt: Date | null;
}
export interface StatsResponse {
    totalProperties: number;
    totalJobs: number;
    recentJobs: number;
    cityDistribution: Array<{
        city: string;
        _count: number;
    }>;
    propertyTypeDistribution: Array<{
        propType: string;
        _count: number;
        _avg: {
            appraisedValue: number | null;
        };
    }>;
}
//# sourceMappingURL=property.types.d.ts.map