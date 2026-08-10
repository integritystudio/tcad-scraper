import { defineConfig } from "vitest/config";

// Standalone config for the external-link check (weekly cron, not in the unit
// suite). Network-bound, so it needs a longer timeout than the Vitest default
// and must not inherit the root vite.config.ts's jsdom environment.
//
// This file exists because Vite 8 bundles configs with rolldown, which rejects
// the previous `--config /dev/null` trick with UNRESOLVED_ENTRY (Vite 7's
// esbuild silently treated it as an empty module).
export default defineConfig({
	test: {
		environment: "node",
		include: ["**/*.test.ts"],
		exclude: ["**/node_modules/**"],
		testTimeout: 30000,
	},
});
