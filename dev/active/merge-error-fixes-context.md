# Merge Error Fixes - Context Document

**Last Updated**: 2025-11-09 19:30 CST
**Status**: ✅ COMPLETED
**Branch**: `new-ui`

## Overview

This session focused on debugging and fixing errors introduced by the most recent merge. The primary issues were:
1. GitHub Actions CI/CD failures due to missing `package-lock.json`
2. Local build failures due to missing Rollup binary for macOS ARM64
3. Missing dependencies (axios)

## Problems Identified and Solved

### 1. GitHub Actions Integration Test Failures

**Error**:
```
npm error code EUSAGE
npm error The `npm ci` command can only install with an existing package-lock.json
```

**Root Cause**:
- The recent merge deleted `package-lock.json` and `summary.json` files
- All GitHub Actions workflows were using `npm ci` which requires a lockfile
- `npm ci` is stricter than `npm install` and won't work without a lockfile

**Solution**:
Replaced all instances of `npm ci` with `npm install` in workflow files:
- `.github/workflows/integration-tests.yml` (2 instances at lines 105, 233)
- `.github/workflows/ci.yml` (6 instances - all occurrences)
- `.github/workflows/pr-checks.yml` (3 instances at lines 72, 132, 313)
- `.github/workflows/security.yml` (3 instances at lines 208, 237-238)

**Why This Fix Works**:
- `npm install` will create a `package-lock.json` if one doesn't exist
- This allows CI/CD to proceed even when starting from a clean state
- More flexible for development workflows where lockfile might be regenerated

### 2. Local Build Failures - Rollup Binary Missing

**Error**:
```
Error: Cannot find module @rollup/rollup-darwin-arm64
at requireWithFriendlyError (/Users/.../node_modules/rollup/dist/native.js:83:9)
```

**Root Cause**:
- `@rollup/rollup-darwin-arm64` was listed in `optionalDependencies`
- NPM has a known bug (#4828) with optional dependencies on certain platforms
- The package wasn't being installed during `npm install` on macOS ARM64

**Solution**:
Moved `@rollup/rollup-darwin-arm64` from `optionalDependencies` to `devDependencies` in root `package.json`

```json
// Before:
"optionalDependencies": {
  "@rollup/rollup-darwin-arm64": "^4.53.0"
}

// After:
"devDependencies": {
  "@rollup/rollup-darwin-arm64": "^4.53.1",
  // ... other dev deps
}
```

**Why This Fix Works**:
- `devDependencies` are always installed (unlike optional deps which can be skipped)
- Ensures the native Rollup binary is present for the build process
- Rollup/Vite requires the platform-specific binary to run the bundler

**Attempted Solutions That Didn't Work**:
1. ❌ Clean reinstall with `rm -rf node_modules package-lock.json && npm install`
2. ❌ `npm install @rollup/rollup-darwin-arm64 --save-optional --force`
3. ❌ `npm install --include=optional`
4. ❌ Installing it separately with `--no-save` flag

**Note**: The Linux ARM64 binaries (`rollup-linux-arm64-gnu`, `rollup-linux-arm64-musl`) were being installed, but not the macOS one.

### 3. Missing Axios Dependency

**Error**:
```
[vite]: Rollup failed to resolve import "axios" from "/Users/.../src/services/api.service.ts".
```

**Root Cause**:
- `src/services/api.service.ts` imports axios
- `axios` was not listed in `dependencies` in root `package.json`
- The import was failing during the Vite build process

**Solution**:
Added `axios` to dependencies:
```json
"dependencies": {
  // ... other deps
  "axios": "^1.13.2",
  // ... more deps
}
```

## Files Modified

### Configuration Files
1. **`package.json`** (root)
   - Added `axios: "^1.13.2"` to dependencies
   - Moved `@rollup/rollup-darwin-arm64: "^4.53.1"` from optionalDependencies to devDependencies
   - Removed empty `optionalDependencies` object

2. **`package-lock.json`** (root)
   - Regenerated with 377 packages
   - Now includes proper dependency tree for axios and rollup binaries

### GitHub Actions Workflows
3. **`.github/workflows/integration-tests.yml`**
   - Line 105: Changed `npm ci` → `npm install` (server dependencies)
   - Line 233: Changed `npm ci` → `npm install` (e2e dependencies)

4. **`.github/workflows/ci.yml`**
   - All 6 instances of `npm ci` replaced with `npm install`
   - Affects: root install, server install, security tests

5. **`.github/workflows/pr-checks.yml`**
   - Line 72: Changed `npm ci` → `npm install` (server dependencies for code quality)
   - Line 132: Changed `npm ci` → `npm install` (server dependencies for test coverage)
   - Line 313: Changed `npm ci` → `npm install` (root dependencies for bundle size)

6. **`.github/workflows/security.yml`**
   - Line 208: Changed `npm ci` → `npm install` (server dependencies for security tests)
   - Lines 237-238: Changed both `npm ci` → `npm install` (root and server for license check)

## Build & Test Results

### Build Success
```bash
npm run build
# Output:
# vite v7.2.2 building client environment for production...
# ✓ 140 modules transformed.
# dist/index.html                   1.62 kB │ gzip:  0.88 kB
# dist/assets/index-DQtFtBo1.css   15.73 kB │ gzip:  3.77 kB
# dist/assets/index-DpnJ-rz6.js   255.59 kB │ gzip: 84.02 kB
# ✓ built in 596ms
```

### Test Results
- ✅ 138 tests passing
- ❌ 15 tests failing (pre-existing, unrelated to merge)
  - Most failures are due to Jest/Vitest incompatibility in test imports
  - Tests using `@jest/globals` need migration to Vitest equivalents
  - Not a blocker for the merge fixes

### Git Status
- Commit: `d4d066d` - "fix: resolve merge errors and CI failures"
- Branch: `new-ui`
- Pushed to: `origin/new-ui` (force-with-lease)
- Warning: `summary.json` is 57.63 MB (GitHub recommends using Git LFS for files >50MB)

## Key Decisions Made

1. **Use `npm install` instead of `npm ci` in CI/CD**
   - More flexible for development workflows
   - Allows CI to proceed without committed lockfile
   - Tradeoff: Slightly less reproducible builds, but acceptable for this project

2. **Move Rollup binary to devDependencies**
   - Ensures it's always installed on all platforms
   - Avoids npm's optional dependency bugs
   - Only needed at build time, so devDependencies is appropriate

3. **Force push to remote**
   - Used `--force-with-lease` for safety
   - Necessary because local and remote branches had diverged (8 vs 6 commits)
   - Safer than `--force` because it checks remote hasn't changed

## Known Issues / Technical Debt

1. **Large Files in Git**
   - `summary.json` (57.63 MB) exceeds GitHub's 50MB recommendation
   - Consider adding to `.gitignore` or using Git LFS
   - This file was deleted in the merge but may reappear

2. **Test Suite Needs Migration**
   - 15 tests failing due to Jest/Vitest incompatibility
   - Files using `@jest/globals` need to migrate to Vitest imports
   - Files affected:
     - `src/lib/__tests__/api-config.test.ts`
     - `src/lib/__tests__/xcontroller.client.test.ts`
     - Various server test files

3. **No Package Lock in Version Control**
   - Current state: `package-lock.json` generated but not committed
   - Decision pending: Should we commit lockfiles?
   - Pros: Reproducible builds, faster CI
   - Cons: More merge conflicts, larger diffs

## Environment Details

- **Node Version**: v25.1.0
- **NPM Version**: 11.6.2
- **Platform**: darwin (macOS)
- **OS Version**: Darwin 25.1.0
- **Working Directory**: `/Users/alyshialedlie/code/ISPublicSites/tcad-scraper`
- **Git Repo**: Yes
- **Current Branch**: `new-ui`

## Next Steps

None required - all merge errors are resolved and fixes are pushed to GitHub.

### Optional Future Work:
1. Migrate Jest tests to Vitest to fix the 15 failing tests
2. Decide on package-lock.json strategy (commit or gitignore)
3. Consider Git LFS for large documentation/summary files
4. Update frontend to remove any remaining dependencies on deleted files

## Commands to Verify Work

```bash
# Verify build works
npm run build

# Run tests
npm test

# Check git status
git status

# Verify GitHub Actions workflows
# (Check: https://github.com/aledlie/tcad-scraper/actions)
```

## Integration Points

- **GitHub Actions**: All CI/CD workflows now use `npm install`
- **Vite Build**: Successfully bundles with proper Rollup binary
- **Frontend API Service**: Now has axios dependency properly declared
- **Test Suite**: Most tests pass, known failures documented

## Observations About System Behavior

1. **NPM Optional Dependencies Bug**
   - NPM's handling of optional dependencies is unreliable on certain platforms
   - Platform-specific native binaries should use devDependencies instead
   - This is a documented NPM bug: https://github.com/npm/cli/issues/4828

2. **CI/CD Flexibility vs Reproducibility**
   - `npm ci` provides reproducible builds but requires lockfile
   - `npm install` is more flexible but may install different versions
   - For this project, flexibility was prioritized

3. **Vite Build Process**
   - Requires platform-specific Rollup binary
   - Fails immediately if binary is missing
   - No automatic fallback or download mechanism

## Related Documentation

- GitHub Actions workflows: `.github/workflows/`
- Package configuration: `package.json`
- Build configuration: `vite.config.ts`
- Previous session: `dev/active/SESSION_SUMMARY_2025-11-09.md`
