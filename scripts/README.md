# Build Scripts

This directory contains build-time scripts for the TCAD Scraper project.

## generate-build-constants.ts

Generates build-time constants from the database for use in the frontend.

### Purpose

Instead of making API calls at runtime to fetch the property count, this script:
1. Connects to the production database at build time
2. Fetches the current property count
3. Generates a TypeScript constants file (`src/constants/build.ts`)
4. Makes the count available as a static constant in the frontend

### Usage

The script is automatically run as a `prebuild` step:

```bash
npm run build  # Automatically runs prebuild first
```

Or run manually:

```bash
doppler run -- npx tsx scripts/generate-build-constants.ts
```

### How It Works

1. **Imports Prisma Client** from `server/node_modules/@prisma/client`
2. **Connects to database** using `DATABASE_URL` from environment
3. **Queries property count** with `prisma.property.count()`
4. **Generates constants file** at `src/constants/build.ts`

### Fallback Behavior

If the database is unavailable (e.g., in GitHub Actions without Tailscale):
- Uses `FALLBACK_PROPERTY_COUNT` environment variable if set
- Otherwise defaults to hardcoded value (418,823 as of Nov 26, 2025)
- Generates file with approximate count
- Build succeeds without database connection

### GitHub Actions Integration

The deployment workflow (`.github/workflows/deploy.yml`):
1. Installs server dependencies
2. Generates Prisma client
3. Exports `DATABASE_URL` from Doppler
4. Runs `npm run build` (which triggers the prebuild script)

If database is unavailable, uses fallback count.

### Output Format

Generated file (`src/constants/build.ts`):

```typescript
export const BUILD_CONSTANTS = {
  TOTAL_PROPERTIES: 418823,
  BUILD_TIMESTAMP: '2025-11-26T22:58:41.135Z',
  TOTAL_PROPERTIES_FORMATTED: '418,823',
} as const;
```

### Benefits

1. **Performance**: No runtime API call needed
2. **Reliability**: Property count available even if API is down
3. **Caching**: Value is embedded in the build, fully cacheable
4. **Accuracy**: Updated with every deployment

### Maintenance

The fallback count should be updated periodically in the script:

```typescript
// Update this value when property count increases significantly
const fallbackCount = process.env.FALLBACK_PROPERTY_COUNT
  ? parseInt(process.env.FALLBACK_PROPERTY_COUNT, 10)
  : 418823; // Update this number periodically
```

Or set `FALLBACK_PROPERTY_COUNT` in Doppler for production builds.
