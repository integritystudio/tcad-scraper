/**
 * Minimal console logger for CLI scripts.
 * Replaces the retired server/src/lib/logger.ts (pino) — scripts run via
 * `npx tsx` from the repo root, where pino is not a dependency.
 */

const debugEnabled = (process.env.LOG_LEVEL || "info") === "debug";

const logger = {
	info: (msg: unknown) => console.log(msg),
	warn: (msg: unknown) => console.warn(msg),
	error: (msg: unknown) => console.error(msg),
	debug: (msg: unknown) => {
		if (debugEnabled) console.log(msg);
	},
};

export default logger;
