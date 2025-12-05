/**
 * Mixpanel Analytics Wrapper
 *
 * Safely handles Mixpanel initialization to prevent crashes when:
 * - Token is not configured
 * - Library fails to load
 * - Internal library errors occur (e.g., 'disable_all_events' undefined)
 *
 * All methods are wrapped in try-catch to ensure analytics never crashes the app.
 */

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

// Track initialization state
let isInitialized = false;
let mixpanelInstance: typeof import("mixpanel-browser").default | null = null;

/**
 * Safely execute a mixpanel operation with error handling
 */
const safeExecute = (operation: () => void): void => {
	try {
		operation();
	} catch {
		// Silently fail - analytics should never crash the app
		// Common error: "Cannot read properties of undefined (reading 'disable_all_events')"
	}
};

// Initialize Mixpanel asynchronously to prevent crashes during module load
const initPromise = (async () => {
	if (!MIXPANEL_TOKEN) {
		if (import.meta.env.DEV) {
			console.warn("Mixpanel token not configured - skipping initialization");
		}
		return;
	}

	try {
		// Dynamic import prevents crashes during module load when token is missing
		const mixpanel = await import("mixpanel-browser");

		// IMPORTANT: Minimal config to prevent race conditions
		// Disabled: autocapture, session recording, auto pageview
		// See: https://github.com/mixpanel/mixpanel-js/issues/82
		mixpanel.default.init(MIXPANEL_TOKEN, {
			debug: import.meta.env.DEV,
			track_pageview: false, // Disabled - we track manually
			persistence: "localStorage",
			autocapture: false, // Disabled - causes race condition
			record_sessions_percent: 0, // Disabled - causes race condition
			ignore_dnt: false, // Respect Do Not Track
			loaded: () => {
				// Only mark as initialized after the library signals it's ready
				mixpanelInstance = mixpanel.default;
				isInitialized = true;

				// Track pageview after library is fully loaded
				safeExecute(() => {
					mixpanelInstance?.track("Page View", {
						page_url: window.location.href,
						page_path: window.location.pathname,
					});
				});
			},
		});
	} catch (error) {
		if (import.meta.env.DEV) {
			console.warn("Mixpanel initialization failed:", error);
		}
		// Silently fail in production - analytics shouldn't break the app
	}
})();

// Create a safe wrapper that only calls mixpanel methods if initialized
// All methods are wrapped in try-catch to prevent any crashes
const safeMixpanel = {
	track: (eventName: string, properties?: Record<string, unknown>) => {
		initPromise.then(() => {
			if (isInitialized && mixpanelInstance) {
				safeExecute(() => mixpanelInstance?.track(eventName, properties));
			}
		});
	},
	identify: (id: string) => {
		initPromise.then(() => {
			if (isInitialized && mixpanelInstance) {
				safeExecute(() => mixpanelInstance?.identify(id));
			}
		});
	},
	people: {
		set: (properties: Record<string, unknown>) => {
			initPromise.then(() => {
				if (isInitialized && mixpanelInstance) {
					safeExecute(() => mixpanelInstance?.people.set(properties));
				}
			});
		},
	},
	register: (properties: Record<string, unknown>) => {
		initPromise.then(() => {
			if (isInitialized && mixpanelInstance) {
				safeExecute(() => mixpanelInstance?.register(properties));
			}
		});
	},
	reset: () => {
		initPromise.then(() => {
			if (isInitialized && mixpanelInstance) {
				safeExecute(() => mixpanelInstance?.reset());
			}
		});
	},
};

export default safeMixpanel;
