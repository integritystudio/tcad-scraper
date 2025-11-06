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

import dotenv from 'dotenv';

// Load environment variables from .env or Doppler
dotenv.config();

/**
 * Parse environment variable as integer with fallback
 */
function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse environment variable as boolean with fallback
 */
function parseBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse comma-separated string to array
 */
function parseArrayEnv(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Application Configuration
 */
export const config = {
  // Environment
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
  },

  // Doppler Configuration
  doppler: {
    project: process.env.DOPPLER_PROJECT,
    config: process.env.DOPPLER_CONFIG,
    enabled: !!process.env.DOPPLER_PROJECT,
  },

  // Server Configuration
  server: {
    port: parseIntEnv('PORT'),
    host: process.env.HOST,
    logLevel: process.env.LOG_LEVEL,
    gracefulShutdownTimeout: parseIntEnv('GRACEFUL_SHUTDOWN_TIMEOUT', 10000),
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/tcad_scraper',
    readOnlyUrl: process.env.DATABASE_READ_ONLY_URL,
    connectionTimeout: parseIntEnv('DATABASE_CONNECTION_TIMEOUT', 10000),
    poolSize: parseIntEnv('DATABASE_POOL_SIZE', 10),
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseIntEnv('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD,
    db: parseIntEnv('REDIS_DB', 0),
    connectionTimeout: parseIntEnv('REDIS_CONNECTION_TIMEOUT', 10000),
  },

  // Queue Configuration
  queue: {
    name: 'scraper-queue',
    jobName: 'scrape-properties',
    concurrency: parseIntEnv('QUEUE_CONCURRENCY', 2),
    defaultJobOptions: {
      attempts: parseIntEnv('QUEUE_JOB_ATTEMPTS', 3),
      backoffDelay: parseIntEnv('QUEUE_BACKOFF_DELAY', 2000),
      removeOnComplete: parseIntEnv('QUEUE_REMOVE_ON_COMPLETE', 100),
      removeOnFail: parseIntEnv('QUEUE_REMOVE_ON_FAIL', 50),
    },
    cleanupInterval: parseIntEnv('QUEUE_CLEANUP_INTERVAL', 3600000), // 1 hour
    cleanupGracePeriod: parseIntEnv('QUEUE_CLEANUP_GRACE', 86400000), // 24 hours
    dashboard: {
      basePath: process.env.QUEUE_DASHBOARD_PATH || '/admin/queues',
      enabled: parseBoolEnv('QUEUE_DASHBOARD_ENABLED', true),
    },
  },

  // Rate Limiting Configuration
  rateLimit: {
    api: {
      windowMs: parseIntEnv('API_RATE_LIMIT_WINDOW', 900000), // 15 minutes
      max: parseIntEnv('API_RATE_LIMIT_MAX', 100),
      message: process.env.API_RATE_LIMIT_MESSAGE || 'Too many requests from this IP, please try again later.',
    },
    scraper: {
      windowMs: parseIntEnv('SCRAPER_RATE_LIMIT_WINDOW', 60000), // 1 minute
      max: parseIntEnv('SCRAPER_RATE_LIMIT_MAX', 5),
      message: process.env.SCRAPER_RATE_LIMIT_MESSAGE || 'Too many scrape requests, please wait before trying again.',
      jobDelay: parseIntEnv('SCRAPER_RATE_LIMIT_DELAY', 5000),
      cacheCleanupInterval: parseIntEnv('SCRAPER_RATE_CACHE_CLEANUP', 60000),
    },
  },

  // CORS Configuration
  cors: {
    allowedOrigins: parseArrayEnv('CORS_ALLOWED_ORIGINS', [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://alephatx.info',
      'https://www.alephatx.info',
    ]),
    credentials: parseBoolEnv('CORS_CREDENTIALS', true),
    allowNoOrigin: parseBoolEnv('CORS_ALLOW_NO_ORIGIN', true), // For mobile apps, curl, etc.
  },

  // Security Configuration
  security: {
    helmet: {
      crossOriginResourcePolicy: process.env.HELMET_CORP || 'cross-origin',
      enableHsts: parseBoolEnv('HELMET_HSTS_ENABLED', false), // Disabled for HTTP/IP access
      enableCoop: parseBoolEnv('HELMET_COOP_ENABLED', false), // Disabled for IP access
      enableCsp: parseBoolEnv('HELMET_CSP_ENABLED', false), // Handled by xcontroller middleware
      enableOriginAgentCluster: parseBoolEnv('HELMET_OAC_ENABLED', false),
    },
    csp: {
      enabled: parseBoolEnv('CSP_ENABLED', true),
      nonceLength: parseIntEnv('CSP_NONCE_LENGTH', 16),
      directives: {
        defaultSrc: parseArrayEnv('CSP_DEFAULT_SRC', ["'self'"]),
        scriptSrc: parseArrayEnv('CSP_SCRIPT_SRC', ["'self'"]),
        styleSrc: parseArrayEnv('CSP_STYLE_SRC', ["'self'", "'unsafe-inline'"]),
        imgSrc: parseArrayEnv('CSP_IMG_SRC', ["'self'", 'data:', 'https:']),
        fontSrc: parseArrayEnv('CSP_FONT_SRC', ["'self'", 'data:']),
        connectSrc: parseArrayEnv('CSP_CONNECT_SRC', ["'self'"]),
        frameAncestors: parseArrayEnv('CSP_FRAME_ANCESTORS', ["'none'"]),
        baseUri: parseArrayEnv('CSP_BASE_URI', ["'self'"]),
        formAction: parseArrayEnv('CSP_FORM_ACTION', ["'self'"]),
      },
    },
    hsts: {
      maxAge: parseIntEnv('HSTS_MAX_AGE', 31536000), // 1 year
      includeSubDomains: parseBoolEnv('HSTS_INCLUDE_SUBDOMAINS', true),
    },
  },

  // Authentication Configuration
  auth: {
    apiKey: process.env.API_KEY,
    jwt: {
      secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    skipInDevelopment: parseBoolEnv('AUTH_SKIP_IN_DEVELOPMENT', true),
  },

  // Scraper Configuration
  scraper: {
    tcadApiKey: process.env.TCAD_API_KEY,
    autoRefreshToken: parseBoolEnv('TCAD_AUTO_REFRESH_TOKEN', true),
    tokenRefreshInterval: parseIntEnv('TCAD_TOKEN_REFRESH_INTERVAL', 270000), // 4.5 minutes
    tokenRefreshCron: process.env.TCAD_TOKEN_REFRESH_CRON, // Optional cron schedule
    headless: parseBoolEnv('SCRAPER_HEADLESS', true),
    timeout: parseIntEnv('SCRAPER_TIMEOUT', 30000),
    retryAttempts: parseIntEnv('SCRAPER_RETRY_ATTEMPTS', 3),
    retryDelay: parseIntEnv('SCRAPER_RETRY_DELAY', 2000),
    humanDelay: {
      min: parseIntEnv('SCRAPER_HUMAN_DELAY_MIN', 100),
      max: parseIntEnv('SCRAPER_HUMAN_DELAY_MAX', 500),
    },
    userAgents: parseArrayEnv('SCRAPER_USER_AGENTS', [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ]),
    viewports: process.env.SCRAPER_VIEWPORTS
      ? JSON.parse(process.env.SCRAPER_VIEWPORTS)
      : [
          { width: 3840, height: 2160 }, // 4K to see all columns
          { width: 2560, height: 1440 }, // 1440p
          { width: 1920, height: 1080 }, // 1080p
        ],
    proxy: {
      enabled: parseBoolEnv('SCRAPER_PROXY_ENABLED', false),
      server: process.env.SCRAPER_PROXY_SERVER,
      username: process.env.SCRAPER_PROXY_USERNAME,
      password: process.env.SCRAPER_PROXY_PASSWORD,
    },
    brightData: {
      enabled: parseBoolEnv('BRIGHT_DATA_ENABLED', false),
      apiToken: process.env.BRIGHT_DATA_API_TOKEN,
      proxyHost: process.env.BRIGHT_DATA_PROXY_HOST || 'brd.superproxy.io',
      proxyPort: parseIntEnv('BRIGHT_DATA_PROXY_PORT', 22225),
    },
  },

  // Claude AI Configuration
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
    maxTokens: parseIntEnv('CLAUDE_MAX_TOKENS', 1024),
    timeout: parseIntEnv('CLAUDE_TIMEOUT', 30000),
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL,
    format: process.env.LOG_FORMAT,
    colorize: parseBoolEnv('LOG_COLORIZE', true),
    files: {
      error: process.env.LOG_ERROR_FILE,
      combined: process.env.LOG_COMBINED_FILE,
      enabled: parseBoolEnv('LOG_FILES_ENABLED', true),
    },
    console: {
      enabled: parseBoolEnv('LOG_CONSOLE_ENABLED', true),
    },
  },

  // Frontend Configuration
  frontend: {
    url: process.env.FRONTEND_URL,
    apiUrl: process.env.API_URL,
    viteApiUrl: process.env.VITE_API_URL,
    appVersion: process.env.APP_VERSION || '1.0.0',
    features: {
      search: parseBoolEnv('FEATURE_SEARCH', true),
      analytics: parseBoolEnv('FEATURE_ANALYTICS', false),
      monitoring: parseBoolEnv('FEATURE_MONITORING', false),
    },
  },

  // Monitoring & Metrics Configuration
  monitoring: {
    sentry: {
      enabled: parseBoolEnv('SENTRY_ENABLED', false),
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    },
  },
} as const;

/**
 * Validate required configuration
 * Throws error if critical config is missing
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Check critical environment variables
  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  if (config.env.isProduction) {
    if (!config.auth.jwt.secret || config.auth.jwt.secret === 'fallback-secret-change-in-production') {
      errors.push('JWT_SECRET must be set in production');
    }
    if (!config.claude.apiKey) {
      errors.push('ANTHROPIC_API_KEY is required for AI search functionality');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Log configuration summary (safe for production - no secrets)
 */
export function logConfigSummary(): void {
  console.log('=== Configuration Summary ===');
  console.log(`Environment: ${config.env.nodeEnv}`);
  console.log(`Server: ${config.server.host}:${config.server.port}`);
  console.log(`Database: ${config.database.url ? 'Configured' : 'Not configured'}`);
  console.log(`Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`Queue Dashboard: ${config.queue.dashboard.enabled ? config.queue.dashboard.basePath : 'Disabled'}`);
  console.log(`Auth: ${config.auth.apiKey ? 'API Key configured' : 'No API Key'}, ${config.auth.jwt.secret ? 'JWT configured' : 'No JWT'}`);
  console.log(`Claude AI: ${config.claude.apiKey ? 'Enabled' : 'Disabled'}`);
  console.log(`TCAD API Token: ${config.scraper.tcadApiKey ? 'Configured (fast API mode)' : 'Not configured (fallback to browser capture)'}`);
  console.log(`TCAD Auto Refresh: ${config.scraper.autoRefreshToken ? `Enabled (every ${config.scraper.tokenRefreshInterval / 60000} min)` : 'Disabled'}`);
  console.log(`Scraper Proxy: ${config.scraper.proxy.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`Bright Data: ${config.scraper.brightData.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`Monitoring: ${config.monitoring.enabled ? 'Enabled' : 'Disabled'}`);

  if (config.doppler.enabled) {
    console.log(`Doppler: ${config.doppler.project}/${config.doppler.config}`);
  }

  console.log('============================');
}

// Export individual config sections for convenience
export const serverConfig = config.server;
export const databaseConfig = config.database;
export const redisConfig = config.redis;
export const queueConfig = config.queue;
export const rateLimitConfig = config.rateLimit;
export const corsConfig = config.cors;
export const securityConfig = config.security;
export const authConfig = config.auth;
export const scraperConfig = config.scraper;
export const claudeConfig = config.claude;
export const loggingConfig = config.logging;
export const frontendConfig = config.frontend;
export const monitoringConfig = config.monitoring;

// Default export
export default config;
