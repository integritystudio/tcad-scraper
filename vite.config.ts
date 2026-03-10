import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	base: "/",
	plugins: [react()],
	server: {
		// Use FRONTEND_PORT environment variable with fallback to 3002
		port: parseInt(process.env.FRONTEND_PORT || "3002", 10),
		proxy: {
			"/api": {
				target: "http://localhost:3001",
				changeOrigin: true,
				secure: false,
			},
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/setupTests.ts"],
		css: { modules: { classNameStrategy: "non-scoped" } },
		// Frontend tests only - server tests use server/vitest.config.ts
		include: ["src/**/__tests__/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
		exclude: ["**/node_modules/**"],
		// Increased from default 5000ms — first render in each file can take
		// 150-400ms for JSDOM/CSS-module init; under CI load this multiplies.
		testTimeout: 15000,
	},
});
