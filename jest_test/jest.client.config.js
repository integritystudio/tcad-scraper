module.exports = {
	preset: "ts-jest",
	testEnvironment: "jsdom",
	roots: ["<rootDir>/src"],
	testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
	collectCoverageFrom: [
		"src/**/*.ts",
		"src/**/*.tsx",
		"!src/**/*.test.ts",
		"!src/**/__tests__/**",
	],
	coverageDirectory: "coverage-client",
	coverageReporters: ["text", "lcov", "html"],
	verbose: true,
	setupFilesAfterEnv: ["<rootDir>/jest_test/jest.setup.js"],
	moduleNameMapper: {
		"\\.(css|less|scss|sass)$": "identity-obj-proxy",
	},
};
