import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
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
		// Include frontend tests and server tests
		include: [
			"src/**/__tests__/**/*.test.{ts,tsx}",
			"src/**/*.test.{ts,tsx}",
			"server/src/**/__tests__/**/*.test.ts",
			"server/src/**/*.test.ts",
		],
		// Exclude integration tests (require external services)
		exclude: [
			"**/node_modules/**",
			"**/*.integration.test.ts",
			"server/src/__tests__/integration.test.ts",
			"server/src/__tests__/enqueue.test.ts",
			"server/src/__tests__/api.test.ts",
			"server/src/__tests__/auth-database.connection.test.ts",
			"server/src/__tests__/auth-database.integration.test.ts",
			"server/src/__tests__/security.test.ts",
			"server/src/routes/__tests__/property.routes.claude.test.ts",
		],
	},
});
