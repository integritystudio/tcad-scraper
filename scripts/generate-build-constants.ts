#!/usr/bin/env tsx
/**
 * Generate build-time constants from the production database (Cloudflare D1)
 *
 * This script fetches the total property count from D1 via the Cloudflare REST
 * API and generates a TypeScript constants file for use in the frontend.
 *
 * Run this before building the frontend to ensure the property count is up-to-date.
 *
 * Requires CLOUDFLARE_D1_TOKEN (Doppler, dev + prd) — the "tcad-d1-query" token.
 * Falls back to FALLBACK_PROPERTY_COUNT env var (or a hardcoded value) when
 * the token is missing or the query fails, e.g. in GitHub Actions.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const CLOUDFLARE_ACCOUNT_ID = "b3868dd0fd5c0faa7d98aa325a9c2377";
const D1_DATABASE_ID = "451d4356-10d1-4c1d-adf9-4d4297636343";
const D1_QUERY_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;

// Last known count as of Aug 6, 2026 (D1).
// Refresh: doppler run -p integrity-studio -c prd -- sh -c \
//   'CLOUDFLARE_API_TOKEN=$CLOUDFLARE_D1_TOKEN npx wrangler d1 execute tcad-db \
//    --remote --command "SELECT COUNT(*) FROM properties WHERE year = 2025"'
const HARDCODED_FALLBACK_COUNT = 260_000;

interface D1QueryResponse {
	success: boolean;
	errors: Array<{ code: number; message: string }>;
	result?: Array<{ results: Array<{ count: number }> }>;
}

async function fetchPropertyCount(): Promise<number> {
	const token = process.env.CLOUDFLARE_D1_TOKEN;
	if (!token) {
		throw new Error("CLOUDFLARE_D1_TOKEN not set");
	}

	const res = await fetch(D1_QUERY_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ sql: "SELECT COUNT(*) as count FROM properties" }),
	});

	if (!res.ok) {
		throw new Error(`D1 query failed: HTTP ${res.status} ${res.statusText}`);
	}

	const data = (await res.json()) as D1QueryResponse;
	if (!data.success) {
		throw new Error(
			`D1 query failed: ${data.errors.map((e) => e.message).join("; ")}`,
		);
	}

	const count = data.result?.[0]?.results?.[0]?.count;
	if (typeof count !== "number") {
		throw new Error("D1 query returned no count");
	}
	return count;
}

function buildConstantsFile(
	totalProperties: number,
	fallback: boolean,
): string {
	return `/**
 * Build-time constants${fallback ? " (FALLBACK)" : ""}
 *
 * This file is auto-generated during the build process.
 * Do not edit manually - changes will be overwritten.
 *${
		fallback
			? `
 * Generated with fallback values due to database connection failure.
 * Property count is approximate and should be updated periodically.
 *`
			: ""
 }
 * Generated: ${new Date().toISOString()}
 */

export const BUILD_CONSTANTS = {
  /**
   * Total number of properties in the database at build time
   */
  TOTAL_PROPERTIES: ${totalProperties},

  /**
   * Build timestamp
   */
  BUILD_TIMESTAMP: '${new Date().toISOString()}',

  /**
   * Formatted property count for display
   */
  TOTAL_PROPERTIES_FORMATTED: '${totalProperties.toLocaleString()}',
} as const;
`;
}

function writeConstantsFile(content: string): string {
	const outputPath = resolve(process.cwd(), "src/constants/build.ts");
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, content, "utf-8");
	return outputPath;
}

async function generateBuildConstants() {
	try {
		console.log("📊 Fetching property count from D1...");
		const totalProperties = await fetchPropertyCount();
		console.log(`✓ Found ${totalProperties.toLocaleString()} properties`);

		const outputPath = writeConstantsFile(
			buildConstantsFile(totalProperties, false),
		);
		console.log(`✓ Generated constants file: ${outputPath}`);
	} catch (error) {
		console.error("✗ Failed to generate build constants:", error);

		// Use environment variable or hardcoded fallback for production builds
		const fallbackCount = process.env.FALLBACK_PROPERTY_COUNT
			? parseInt(process.env.FALLBACK_PROPERTY_COUNT, 10)
			: HARDCODED_FALLBACK_COUNT;

		console.log(
			`⚠️  Using fallback property count: ${fallbackCount.toLocaleString()}`,
		);
		writeConstantsFile(buildConstantsFile(fallbackCount, true));
		console.log("⚠️  Generated fallback constants file (database unavailable)");
	}
}

generateBuildConstants();
