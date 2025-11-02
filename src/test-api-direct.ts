/**
 * Test script to directly call the TCAD API using the authentication token
 * This tests if we can use the API instead of web scraping
 */

const TCAD_API_BASE_URL = 'https://prod-container.trueprodigyapi.com/trueprodigy/cadpublic';

interface TCADAuthResponse {
  user: {
    token: string;
  };
}

async function getAuthToken(): Promise<string> {
  console.log('🔑 Getting authentication token...');

  const response = await fetch(`${TCAD_API_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ office: 'Travis' })
  });

  const data = await response.json() as TCADAuthResponse;
  const token = data.user.token;
  console.log(`✅ Token received: ${token.substring(0, 50)}...`);
  return token;
}

async function searchProperties(token: string, searchTerm: string) {
  console.log(`\n🔍 Searching for: "${searchTerm}"`);

  try {
    // Try different possible API endpoints
    const endpoints = [
      '/properties/search',
      '/property/search',
      '/search',
      '/properties',
      '/property',
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`  Trying: ${TCAD_API_BASE_URL}${endpoint}`);

        // Try with different query parameter names
        const params = new URLSearchParams({
          search: searchTerm,
          q: searchTerm,
          query: searchTerm,
          term: searchTerm,
        });

        const response = await fetch(`${TCAD_API_BASE_URL}${endpoint}?${params}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`\n✅ Success with endpoint: ${endpoint}`);
          console.log('Response:', JSON.stringify(data, null, 2));
          return data;
        } else {
          console.log(`  ❌ ${response.status}: ${response.statusText}`);
          if (response.status !== 404 && response.status !== 405) {
            const errorData = await response.text();
            console.log('  Response data:', errorData);
          }
        }

      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

    console.log('\n❌ All endpoints failed');

  } catch (error) {
    console.error('Error searching properties:', error);
  }
}

async function testTCADAPI() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║     TCAD API Direct Test                           ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Get auth token
    const token = await getAuthToken();

    // Step 2: Try to search for properties
    const testSearchTerms = ['Austin', '78701', 'downtown'];

    for (const searchTerm of testSearchTerms) {
      await searchProperties(token, searchTerm);
    }

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║     Test Complete                                  ║');
    console.log('╚════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
testTCADAPI();
