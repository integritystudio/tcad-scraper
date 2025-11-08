"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../lib/logger"));
async function testApi() {
    logger_1.default.info('Testing TCAD API directly...\n');
    // Step 1: Look up the office first (as the browser does)
    logger_1.default.info('1. Looking up office...');
    const officeLookupResponse = await fetch('https://prod-container.trueprodigyapi.com/trueprodigy/officelookup/travis.prodigycad.com');
    const officeLookup = await officeLookupResponse.json();
    logger_1.default.info(`✓ Office: ${officeLookup.results.office}\n`);
    // Step 2: Get auth token
    logger_1.default.info('2. Getting auth token...');
    const authResponse = await fetch('https://prod-container.trueprodigyapi.com/trueprodigy/cadpublic/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office: officeLookup.results.office }),
    });
    const authData = await authResponse.json();
    const token = authData.user.token;
    logger_1.default.info(`✓ Got token: ${token.substring(0, 50)}...\n`);
    // Step 3: Search for properties (exact format from API discovery with browser headers)
    logger_1.default.info('3. Searching for properties...');
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
    logger_1.default.info(`   Status: ${searchResponse.status}`);
    const searchData = await searchResponse.json();
    logger_1.default.info(`✓ Total properties found: ${searchData.totalProperty?.propertyCount || 0}\n`);
    // Step 4: Show first property with all fields
    if (searchData.results && searchData.results.length > 0) {
        const firstProperty = searchData.results[0];
        logger_1.default.info('4. First property data:');
        logger_1.default.info(JSON.stringify(firstProperty, null, 2));
        logger_1.default.info('\n5. Key fields check:');
        logger_1.default.info(`   - Property ID: ${firstProperty.pid}`);
        logger_1.default.info(`   - Owner Name: ${firstProperty.displayName || firstProperty.ownerName || 'N/A'}`);
        logger_1.default.info(`   - City: ${firstProperty.situsCity || firstProperty.city || 'NOT FOUND'}`);
        logger_1.default.info(`   - Address: ${firstProperty.streetPrimary || firstProperty.situsAddress || firstProperty.situs || 'N/A'}`);
        logger_1.default.info(`   - Appraised Value: ${firstProperty.appraisedValue || firstProperty.marketValue || firstProperty.mktValue || firstProperty.totalAppraised || 'NOT FOUND'}`);
        logger_1.default.info(`   - Property Type: ${firstProperty.propType || 'N/A'}`);
        logger_1.default.info('\n6. All available keys in response:');
        logger_1.default.info(Object.keys(firstProperty).join(', '));
    }
    else {
        logger_1.default.info('❌ No results returned');
    }
}
testApi().catch(logger_1.default.error);
//# sourceMappingURL=test-api-direct.js.map