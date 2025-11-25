/**
 * Sentry Error Tracking Service
 *
 * Provides comprehensive error tracking and performance monitoring with:
 * - Automatic error capture
 * - Performance tracing
 * - User context
 * - Release tracking
 * - Environment separation
 * - Anthropic AI agent monitoring
 * - Service tagging for unified Sentry project
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import logger from './logger';

/**
 * Initialize Sentry with configuration and service tagging
 * @param serviceName - Unique service identifier for unified Sentry project (default: 'tcad-scraper')
 */
export function initializeSentry(serviceName: string = 'tcad-scraper'): void {
  if (!config.monitoring.sentry.enabled) {
    logger.info('Sentry monitoring is disabled');
    return;
  }

  if (!config.monitoring.sentry.dsn) {
    logger.warn('Sentry DSN not configured - skipping initialization');
    return;
  }

  Sentry.init({
    dsn: config.monitoring.sentry.dsn,
    environment: config.monitoring.sentry.environment,

    // Performance Monitoring
    tracesSampleRate: config.monitoring.sentry.tracesSampleRate,
    profilesSampleRate: config.monitoring.sentry.tracesSampleRate, // Profile 100% of sampled transactions

    // Integrations
    integrations: [
      // Performance profiling
      nodeProfilingIntegration(),

      // Anthropic AI Integration - REQUIRED for Claude agent monitoring
      Sentry.anthropicAIIntegration({
        recordInputs: true,   // Capture prompts sent to Claude
        recordOutputs: true,  // Capture responses from Claude
      }),

      // Automatic instrumentation
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: true }),
      new Sentry.Integrations.Postgres(),
      new Sentry.Integrations.OnUncaughtException({
        onFatalError: async (err) => {
          logger.error('Fatal error:', err);
          process.exit(1);
        },
      }),
      new Sentry.Integrations.OnUnhandledRejection({
        mode: 'warn',
      }),
    ],

    // REQUIRED: Send PII for AI agent context (prompts/responses)
    sendDefaultPii: true,

    // Error Filtering
    beforeSend(event, hint) {
      // CRITICAL: Set service tag on every event for unified Sentry project
      event.tags = event.tags || {};
      event.tags.service = serviceName;
      event.tags.language = 'typescript';

      // Filter out expected errors
      const error = hint.originalException;

      if (error instanceof Error) {
        // Ignore rate limit errors (expected)
        if (error.message.includes('Rate limit exceeded')) {
          return null;
        }

        // Ignore 404 errors (expected)
        if (error.message.includes('not found') || error.message.includes('404')) {
          return null;
        }

        // Ignore auth errors in development
        if (config.env.isDevelopment && error.message.includes('Unauthorized')) {
          return null;
        }
      }

      return event;
    },

    // Release tracking (use git commit hash or version)
    release: config.frontend.appVersion || 'unknown',

    // Additional options
    attachStacktrace: true,
    maxBreadcrumbs: 50,
    debug: config.env.isDevelopment,
  });

  // Set global tags for all future events
  Sentry.setTag('service', serviceName);
  Sentry.setTag('language', 'typescript');

  logger.info(`Sentry initialized for ${serviceName} with Anthropic AI integration (environment: ${config.monitoring.sentry.environment})`);
}

/**
 * Sentry request handler middleware (must be first)
 */
export const sentryRequestHandler = () => {
  if (!config.monitoring.sentry.enabled) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }
  return Sentry.Handlers.requestHandler();
};

/**
 * Sentry tracing middleware (must be after requestHandler)
 */
export const sentryTracingHandler = () => {
  if (!config.monitoring.sentry.enabled) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }
  return Sentry.Handlers.tracingHandler();
};

/**
 * Sentry error handler middleware (must be last, before other error handlers)
 */
export const sentryErrorHandler = () => {
  if (!config.monitoring.sentry.enabled) {
    return (err: Error, req: Request, res: Response, next: NextFunction) => next(err);
  }
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture all 5xx errors
      return true;
    },
  });
};

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>): string {
  if (!config.monitoring.sentry.enabled) {
    logger.error('Error (Sentry disabled):', error);
    return '';
  }

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): string {
  if (!config.monitoring.sentry.enabled) {
    logger.info(`Message (Sentry disabled) [${level}]:`, message);
    return '';
  }

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>;
}): void {
  if (!config.monitoring.sentry.enabled) {
    return;
  }

  Sentry.addBreadcrumb({
    message: breadcrumb.message,
    category: breadcrumb.category || 'default',
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
}): void {
  if (!config.monitoring.sentry.enabled) {
    return;
  }

  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!config.monitoring.sentry.enabled) {
    return;
  }

  Sentry.setUser(null);
}

/**
 * Set custom context for error tracking
 */
export function setContext(name: string, context: Record<string, any>): void {
  if (!config.monitoring.sentry.enabled) {
    return;
  }

  Sentry.setContext(name, context);
}

/**
 * Set tags for filtering and grouping
 */
export function setTag(key: string, value: string): void {
  if (!config.monitoring.sentry.enabled) {
    return;
  }

  Sentry.setTag(key, value);
}

/**
 * Set multiple tags at once
 */
export function setTags(tags: Record<string, string>): void {
  if (!config.monitoring.sentry.enabled) {
    return;
  }

  Sentry.setTags(tags);
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string): Sentry.Transaction | null {
  if (!config.monitoring.sentry.enabled) {
    return null;
  }

  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Wrap async function with error tracking
 */
export function wrapAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name?: string
): T {
  if (!config.monitoring.sentry.enabled) {
    return fn;
  }

  return (async (...args: any[]) => {
    const transaction = Sentry.startTransaction({
      name: name || fn.name || 'anonymous',
      op: 'function',
    });

    try {
      const result = await fn(...args);
      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('internal_error');
      Sentry.captureException(error);
      throw error;
    } finally {
      transaction.finish();
    }
  }) as T;
}

/**
 * Flush all pending events (useful before shutdown)
 */
export async function flush(timeout: number = 2000): Promise<boolean> {
  if (!config.monitoring.sentry.enabled) {
    return true;
  }

  return await Sentry.flush(timeout);
}

/**
 * Close Sentry client
 */
export async function close(timeout: number = 2000): Promise<boolean> {
  if (!config.monitoring.sentry.enabled) {
    return true;
  }

  return await Sentry.close(timeout);
}

/**
 * Get Sentry health status
 */
export function getHealth(): {
  enabled: boolean;
  dsn: string | null;
  environment: string;
  release: string;
} {
  return {
    enabled: config.monitoring.sentry.enabled,
    dsn: config.monitoring.sentry.dsn ? 'configured' : null,
    environment: config.monitoring.sentry.environment,
    release: config.frontend.appVersion || 'unknown',
  };
}

// Export Sentry for direct access if needed
export { Sentry };
