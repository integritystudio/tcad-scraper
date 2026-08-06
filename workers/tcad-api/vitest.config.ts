import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			// workerd-only module; stubbed so src/index.ts imports in Node
			"cloudflare:workers": path.resolve(
				import.meta.dirname,
				"src/__tests__/stubs/cloudflare-workers.ts",
			),
		},
	},
	test: {
		environment: "node",
		include: ["src/**/__tests__/**/*.test.ts"],
	},
});
