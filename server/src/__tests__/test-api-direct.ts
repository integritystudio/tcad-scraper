import logger from "../lib/logger";

/**
 * Test script to directly call the TCAD API using the authentication token
 * This tests if we can use the API instead of web scraping
 */

const TCAD_API_BASE_URL =
	"https://prod-container.trueprodigyapi.com/trueprodigy/cadpublic";

interface TCADAuthResponse {
	user: {
		token: string;
	};
}

async function getAuthToken(): Promise<string> {
	logger.info("🔑 Getting authentication token...");

	const response = await fetch(`${TCAD_API_BASE_URL}/auth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ office: "Travis" }),
	});

	const data = (await response.json()) as TCADAuthResponse;
	const token = data.user.token;
	logger.info(`✅ Token received: ${token.substring(0, 50)}...`);
	return token;
}

async function searchProperties(token: string, searchTerm: string) {
	logger.info(`\n🔍 Searching for: "${searchTerm}"`);

	try {
		// Try different possible API endpoints
		const endpoints = [
			"/properties/search",
			"/property/search",
			"/search",
			"/properties",
			"/property",
		];

		for (const endpoint of endpoints) {
			try {
				logger.info(`  Trying: ${TCAD_API_BASE_URL}${endpoint}`);

				// Try with different query parameter names
				const params = new URLSearchParams({
					search: searchTerm,
					q: searchTerm,
					query: searchTerm,
					term: searchTerm,
				});

				const response = await fetch(
					`${TCAD_API_BASE_URL}${endpoint}?${params}`,
					{
						method: "GET",
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
					},
				);

				if (response.ok) {
					const data = await response.json();
					logger.info(`\n✅ Success with endpoint: ${endpoint}`);
					logger.info("Response:", JSON.stringify(data, null, 2));
					return data;
				} else {
					logger.info(`  ❌ ${response.status}: ${response.statusText}`);
					if (response.status !== 404 && response.status !== 405) {
						const errorData = await response.text();
						logger.info("  Response data:", errorData);
					}
				}
			} catch (error: unknown) {
				logger.info(`  ❌ Error: ${error.message}`);
			}
		}

		logger.info("\n❌ All endpoints failed");
	} catch (error) {
		logger.error("Error searching properties:", error);
	}
}

async function testTCADAPI() {
	logger.info("╔════════════════════════════════════════════════════╗");
	logger.info("║     TCAD API Direct Test                           ║");
	logger.info("╚════════════════════════════════════════════════════╝\n");

	try {
		// Step 1: Get auth token
		const token = await getAuthToken();

		// Step 2: Try to search for properties
		const testSearchTerms = ["Austin", "78701", "downtown"];

		for (const searchTerm of testSearchTerms) {
			await searchProperties(token, searchTerm);
		}

		logger.info("\n╔════════════════════════════════════════════════════╗");
		logger.info("║     Test Complete                                  ║");
		logger.info("╚════════════════════════════════════════════════════╝");
	} catch (error) {
		logger.error("\n❌ Test failed:", error);
	}
}

// Run the test
testTCADAPI();
