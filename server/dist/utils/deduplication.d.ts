interface DeduplicationOptions {
    verbose?: boolean;
    showProgress?: boolean;
}
export declare function removeDuplicatesFromQueue(options?: DeduplicationOptions): Promise<{
    removed: number;
    failed: number;
}>;
export {};
//# sourceMappingURL=deduplication.d.ts.map