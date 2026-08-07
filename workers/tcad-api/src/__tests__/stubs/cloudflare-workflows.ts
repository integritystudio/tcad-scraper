/**
 * Node stub for the `cloudflare:workflows` runtime module, which only exists
 * inside workerd. Lets vitest import src/index.ts (which re-exports
 * ScraperWorkflow) without the Workers runtime. Wired up via the
 * `cloudflare:workflows` alias in vitest.config.ts.
 */

export class NonRetryableError extends Error {
	constructor(message: string, name?: string) {
		super(message);
		this.name = name ?? "NonRetryableError";
	}
}
