/**
 * TCAD Token Refresh Service
 *
 * Automatically refreshes the TCAD API token by:
 * 1. Launching a headless browser
 * 2. Navigating to TCAD property search
 * 3. Performing a test search to trigger API call
 * 4. Capturing the Authorization header
 * 5. Updating the in-memory token
 *
 * Runs on a configurable schedule (default: every 4-5 minutes)
 */
export declare class TCADTokenRefreshService {
    private currentToken;
    private browser;
    private refreshInterval;
    private cronJob;
    private isRefreshing;
    private lastRefreshTime;
    private refreshCount;
    private failureCount;
    constructor();
    /**
     * Get the current valid token
     */
    getCurrentToken(): string | null;
    /**
     * Get refresh statistics
     */
    getStats(): {
        currentToken: string | null;
        lastRefreshTime: Date | null;
        refreshCount: number;
        failureCount: number;
        isRefreshing: boolean;
        isRunning: boolean;
    };
    /**
     * Refresh the token by capturing from browser
     */
    refreshToken(): Promise<string | null>;
    /**
     * Start automatic token refresh using cron schedule
     * Default: Every 4-5 minutes (randomized to avoid detection patterns)
     */
    startAutoRefresh(cronSchedule?: string): void;
    /**
     * Start automatic token refresh using interval (alternative to cron)
     * @param intervalMs Interval in milliseconds (default: 4.5 minutes)
     */
    startAutoRefreshInterval(intervalMs?: number): void;
    /**
     * Stop automatic token refresh
     */
    stopAutoRefresh(): void;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * Get health status
     */
    getHealth(): {
        healthy: boolean;
        hasToken: boolean;
        lastRefresh: Date | null;
        timeSinceLastRefresh: number | null;
        refreshCount: number;
        failureCount: number;
        failureRate: string;
        isRefreshing: boolean;
        isAutoRefreshRunning: boolean;
    };
}
export declare const tokenRefreshService: TCADTokenRefreshService;
//# sourceMappingURL=token-refresh.service.d.ts.map