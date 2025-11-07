# TCAD API Token Setup Guide

## Issue Summary

The scraper was defaulting to **browser-based token capture** instead of using a pre-fetched API token, making it slower and more resource-intensive.

## Root Cause

The `TCAD_API_KEY` environment variable was:
- Not defined in your `.env` file
- Not documented in `.env.example`
- Not integrated into the centralized config system

## How the Scraper Works

In `src/lib/tcad-scraper.ts:128`, the scraper checks for a pre-fetched token:

```typescript
let authToken: string | null = appConfig.scraper.tcadApiKey || null;

if (authToken) {
    logger.info('Using pre-fetched TCAD_API_KEY from environment');
} else {
    logger.info('No TCAD_API_KEY found, capturing token from browser...');
    // Falls back to browser capture:
    // 1. Loads full webpage
    // 2. Performs test search
    // 3. Captures auth token from network requests
}
```

## Solution

### Step 1: Get Your TCAD API Token

1. Open Chrome DevTools (F12)
2. Go to the Network tab
3. Visit https://travis.prodigycad.com/property-search
4. Perform a search
5. Look for a request to `prod-container.trueprodigyapi.com/public/property/searchfulltext`
6. In the request headers, find the `Authorization` header
7. Copy the entire token value

### Step 2: Add to Your Environment

Add this line to your `.env` file in the server directory:

```bash
# TCAD API Token for fast API-based scraping
TCAD_API_KEY=Bearer_your_token_here
```

### Step 3: Restart Your Server

```bash
cd /home/aledlie/tcad-scraper/server
pm2 restart ecosystem.config.js
```

## Changes Made

1. **`.env.example`** - Added `TCAD_API_KEY` documentation
2. **`src/config/index.ts`** - Added `tcadApiKey` to scraper config
3. **`src/lib/tcad-scraper.ts`** - Updated to use centralized config
4. **Config Summary** - Added TCAD API token status logging

## Verification

After adding the token, check the logs when the scraper runs. You should see:

```
Using pre-fetched TCAD_API_KEY from environment
```

Instead of:

```
No TCAD_API_KEY found, capturing token from browser...
```

## Performance Impact

**With TCAD_API_KEY:**
- ✅ Faster scraping (no browser page load)
- ✅ Lower resource usage
- ✅ More reliable
- ✅ Direct API calls only

**Without TCAD_API_KEY (fallback):**
- ⏱️ Slower (loads full webpage)
- 🔄 Extra network requests
- 🌐 Browser automation overhead
- ⚠️ Still works, just less efficient

## Note on Token Expiration

The TCAD API token may expire periodically. If scraping starts failing with auth errors:

1. Repeat Step 1 to get a fresh token
2. Update your `.env` file
3. Restart the server

## Related Files

- `src/lib/tcad-scraper.ts:128` - Token usage logic
- `src/config/index.ts:178` - Config definition
- `.env.example:130` - Environment variable documentation
