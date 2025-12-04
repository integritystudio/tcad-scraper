/**
 * Sentry Error Tracking for Frontend
 *
 * Provides comprehensive error tracking and performance monitoring for the React frontend.
 * Integrates with the tcad-scraper-frontend Sentry project.
 *
 * Features:
 * - Automatic error capture with React Error Boundary integration
 * - Performance tracing for page loads and interactions
 * - User session replay (optional)
 * - Release tracking
 * - Environment separation
 */

import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry for the frontend
 * Must be called before rendering the React app
 */
export function initializeSentry(): void {
	const dsn = import.meta.env.VITE_SENTRY_DSN;

	if (!dsn) {
		if (import.meta.env.DEV) {
			console.warn("Sentry DSN not configured - skipping initialization");
		}
		return;
	}

	Sentry.init({
		dsn,
		environment:
			import.meta.env.VITE_SENTRY_ENVIRONMENT ||
			import.meta.env.MODE ||
			"development",

		// Performance Monitoring
		tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

		// Session Replay - capture 10% of sessions, 100% on error
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,

		// Integrations
		integrations: [
			// Browser tracing for performance
			Sentry.browserTracingIntegration(),
			// Session replay for debugging
			Sentry.replayIntegration({
				maskAllText: false,
				blockAllMedia: false,
			}),
		],

		// Error Filtering
		beforeSend(event, hint) {
			// Add service tag for unified Sentry dashboard
			event.tags = event.tags || {};
			event.tags.service = "tcad-scraper-frontend";
			event.tags.language = "typescript";

			const error = hint.originalException;

			if (error instanceof Error) {
				// Ignore network errors that are expected (offline, etc.)
				if (
					error.message.includes("Failed to fetch") ||
					error.message.includes("Network request failed")
				) {
					return null;
				}

				// Ignore user-cancelled requests
				if (error.name === "AbortError") {
					return null;
				}

				// Ignore ResizeObserver errors (common browser noise)
				if (error.message.includes("ResizeObserver")) {
					return null;
				}
			}

			return event;
		},

		// Additional options
		attachStacktrace: true,
		maxBreadcrumbs: 50,
		debug: import.meta.env.DEV,
	});

	// Set global tags
	Sentry.setTag("service", "tcad-scraper-frontend");
	Sentry.setTag("language", "typescript");

	if (import.meta.env.DEV) {
		console.log("Sentry initialized for tcad-scraper-frontend");
	}
}

/**
 * Capture an exception manually
 */
export function captureException(
	error: Error,
	context?: Record<string, unknown>,
): string {
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
	return Sentry.captureMessage(message, {
		level,
		extra: context,
	});
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
	message: string;
	category?: string;
	level?: Sentry.SeverityLevel;
	data?: Record<string, unknown>;
}): void {
	Sentry.addBreadcrumb({
		message: breadcrumb.message,
		category: breadcrumb.category || "ui",
		level: breadcrumb.level || "info",
		data: breadcrumb.data,
		timestamp: Date.now() / 1000,
	});
}

/**
 * Set user context for error tracking
 */
export function setUser(
	user: {
		id?: string;
		email?: string;
		username?: string;
		ip_address?: string;
	} | null,
): void {
	Sentry.setUser(user);
}

/**
 * Set custom context
 */
export function setContext(
	name: string,
	context: Record<string, unknown>,
): void {
	Sentry.setContext(name, context);
}

/**
 * Set a tag for filtering
 */
export function setTag(key: string, value: string): void {
	Sentry.setTag(key, value);
}

/**
 * Wrap a function with error tracking
 */
export function wrapWithSentry<T extends (...args: unknown[]) => unknown>(
	fn: T,
	name?: string,
): T {
	return ((...args: unknown[]) => {
		try {
			const result = fn(...args);
			if (result instanceof Promise) {
				return result.catch((error: Error) => {
					Sentry.captureException(error, {
						extra: { functionName: name || fn.name },
					});
					throw error;
				});
			}
			return result;
		} catch (error) {
			Sentry.captureException(error, {
				extra: { functionName: name || fn.name },
			});
			throw error;
		}
	}) as T;
}

// Export Sentry for direct access
export { Sentry };

// Export the ErrorBoundary component from Sentry
export const SentryErrorBoundary = Sentry.ErrorBoundary;
