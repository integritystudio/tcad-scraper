# Production Database Connection Debug Summary

**Date**: November 26, 2025
**Issue**: Production queries returning empty results

## Root Cause

The production **frontend** is using the wrong API URL. The built JavaScript in `/dist` contains:
```javascript
sS="http://localhost:3001/api"
```

Instead of the production API URL:
```
https://api.alephatx.info/api
```

## Investigation Results

### ✅ Database Connection - WORKING
- **Status**: Connected successfully
- **Properties**: 418,823 records
- **Connection String**: `postgresql://postgres:postgres@hobbes:5432/tcad_scraper`
- **Tailscale**: Active and working
- **Test Query**: Successfully retrieved sample properties

### ✅ Production API - WORKING
All endpoints tested successfully:
```bash
# Default query
curl "https://api.alephatx.info/api/properties?limit=5"
# Returns 5 properties ✓

# Search query
curl "https://api.alephatx.info/api/properties?searchTerm=trust&limit=5"
# Returns 5 properties ✓

# City filter
curl "https://api.alephatx.info/api/properties?city=AUSTIN&limit=5"
# Returns 5 properties ✓

# Stats endpoint
curl "https://api.alephatx.info/api/properties/stats"
# Returns {"totalProperties": 418823, ...} ✓
```

### ❌ Frontend Build - INCORRECT API URL
The production build in `/dist` folder contains hardcoded `localhost:3001/api` instead of production URL.

## Issue Details

**File**: `src/services/api.service.ts:6`
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
```

**GitHub Actions**: `.github/workflows/deploy.yml:57`
The workflow correctly sets:
```bash
export VITE_API_URL=$(doppler secrets get VITE_API_URL --plain 2>/dev/null || echo "https://api.alephatx.info/api")
```

**Problem**: The `VITE_API_URL` environment variable is either:
1. Not being set during build
2. Not being passed to Vite properly
3. Doppler secret doesn't exist

## Solution

### Option 1: Add VITE_API_URL to Doppler
```bash
doppler secrets set VITE_API_URL="https://api.alephatx.info/api" --project integrity-studio --config dev
```

### Option 2: Fix GitHub Actions to ensure variable is set
The workflow already has fallback logic, but may need verification that it's executing correctly.

### Option 3: Set default in code to production URL
Change `api.service.ts:6` to default to production:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.alephatx.info/api';
```

## Verification Steps

After deploying fix:
```bash
# 1. Check built JavaScript contains production URL
grep -r "api.alephatx.info" dist/

# 2. Verify deployment
curl https://alephatx.github.io/tcad-scraper/

# 3. Check browser network tab
# Should show requests to https://api.alephatx.info/api
```

## Files Investigated

- ✅ `server/prisma/schema.prisma` - Correct schema
- ✅ `server/src/lib/prisma.ts` - Correct client initialization
- ✅ `server/src/controllers/property.controller.ts` - Correct API logic
- ✅ `src/services/api.service.ts` - Found issue (wrong default URL)
- ✅ `.github/workflows/deploy.yml` - Has correct fallback but may not execute
- ✅ Database - 418,823 properties, all queries working
- ✅ Production API - All endpoints returning data correctly

## Recommended Immediate Action

**Run Doppler command to set production API URL:**
```bash
doppler run -- npm run build
```

Or rebuild and redeploy with explicit env var:
```bash
export VITE_API_URL="https://api.alephatx.info/api"
npm run build
```

Then commit and push to trigger GitHub Actions deployment.

## Resolution

**Date**: November 26, 2025

✅ **FIXED**: `VITE_API_URL` has been set in Doppler:
```bash
# Set in both dev and prd configs
doppler secrets set VITE_API_URL="https://api.alephatx.info/api" --project integrity-studio --config dev
doppler secrets set VITE_API_URL="https://api.alephatx.info/api" --project integrity-studio --config prd
```

**Next Step**: Push a commit to trigger GitHub Actions deployment with the correct API URL.
