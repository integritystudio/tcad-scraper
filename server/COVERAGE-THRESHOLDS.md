# Coverage Threshold Roadmap

**Last Updated**: 2025-11-08
**Current Coverage**: 36.53% statements, 33.11% branches, 38.52% functions, 36.48% lines
**Target Coverage**: 70% statements, 65% branches, 70% functions, 70% lines

## Current Thresholds (jest.config.js)

```javascript
coverageThreshold: {
  global: {
    statements: 35,
    branches: 32,
    functions: 37,
    lines: 35,
  },
}
```

## Incremental Threshold Increases

As test coverage improves, update the thresholds in `jest.config.js` according to this roadmap:

### Phase 1: ✅ CURRENT (35% baseline)
- **Statements**: 35%
- **Branches**: 32%
- **Functions**: 37%
- **Lines**: 35%
- **Status**: Active since 2025-11-08
- **Purpose**: Prevent regression from current baseline

### Phase 2: Target when coverage reaches 45%
- **Statements**: 45%
- **Branches**: 42%
- **Functions**: 47%
- **Lines**: 45%
- **When to update**: After completing service layer tests
- **Expected**: After Phase 4 of test coverage improvement

### Phase 3: Target when coverage reaches 55%
- **Statements**: 55%
- **Branches**: 52%
- **Functions**: 57%
- **Lines**: 55%
- **When to update**: After TCAD scraper tests
- **Expected**: Mid-way through coverage improvement project

### Phase 4: Target when coverage reaches 65%
- **Statements**: 65%
- **Branches**: 62%
- **Functions**: 67%
- **Lines**: 65%
- **When to update**: After queue and utility tests
- **Expected**: Near completion of coverage improvement project

### Phase 5: FINAL TARGET (70%)
- **Statements**: 70%
- **Branches**: 65%
- **Functions**: 70%
- **Lines**: 70%
- **When to update**: After reaching 70% actual coverage
- **Expected**: Project completion

## How to Update Thresholds

1. **Run coverage report**:
   ```bash
   npm test -- --coverage
   ```

2. **Check if actual coverage exceeds next phase target**:
   - Look for the "All files" line in the coverage summary
   - Compare to the next phase targets above

3. **Update jest.config.js**:
   ```bash
   # Edit server/jest.config.js
   # Update the coverageThreshold.global values
   ```

4. **Verify tests still pass**:
   ```bash
   npm test -- --coverage
   ```

5. **Update this document**:
   - Mark the completed phase with ✅
   - Update "CURRENT" marker
   - Update "Last Updated" date

6. **Commit the changes**:
   ```bash
   git add server/jest.config.js server/COVERAGE-THRESHOLDS.md
   git commit -m "chore: increase coverage thresholds to <percentage>%"
   ```

## Why Incremental Increases?

- **Prevents shock**: Jumping directly to 70% would fail CI immediately
- **Tracks progress**: Each phase represents meaningful improvement
- **Maintains quality**: Always enforces minimum standards
- **Motivates team**: Visible milestones toward the goal

## Coverage Threshold Enforcement

Thresholds are enforced in:
- **Local development**: `npm test -- --coverage` will fail if below thresholds
- **CI/CD pipeline**: GitHub Actions runs with coverage checks
- **Pre-commit hooks**: Can be added for additional enforcement (optional)

## Related Documentation

- Test coverage improvement: `dev/active/test-coverage-improvement-tasks.md`
- Test status: `docs/TEST-STATUS.md`
- Testing guide: `TESTING.md`
- CI/CD documentation: `docs/CI-CD.md`

## Notes

- Branch coverage is typically lower than statement coverage, hence lower targets
- Thresholds are set ~1-2% below actual coverage to allow minor fluctuations
- Focus on quality tests, not just hitting numbers
- Some files (config, types, scripts) are excluded from coverage metrics
