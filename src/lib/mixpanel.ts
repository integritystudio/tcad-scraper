/**
 * Mixpanel Analytics Wrapper
 *
 * Safely handles Mixpanel initialization to prevent crashes when:
 * - Token is not configured
 * - Library fails to load
 * - Internal library errors occur (e.g., 'disable_all_events' undefined)
 */

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

// Track initialization state
let isInitialized = false;
let mixpanelInstance: typeof import("mixpanel-browser").default | null = null;

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

		// IMPORTANT: Disable autocapture and session recording to prevent
		// "Cannot read properties of undefined (reading 'disable_all_events')" error
		// These features trigger internal tracking before init() completes
		// See: https://github.com/mixpanel/mixpanel-js/issues/82
		mixpanel.default.init(MIXPANEL_TOKEN, {
			debug: import.meta.env.DEV,
			track_pageview: "full-url", // Deferred pageview tracking
			persistence: "localStorage",
			autocapture: false, // Disabled - causes race condition
			record_sessions_percent: 0, // Disabled - causes race condition
			ignore_dnt: false, // Respect Do Not Track
		});

		mixpanelInstance = mixpanel.default;
		isInitialized = true;

		// Manual pageview tracking after initialization is complete
		mixpanelInstance.track("Page View", {
			page_url: window.location.href,
			page_path: window.location.pathname,
		});
	} catch (error) {
		if (import.meta.env.DEV) {
			console.warn("Mixpanel initialization failed:", error);
		}
		// Silently fail in production - analytics shouldn't break the app
	}
})();

// Create a safe wrapper that only calls mixpanel methods if initialized
// Methods are fire-and-forget - they don't block on initialization
const safeMixpanel = {
	track: (eventName: string, properties?: Record<string, unknown>) => {
		initPromise.then(() => {
			if (isInitialized && mixpanelInstance) {
				mixpanelInstance.track(eventName, properties);
			}
		});
	},
	identify: (id: string) => {
		initPromise.then(() => {
			if (isInitialized && mixpanelInstance) {
				mixpanelInstance.identify(id);
			}
		});
	},
	people: {
		set: (properties: Record<string, unknown>) => {
			initPromise.then(() => {
				if (isInitialized && mixpanelInstance) {
					mixpanelInstance.people.set(properties);
				}
			});
		},
	},
	register: (properties: Record<string, unknown>) => {
		initPromise.then(() => {
			if (isInitialized && mixpanelInstance) {
				mixpanelInstance.register(properties);
			}
		});
	},
	reset: () => {
		initPromise.then(() => {
			if (isInitialized && mixpanelInstance) {
				mixpanelInstance.reset();
			}
		});
	},
};

export default safeMixpanel;
