import { defineConfig } from "vitest/config";

// Standalone config for the scripts suite. These are Node CLI tests: they must
// not inherit the root vite.config.ts, which forces jsdom, the React plugin and
// a src-only `include`.
//
// This file exists because Vite 8 bundles configs with rolldown, which rejects
// the previous `--config /dev/null` trick with UNRESOLVED_ENTRY (Vite 7's
// esbuild silently treated it as an empty module).
export default defineConfig({
	test: {
		environment: "node",
		include: ["**/*.test.ts"],
		exclude: ["**/node_modules/**"],
	},
});
