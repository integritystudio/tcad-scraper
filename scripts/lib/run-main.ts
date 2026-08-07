/** Standard CLI entrypoint wrapper: run fn, exit 1 + log on error, disconnect Prisma. */

import { prisma } from "./d1-prisma";
import { getErrorMessage } from "./error-helpers";

export interface RunMainOptions {
	/** Disconnect the shared Prisma client after running (default: true; pass false for scripts that don't use D1). */
	disconnectPrisma?: boolean;
}

export function runMain(
	fn: () => Promise<void>,
	opts: RunMainOptions = {},
): void {
	const { disconnectPrisma = true } = opts;
	fn()
		.catch((err) => {
			console.error("Fatal:", getErrorMessage(err));
			process.exit(1);
		})
		.finally(async () => {
			if (disconnectPrisma) await prisma.$disconnect();
		});
}
