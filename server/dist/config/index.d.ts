/**
 * Centralized Configuration Module
 *
 * Single source of truth for all application configuration.
 * All environment variables and settings are defined here.
 *
 * Usage:
 *   import { config } from './config';
 *   const port = config.server.port;
 */
/**
 * Application Configuration
 */
export declare const config: {
    readonly env: {
        readonly nodeEnv: string;
        readonly isDevelopment: boolean;
        readonly isProduction: boolean;
        readonly isTest: boolean;
    };
    readonly doppler: {
        readonly project: string | undefined;
        readonly config: string | undefined;
        readonly enabled: boolean;
    };
    readonly server: {
        readonly port: number;
        readonly host: string;
        readonly logLevel: string | undefined;
        readonly gracefulShutdownTimeout: number;
    };
    readonly database: {
        readonly url: string;
        readonly readOnlyUrl: string | undefined;
        readonly connectionTimeout: number;
        readonly poolSize: number;
    };
    readonly redis: {
        readonly host: string;
        readonly port: number;
        readonly password: string | undefined;
        readonly db: number;
        readonly connectionTimeout: number;
    };
    readonly queue: {
        readonly name: "scraper-queue";
        readonly jobName: "scrape-properties";
        readonly concurrency: number;
        readonly defaultJobOptions: {
            readonly attempts: number;
            readonly backoffDelay: number;
            readonly removeOnComplete: number;
            readonly removeOnFail: number;
        };
        readonly cleanupInterval: number;
        readonly cleanupGracePeriod: number;
        readonly dashboard: {
            readonly basePath: string;
            readonly enabled: boolean;
        };
    };
    readonly rateLimit: {
        readonly api: {
            readonly windowMs: number;
            readonly max: number;
            readonly message: string;
        };
        readonly scraper: {
            readonly windowMs: number;
            readonly max: number;
            readonly message: string;
            readonly jobDelay: number;
            readonly cacheCleanupInterval: number;
        };
    };
    readonly cors: {
        readonly allowedOrigins: string[];
        readonly credentials: boolean;
        readonly allowNoOrigin: boolean;
    };
    readonly security: {
        readonly helmet: {
            readonly crossOriginResourcePolicy: string;
            readonly enableHsts: boolean;
            readonly enableCoop: boolean;
            readonly enableCsp: boolean;
            readonly enableOriginAgentCluster: boolean;
        };
        readonly csp: {
            readonly enabled: boolean;
            readonly nonceLength: number;
            readonly directives: {
                readonly defaultSrc: string[];
                readonly scriptSrc: string[];
                readonly styleSrc: string[];
                readonly imgSrc: string[];
                readonly fontSrc: string[];
                readonly connectSrc: string[];
                readonly frameAncestors: string[];
                readonly baseUri: string[];
                readonly formAction: string[];
            };
        };
        readonly hsts: {
            readonly maxAge: number;
            readonly includeSubDomains: boolean;
        };
    };
    readonly auth: {
        readonly apiKey: string | undefined;
        readonly jwt: {
            readonly secret: string;
            readonly expiresIn: string;
        };
        readonly skipInDevelopment: boolean;
    };
    readonly scraper: {
        readonly tcadApiKey: string | undefined;
        readonly autoRefreshToken: boolean;
        readonly tokenRefreshInterval: number;
        readonly tokenRefreshCron: string | undefined;
        readonly headless: boolean;
        readonly timeout: number;
        readonly retryAttempts: number;
        readonly retryDelay: number;
        readonly humanDelay: {
            readonly min: number;
            readonly max: number;
        };
        readonly userAgents: string[];
        readonly viewports: any;
        readonly proxy: {
            readonly enabled: boolean;
            readonly server: string | undefined;
            readonly username: string | undefined;
            readonly password: string | undefined;
        };
        readonly brightData: {
            readonly enabled: boolean;
            readonly apiToken: string | undefined;
            readonly proxyHost: string;
            readonly proxyPort: number;
        };
    };
    readonly claude: {
        readonly apiKey: string | undefined;
        readonly model: string;
        readonly maxTokens: number;
        readonly timeout: number;
    };
    readonly logging: {
        readonly level: string | undefined;
        readonly format: string | undefined;
        readonly colorize: boolean;
        readonly files: {
            readonly error: string | undefined;
            readonly combined: string | undefined;
            readonly enabled: boolean;
        };
        readonly console: {
            readonly enabled: boolean;
        };
    };
    readonly frontend: {
        readonly url: string | undefined;
        readonly apiUrl: string | undefined;
        readonly viteApiUrl: string | undefined;
        readonly appVersion: string;
        readonly features: {
            readonly search: boolean;
            readonly analytics: boolean;
            readonly monitoring: boolean;
        };
    };
    readonly monitoring: {
        readonly sentry: {
            readonly enabled: boolean;
            readonly dsn: string | undefined;
            readonly environment: string;
            readonly tracesSampleRate: number;
        };
    };
};
/**
 * Validate required configuration
 * Throws error if critical config is missing
 */
export declare function validateConfig(): void;
/**
 * Log configuration summary (safe for production - no secrets)
 */
export declare function logConfigSummary(): void;
export declare const serverConfig: {
    readonly port: number;
    readonly host: string;
    readonly logLevel: string | undefined;
    readonly gracefulShutdownTimeout: number;
};
export declare const databaseConfig: {
    readonly url: string;
    readonly readOnlyUrl: string | undefined;
    readonly connectionTimeout: number;
    readonly poolSize: number;
};
export declare const redisConfig: {
    readonly host: string;
    readonly port: number;
    readonly password: string | undefined;
    readonly db: number;
    readonly connectionTimeout: number;
};
export declare const queueConfig: {
    readonly name: "scraper-queue";
    readonly jobName: "scrape-properties";
    readonly concurrency: number;
    readonly defaultJobOptions: {
        readonly attempts: number;
        readonly backoffDelay: number;
        readonly removeOnComplete: number;
        readonly removeOnFail: number;
    };
    readonly cleanupInterval: number;
    readonly cleanupGracePeriod: number;
    readonly dashboard: {
        readonly basePath: string;
        readonly enabled: boolean;
    };
};
export declare const rateLimitConfig: {
    readonly api: {
        readonly windowMs: number;
        readonly max: number;
        readonly message: string;
    };
    readonly scraper: {
        readonly windowMs: number;
        readonly max: number;
        readonly message: string;
        readonly jobDelay: number;
        readonly cacheCleanupInterval: number;
    };
};
export declare const corsConfig: {
    readonly allowedOrigins: string[];
    readonly credentials: boolean;
    readonly allowNoOrigin: boolean;
};
export declare const securityConfig: {
    readonly helmet: {
        readonly crossOriginResourcePolicy: string;
        readonly enableHsts: boolean;
        readonly enableCoop: boolean;
        readonly enableCsp: boolean;
        readonly enableOriginAgentCluster: boolean;
    };
    readonly csp: {
        readonly enabled: boolean;
        readonly nonceLength: number;
        readonly directives: {
            readonly defaultSrc: string[];
            readonly scriptSrc: string[];
            readonly styleSrc: string[];
            readonly imgSrc: string[];
            readonly fontSrc: string[];
            readonly connectSrc: string[];
            readonly frameAncestors: string[];
            readonly baseUri: string[];
            readonly formAction: string[];
        };
    };
    readonly hsts: {
        readonly maxAge: number;
        readonly includeSubDomains: boolean;
    };
};
export declare const authConfig: {
    readonly apiKey: string | undefined;
    readonly jwt: {
        readonly secret: string;
        readonly expiresIn: string;
    };
    readonly skipInDevelopment: boolean;
};
export declare const scraperConfig: {
    readonly tcadApiKey: string | undefined;
    readonly autoRefreshToken: boolean;
    readonly tokenRefreshInterval: number;
    readonly tokenRefreshCron: string | undefined;
    readonly headless: boolean;
    readonly timeout: number;
    readonly retryAttempts: number;
    readonly retryDelay: number;
    readonly humanDelay: {
        readonly min: number;
        readonly max: number;
    };
    readonly userAgents: string[];
    readonly viewports: any;
    readonly proxy: {
        readonly enabled: boolean;
        readonly server: string | undefined;
        readonly username: string | undefined;
        readonly password: string | undefined;
    };
    readonly brightData: {
        readonly enabled: boolean;
        readonly apiToken: string | undefined;
        readonly proxyHost: string;
        readonly proxyPort: number;
    };
};
export declare const claudeConfig: {
    readonly apiKey: string | undefined;
    readonly model: string;
    readonly maxTokens: number;
    readonly timeout: number;
};
export declare const loggingConfig: {
    readonly level: string | undefined;
    readonly format: string | undefined;
    readonly colorize: boolean;
    readonly files: {
        readonly error: string | undefined;
        readonly combined: string | undefined;
        readonly enabled: boolean;
    };
    readonly console: {
        readonly enabled: boolean;
    };
};
export declare const frontendConfig: {
    readonly url: string | undefined;
    readonly apiUrl: string | undefined;
    readonly viteApiUrl: string | undefined;
    readonly appVersion: string;
    readonly features: {
        readonly search: boolean;
        readonly analytics: boolean;
        readonly monitoring: boolean;
    };
};
export declare const monitoringConfig: {
    readonly sentry: {
        readonly enabled: boolean;
        readonly dsn: string | undefined;
        readonly environment: string;
        readonly tracesSampleRate: number;
    };
};
export default config;
//# sourceMappingURL=index.d.ts.map