/** Standard CLI entrypoint wrapper: run fn, exit 1 + log on error, disconnect Prisma. */

import { prisma } from "./d1-prisma";
import { getErrorMessage } from "./error-helpers";

export interface RunMainOptions {
	/** Disconnect the shared Prisma client after running (default: true; pass false for scripts that don't use D1). */
	disconnectPrisma?: boolean;
}

export async function runMain(
	fn: () => Promise<void>,
	opts: RunMainOptions = {},
): Promise<void> {
	const { disconnectPrisma = true } = opts;
	let exitCode = 0;
	try {
		await fn();
	} catch (err) {
		console.error("Fatal:", getErrorMessage(err));
		exitCode = 1;
	} finally {
		if (disconnectPrisma) {
			try {
				await prisma.$disconnect();
			} catch (err) {
				console.error(
					"Warning: Prisma disconnect failed:",
					getErrorMessage(err),
				);
			}
		}
	}
	// Only force-exit on failure — process.exit() on the happy path risks
	// truncating pending stdout/stderr writes; a clean run exits 0 naturally.
	if (exitCode !== 0) process.exit(exitCode);
}
