# Browser Warning Suppression - Debug Guide

## Problem Summary

When running queries like "commercial properties owned by smith", you were seeing these errors:

```
Deprecated feature used
Unload event listeners are deprecated and will be removed.
frame.js:21454

Uncaught (in promise) Error: A listener indicated an asynchronous response by
returning true, but the message channel closed before a response was received
```

## Root Cause

These are **NOT errors from your code**. They're browser console warnings from the **TCAD property search website** (travis.prodigycad.com) that your backend is automating with Playwright.

### Where They Come From

Your backend uses Playwright to:
1. **Auto-refresh API tokens** every 4 minutes (`token-refresh.service.ts`)
2. **Scrape property data** when queries are executed (`tcad-scraper.ts`)
3. Navigate to travis.prodigycad.com to capture authentication tokens

The TCAD website itself (or its dependencies) uses deprecated Chrome features that trigger these warnings.

## Solution Applied

Created a **reusable utility function** to suppress these harmless warnings across all Playwright page instances.

### Files Created

**`server/src/utils/browser-console-suppression.ts`** - Centralized utility for browser console filtering

### Files Updated

1. **`server/src/services/token-refresh.service.ts`** - Token refresh service
2. **`server/src/lib/tcad-scraper.ts`** - Main scraper (3 locations)
3. **`server/src/lib/fallback/dom-scraper.ts`** - Fallback scraper

### How It Works

The utility exports a `suppressBrowserConsoleWarnings()` function that:
- Filters out known harmless deprecation warnings
- Optionally logs other browser errors at debug level
- Uses a configurable list of suppression patterns

**Usage:**
```typescript
import { suppressBrowserConsoleWarnings } from '../utils/browser-console-suppression';

const page = await context.newPage();
suppressBrowserConsoleWarnings(page, logger);
```

**Key Features:**
- **DRY Principle**: No code duplication across multiple files
- **Maintainable**: Update suppression patterns in one place
- **Extensible**: Add new patterns via `addSuppressionPattern()`
- **Optional Logging**: Pass logger instance for debug output

## Verification Steps

### 1. Restart Your Backend Server

```bash
# If running via npm
npm run dev

# If running via Docker
docker-compose restart server

# If running via PM2
pm2 restart tcad-scraper-server
```

### 2. Test the Query

Run your query again:
```
commercial properties owned by smith
```

### 3. Check Logs

The warnings should **no longer appear** in your server logs. You should see clean output like:

```
[INFO] Starting scrape for: commercial properties owned by smith
[INFO] API scraping attempt 1 for search term: commercial properties owned by smith
[INFO] Using token from auto-refresh service
[INFO] API returned 45 total properties, fetched 45 results
```

## Additional Notes

### Why These Warnings Exist

- The TCAD website uses `beforeunload` or `unload` event listeners (deprecated in modern Chrome)
- Likely from analytics, session tracking, or legacy code
- Not fixable from your side since it's in their website

### When You Might See Browser Errors

Other browser errors **will still be logged** (at debug level) if they're:
- Not related to these specific deprecation warnings
- Actual errors that might affect scraping functionality

### Monitoring

If you want to see **all** browser console messages (for debugging):

1. Temporarily set log level to `debug` in your config
2. Or comment out the suppression code during debugging
3. Check `server/logs/` for detailed browser logs

## Future Considerations

### If TCAD Updates Their Website

If TCAD fixes these deprecation warnings, the suppression code will:
- Continue working (no harm)
- Simply have nothing to suppress

### If New Warnings Appear

**Option 1: Add to the utility (recommended)**

Edit `server/src/utils/browser-console-suppression.ts`:

```typescript
const SUPPRESSED_PATTERNS = [
  'Deprecated feature',
  'Unload event listeners',
  'message channel closed',
  'YOUR_NEW_WARNING_PATTERN',  // Add here
];
```

**Option 2: Add dynamically at runtime**

```typescript
import { addSuppressionPattern } from '../utils/browser-console-suppression';

addSuppressionPattern('YOUR_NEW_WARNING_PATTERN');
```

## Related Files

- **Utility Function**: `server/src/utils/browser-console-suppression.ts` ⭐ **Start here**
- **Token Refresh**: `server/src/services/token-refresh.service.ts`
- **Primary Scraper**: `server/src/lib/tcad-scraper.ts`
- **Fallback Scraper**: `server/src/lib/fallback/dom-scraper.ts`
- **Configuration**: `server/src/config/index.ts`

## Questions?

These warnings are completely harmless and don't affect:
- ✅ API functionality
- ✅ Query results
- ✅ Data accuracy
- ✅ Performance

They were just cluttering your logs and making it harder to spot real issues.
