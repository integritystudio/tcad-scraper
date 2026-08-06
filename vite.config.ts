import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
	base: "/",
	plugins: [react()],
	server: {
		port: parseInt(process.env.FRONTEND_PORT || "5174", 10),
		proxy: {
			"/api": {
				target: "https://api.alephatx.info",
				changeOrigin: true,
				secure: true,
			},
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/setupTests.ts"],
		css: { modules: { classNameStrategy: "non-scoped" } },
		// Frontend tests only - scripts tests run via `vitest run --dir scripts --config /dev/null`
		include: ["src/**/__tests__/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
		exclude: ["**/node_modules/**"],
		// Increased from default 5000ms — first render in each file can take
		// 150-400ms for JSDOM/CSS-module init; under CI load this multiplies.
		testTimeout: 15000,
	},
});
