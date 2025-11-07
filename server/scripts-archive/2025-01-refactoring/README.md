# Archived Scripts - January 2025 Refactoring

**Date**: January 2025
**Reason**: Phase 2 - Script Organization and Consolidation

These scripts were consolidated into 4 organized CLI tools in `/server/src/cli/`:

## Consolidated Scripts

### Queue Management → `queue-manager.ts`
- **add-priority-jobs.ts** → `npm run queue:add-priority`
- **stop-all-jobs.ts** → `npm run queue:stop`
- **aggressive-cleanup.ts** → `npm run queue:cleanup`

### Queue Analysis → `queue-analyzer.ts`
- **analyze-queue.ts** → `npm run analyze:queue`
- **analyze-successful-terms.ts** → `npm run analyze:success`
- **analyze-zero-results.ts** → `npm run analyze:failures`
- **check-queue-status.ts** → `npm run queue:status` or `npm run analyze:live`
- **optimize-queue.ts** → (functionality merged into other commands)

### Data Cleanup → `data-cleaner.ts`
- **remove-all-duplicates.ts** → `npm run clean:queue-duplicates`

### Database Stats → `db-stats.ts`
- **check-db-stats.ts** → `npm run stats:summary`
- **check-property-count.ts** → `npm run stats:properties`
- **check-rate.ts** → `npm run stats:rate`

### Utility Scripts (Archived)
- **build-search-term-map.ts** - One-time utility for building search term maps
- **monitor-and-optimize.ts** - Monitoring utility (functionality in Bull Board)
- **test-queue-with-token.ts** - Test script (replaced by proper test suite)

## New CLI Tools

### Queue Manager
```bash
npm run queue                    # Show help
npm run queue:status             # Show queue status
npm run queue:add-priority       # Add priority jobs
npm run queue:stop --confirm     # Stop all pending jobs
npm run queue:cleanup            # Clean up failed/empty jobs
```

### Queue Analyzer
```bash
npm run analyze                  # Show help
npm run analyze:success          # Analyze successful terms
npm run analyze:failures         # Analyze zero-result jobs
npm run analyze:queue            # Analyze queue composition
npm run analyze:live             # Live status monitoring
```

### Data Cleaner
```bash
npm run clean                         # Show help
npm run clean:queue-duplicates        # Remove duplicate queue jobs
npm run clean:property-duplicates     # Find/remove property duplicates
npm run clean:search-terms --short    # Remove problematic terms
npm run clean:failed-jobs             # Clean old failed jobs
```

### Database Stats
```bash
npm run stats                    # Show help
npm run stats:summary            # Comprehensive overview
npm run stats:properties         # Property statistics
npm run stats:rate               # Scraping rate analysis
npm run stats:jobs               # Job statistics
```

## Benefits

- **Discoverable**: All commands have `--help` flags
- **Organized**: Logical grouping by function
- **Consistent**: Unified command patterns
- **Safer**: Dry-run modes and confirmation prompts
- **Documented**: Clear usage examples

## Restoring Old Scripts

If needed, these scripts can be restored from this archive or from git history:

```bash
# Restore from archive
cp scripts-archive/2025-01-refactoring/[script-name].ts .

# Or restore from git
git checkout <commit-hash> -- [script-name].ts
```

---

**Total Scripts Archived**: 15
**Total New CLI Tools**: 4
**Line Reduction**: ~1,500 lines (consolidated functionality)
