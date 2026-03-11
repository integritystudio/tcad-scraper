# Server Scripts

Shell wrappers and platform utilities for the TCAD Scraper backend.

## Scripts

### `verify-platform-deps.ts`

Verifies platform-specific dependencies are properly installed: Node.js version, Rollup native modules, TypeScript, and Prisma client.

```bash
cd server
npm run verify
```

### `run-enqueue-script.sh`

Wrapper around root `scripts/enqueue-batch.ts` for a single batch type.

```bash
./scripts/run-enqueue-script.sh trust
./scripts/run-enqueue-script.sh --list   # show available types
```

### `run-all-enqueue-scripts.sh`

Runs all batch enqueue types via `enqueue-batch.ts --all`.

```bash
./scripts/run-all-enqueue-scripts.sh
```

Both enqueue wrappers require Doppler to be configured.
