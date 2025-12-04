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

import * as Sentry from "@sentry/node";
import {
	expressErrorHandler,
	expressIntegration,
	httpIntegration,
	onUncaughtExceptionIntegration,
	onUnhandledRejectionIntegration,
	postgresIntegration,
} from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import type {
	ErrorRequestHandler,
	NextFunction,
	Request,
	Response,
} from "express";
import { config } from "../config";
import logger from "./logger";

/**
 * Initialize Sentry with configuration and service tagging
 * @param serviceName - Unique service identifier for unified Sentry project (default: 'tcad-scraper')
 */
export function initializeSentry(serviceName: string = "tcad-scraper"): void {
	if (!config.monitoring.sentry.enabled) {
		logger.info("Sentry monitoring is disabled");
		return;
	}

	if (!config.monitoring.sentry.dsn) {
		logger.warn("Sentry DSN not configured - skipping initialization");
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
				recordInputs: true, // Capture prompts sent to Claude
				recordOutputs: true, // Capture responses from Claude
			}),

			// Automatic instrumentation (Sentry v8 API)
			httpIntegration(),
			expressIntegration(),
			postgresIntegration(),
			onUncaughtExceptionIntegration({
				onFatalError: async (err: Error) => {
					logger.error(`Fatal error: ${err.message}`);
					process.exit(1);
				},
			}),
			onUnhandledRejectionIntegration({
				mode: "warn",
			}),
		],

		// REQUIRED: Send PII for AI agent context (prompts/responses)
		sendDefaultPii: true,

		// Error Filtering
		beforeSend(event, hint) {
			// CRITICAL: Set service tag on every event for unified Sentry project
			event.tags = event.tags || {};
			event.tags.service = serviceName;
			event.tags.language = "typescript";

			// Filter out expected errors
			const error = hint.originalException;

			if (error instanceof Error) {
				// Ignore rate limit errors (expected)
				if (error.message.includes("Rate limit exceeded")) {
					return null;
				}

				// Ignore 404 errors (expected)
				if (
					error.message.includes("not found") ||
					error.message.includes("404")
				) {
					return null;
				}

				// Ignore auth errors in development
				if (
					config.env.isDevelopment &&
					error.message.includes("Unauthorized")
				) {
					return null;
				}
			}

			return event;
		},

		// Release tracking (use git commit hash or version)
		release: config.frontend.appVersion || "unknown",

		// Additional options
		attachStacktrace: true,
		maxBreadcrumbs: 50,
		debug: config.env.isDevelopment,
	});

	// Set global tags for all future events
	Sentry.setTag("service", serviceName);
	Sentry.setTag("language", "typescript");

	logger.info(
		`Sentry initialized for ${serviceName} with Anthropic AI integration (environment: ${config.monitoring.sentry.environment})`,
	);
}

/**
 * Sentry request handler middleware (must be first)
 * In Sentry v8, request data is automatically captured by requestDataIntegration
 */
export const sentryRequestHandler = () => {
	if (!config.monitoring.sentry.enabled) {
		return (_req: Request, _res: Response, next: NextFunction) => next();
	}
	// Sentry v8: requestDataIntegration handles this automatically
	return (_req: Request, _res: Response, next: NextFunction) => next();
};

/**
 * Sentry tracing middleware (must be after requestHandler)
 * In Sentry v8, tracing is automatically handled by httpIntegration and expressIntegration
 */
export const sentryTracingHandler = () => {
	if (!config.monitoring.sentry.enabled) {
		return (_req: Request, _res: Response, next: NextFunction) => next();
	}
	// Sentry v8: httpIntegration and expressIntegration handle this automatically
	return (_req: Request, _res: Response, next: NextFunction) => next();
};

/**
 * Sentry error handler middleware (must be last, before other error handlers)
 */
export const sentryErrorHandler = (): ErrorRequestHandler => {
	if (!config.monitoring.sentry.enabled) {
		return (_err: Error, _req: Request, _res: Response, next: NextFunction) =>
			next(_err);
	}
	return expressErrorHandler({
		shouldHandleError(_error: Error) {
			// Capture all 5xx errors
			return true;
		},
	});
};

/**
 * Manually capture an exception
 */
export function captureException(
	error: Error,
	context?: Record<string, unknown>,
): string {
	if (!config.monitoring.sentry.enabled) {
		logger.error(`Error (Sentry disabled): ${error.message}`);
		return "";
	}

	return Sentry.captureException(error, {
		extra: context,
	});
}

/**
 * Capture a message
 */
export function captureMessage(
	message: string,
	level: Sentry.SeverityLevel = "info",
	context?: Record<string, unknown>,
): string {
	if (!config.monitoring.sentry.enabled) {
		logger.info(`Message (Sentry disabled) [${level}]: ${message}`);
		return "";
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
	data?: Record<string, unknown>;
}): void {
	if (!config.monitoring.sentry.enabled) {
		return;
	}

	Sentry.addBreadcrumb({
		message: breadcrumb.message,
		category: breadcrumb.category || "default",
		level: breadcrumb.level || "info",
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
export function setContext(
	name: string,
	context: Record<string, unknown>,
): void {
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
 * Start a performance transaction (Sentry v8: use startSpan instead)
 * @deprecated Use Sentry.startSpan() directly for Sentry v8
 */
export function startTransaction(
	name: string,
	op: string,
): { setStatus: () => void; finish: () => void } | null {
	if (!config.monitoring.sentry.enabled) {
		return null;
	}

	// Sentry v8: startTransaction is deprecated, use startSpan instead
	return Sentry.startSpan({ name, op }, () => {
		// Return a mock transaction-like object for backwards compatibility
		return {
			setStatus: () => {},
			finish: () => {},
		};
	});
}

/**
 * Wrap async function with error tracking (Sentry v8: use startSpan)
 */
export function wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
	fn: T,
	name?: string,
): T {
	if (!config.monitoring.sentry.enabled) {
		return fn;
	}

	return (async (...args: unknown[]) => {
		// Sentry v8: Use startSpan instead of startTransaction
		return await Sentry.startSpan(
			{
				name: name || fn.name || "anonymous",
				op: "function",
			},
			async () => {
				try {
					return await fn(...args);
				} catch (error) {
					Sentry.captureException(error);
					throw error;
				}
			},
		);
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
		dsn: config.monitoring.sentry.dsn ? "configured" : null,
		environment: config.monitoring.sentry.environment,
		release: config.frontend.appVersion || "unknown",
	};
}

// Export Sentry for direct access if needed
export { Sentry };
