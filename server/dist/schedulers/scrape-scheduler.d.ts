declare class ScheduledJobs {
    private tasks;
    initialize(): void;
    private runScheduledScrapes;
    private cleanupOldJobs;
    stop(): void;
    triggerDailyScrapes(): Promise<void>;
}
export declare const scheduledJobs: ScheduledJobs;
export {};
//# sourceMappingURL=scrape-scheduler.d.ts.map