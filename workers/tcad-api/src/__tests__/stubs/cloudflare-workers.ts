/**
 * Node stub for the `cloudflare:workers` runtime module, which only exists
 * inside workerd. Lets vitest import src/index.ts (which re-exports
 * ScraperWorkflow) without the Workers runtime. Wired up via the
 * `cloudflare:workers` alias in vitest.config.ts.
 */

export class WorkflowEntrypoint {}

export type WorkflowEvent<T> = { payload: T; timestamp: Date };
export type WorkflowStep = unknown;
