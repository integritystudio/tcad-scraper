"use strict";
async function testApi() {
    console.log('Testing TCAD API directly...\n');
    // Step 1: Look up the office first (as the browser does)
    console.log('1. Looking up office...');
    const officeLookupResponse = await fetch('https://prod-container.trueprodigyapi.com/trueprodigy/officelookup/travis.prodigycad.com');
    const officeLookup = await officeLookupResponse.json();
    console.log(`✓ Office: ${officeLookup.results.office}\n`);
    // Step 2: Get auth token
    console.log('2. Getting auth token...');
    const authResponse = await fetch('https://prod-container.trueprodigyapi.com/trueprodigy/cadpublic/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office: officeLookup.results.office }),
    });
    const authData = await authResponse.json();
    const token = authData.user.token;
    console.log(`✓ Got token: ${token.substring(0, 50)}...\n`);
    // Step 3: Search for properties (exact format from API discovery with browser headers)
    console.log('3. Searching for properties...');
    const searchResponse = await fetch('https://prod-container.trueprodigyapi.com/public/property/searchfulltext?page=1&pageSize=5', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Authorization': `Bearer ${token}`,
            'Origin': 'https://travis.prodigycad.com',
            'Referer': 'https://travis.prodigycad.com/property-search',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
            pYear: { operator: '=', value: '2025' },
            fullTextSearch: { operator: 'match', value: 'Willow' },
        }),
    });
    console.log(`   Status: ${searchResponse.status}`);
    const searchData = await searchResponse.json();
    console.log(`✓ Total properties found: ${searchData.totalProperty?.propertyCount || 0}\n`);
    // Step 4: Show first property with all fields
    if (searchData.results && searchData.results.length > 0) {
        const firstProperty = searchData.results[0];
        console.log('4. First property data:');
        console.log(JSON.stringify(firstProperty, null, 2));
        console.log('\n5. Key fields check:');
        console.log(`   - Property ID: ${firstProperty.pid}`);
        console.log(`   - Owner Name: ${firstProperty.displayName || firstProperty.ownerName || 'N/A'}`);
        console.log(`   - City: ${firstProperty.situsCity || firstProperty.city || 'NOT FOUND'}`);
        console.log(`   - Address: ${firstProperty.streetPrimary || firstProperty.situsAddress || firstProperty.situs || 'N/A'}`);
        console.log(`   - Appraised Value: ${firstProperty.appraisedValue || firstProperty.marketValue || firstProperty.mktValue || firstProperty.totalAppraised || 'NOT FOUND'}`);
        console.log(`   - Property Type: ${firstProperty.propType || 'N/A'}`);
        console.log('\n6. All available keys in response:');
        console.log(Object.keys(firstProperty).join(', '));
    }
    else {
        console.log('❌ No results returned');
    }
}
testApi().catch(console.error);
//# sourceMappingURL=test-api-direct.js.map