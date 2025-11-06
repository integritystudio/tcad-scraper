# Fallback Scraping Mechanisms

This directory contains **FALLBACK scraping methods** that are used only when the primary API-based scraping fails.

## ⚠️ Important Limitations

All fallback methods in this directory have significant limitations and should **ONLY** be used as a last resort when the primary method fails.

## Directory Structure

### `dom-scraper.ts`
**DOM-based property scraping - DEPRECATED FALLBACK**

- **Limitation**: Maximum 20 results per search
- **Reason**: AG Grid pagination restrictions in the UI
- **Performance**: Slower than API method (requires individual page scraping)
- **Fragility**: Breaks if UI HTML structure changes

**When it's used:**
- API authentication failures
- API endpoint changes
- Network issues preventing API access
- Emergency data retrieval

## Primary vs Fallback Methods

### Primary Method (RECOMMENDED)
Location: `/server/src/lib/tcad-scraper.ts::scrapePropertiesViaAPI()`

Benefits:
- ✅ Up to 1000 results per API call
- ✅ Fast and efficient
- ✅ Automatic authentication handling
- ✅ Adaptive page sizing
- ✅ Reliable data structure

### Fallback Method (USE ONLY IF PRIMARY FAILS)
Location: `/server/src/lib/fallback/dom-scraper.ts::scrapeDOMFallback()`

Limitations:
- ⚠️ Maximum 20 results (AG Grid pagination limit)
- ⚠️ Slower performance
- ⚠️ Higher resource usage
- ⚠️ More brittle (depends on UI structure)

## How the Fallback System Works

The main scraper class provides a `scrapePropertiesWithFallback()` method that:

1. **Attempts primary method** (API-based scraping)
2. **On failure, automatically falls back** to DOM scraping
3. **Logs clear warnings** about which method is being used
4. **Returns whichever method succeeds**

```typescript
// Usage example
const scraper = new TCADScraper();
await scraper.initialize();

// This will try API first, then DOM if API fails
const properties = await scraper.scrapePropertiesWithFallback('search term');
```

## Logging and Monitoring

The fallback system provides clear log messages:

```
🚀 Attempting primary method: API-based scraping
✅ Primary method succeeded: Retrieved 150 properties
```

Or if fallback is triggered:

```
🚀 Attempting primary method: API-based scraping
❌ Primary API method failed after all retries
🔄 Falling back to DOM-based scraping (limited to 20 results)
✅ Fallback method succeeded: Retrieved 20 properties (max 20)
```

## Adding New Fallback Methods

If you need to add new fallback methods:

1. Create a new file in this directory (e.g., `another-scraper.ts`)
2. Export a function with clear documentation about its limitations
3. Update the main scraper's fallback chain
4. Document the method in this README

## Testing Fallback Methods

To test the fallback mechanism:

```bash
# Set environment to intentionally break API method
TCAD_API_KEY=invalid_token npm run test:scraper

# The system should automatically fall back to DOM scraping
```

## Performance Comparison

| Method | Results | Speed | Resource Usage | Reliability |
|--------|---------|-------|----------------|-------------|
| API (Primary) | Up to 1000 | Fast | Low | High |
| DOM (Fallback) | Max 20 | Slow | High | Medium |

## When to Update Fallback Methods

Update fallback methods when:
- The TCAD website UI changes significantly
- New data fields need to be extracted
- Alternative scraping approaches become available
- Performance improvements can be made

## Related Files

- `/server/src/lib/tcad-scraper.ts` - Main scraper with primary method
- `/server/src/lib/fallback/dom-scraper.ts` - DOM fallback implementation
- `/server/src/lib/scraper.queue.ts` - Job queue that uses the scraper
- `/server/src/routes/properties.ts` - API routes that trigger scraping
