# Branch Protection Setup Guide

This guide explains how to enable and configure branch protection rules for the main branch.

## Quick Setup

### Automated Setup (Recommended)

```bash
# Install GitHub CLI if not already installed
brew install gh  # macOS
# or visit: https://cli.github.com/

# Authenticate with GitHub
gh auth login

# Run setup script
./scripts/setup-branch-protection.sh
```

### Manual Setup via GitHub Web UI

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Branches**
3. Click **Add branch protection rule**
4. Configure the following settings:

## Branch Protection Rules

### Branch Name Pattern
```
main
```

### Protection Settings

#### 1. Require Pull Request Reviews
- ✅ **Enable**: Require a pull request before merging
- ✅ **Required approving reviews**: 1
- ✅ **Dismiss stale pull request approvals when new commits are pushed**
- ⬜ **Require review from Code Owners** (optional - enable if you have CODEOWNERS file)
- ⬜ **Require approval of the most recent reviewable push**

**Why:** Ensures code is reviewed before merging, maintaining code quality.

#### 2. Require Status Checks
- ✅ **Enable**: Require status checks to pass before merging
- ✅ **Require branches to be up to date before merging**

**Required status checks:**
- `CI Pipeline Success`
- `Lint & Type Check (ubuntu-latest)`
- `Build Verification (ubuntu-latest)`

**Why:** Ensures CI passes and code builds successfully on all platforms.

#### 3. Require Conversation Resolution
- ✅ **Enable**: Require conversation resolution before merging

**Why:** Ensures all PR comments are addressed before merging.

#### 4. Require Linear History
- ⬜ **Disable** (optional - enable for cleaner history)

**Why:** Prevents merge commits, forces rebase or squash merging.

#### 5. Include Administrators
- ⬜ **Disable**: Do not include administrators

**Why:** Allows admins to make emergency fixes if needed.

#### 6. Restrictions
- ⬜ **Disable**: No push restrictions

**Why:** Allows all team members with write access to create PRs.

#### 7. Force Push and Deletion Protection
- ✅ **Do not allow force pushes**
- ✅ **Do not allow deletions**

**Why:** Prevents accidental data loss and maintains git history integrity.

## Verification

### Check Protection Status

```bash
# Via GitHub CLI
gh api repos/:owner/:repo/branches/main/protection | jq

# Via Web UI
gh repo view --web -s /settings/branches
```

### Test Protection

1. Try to push directly to main:
   ```bash
   git checkout main
   git commit --allow-empty -m "Test commit"
   git push origin main
   ```
   **Expected:** Push should be rejected

2. Create a PR:
   ```bash
   git checkout -b test-branch
   git commit --allow-empty -m "Test PR"
   git push origin test-branch
   gh pr create
   ```
   **Expected:** PR should require approval and passing CI

## Common Scenarios

### Emergency Hotfix

If you need to bypass protection temporarily:

1. **Disable branch protection** (admin only):
   ```bash
   gh api \
     --method DELETE \
     "/repos/:owner/:repo/branches/main/protection"
   ```

2. Make your changes and push

3. **Re-enable protection**:
   ```bash
   ./scripts/setup-branch-protection.sh
   ```

### Updating Required Checks

When you add new CI workflows:

1. Update the protection rules:
   ```bash
   gh api \
     --method PUT \
     "/repos/:owner/:repo/branches/main/protection" \
     -f "required_status_checks[contexts][]=New Check Name"
   ```

2. Or use the web UI: Settings → Branches → Edit rule

### Adding Code Owners

1. Create `.github/CODEOWNERS` file:
   ```
   # Default owner for everything
   *       @your-username

   # Backend code
   /server/*   @backend-team

   # Frontend code
   /src/*      @frontend-team

   # CI/CD configuration
   /.github/*  @devops-team
   ```

2. Enable "Require review from Code Owners" in branch protection

## Troubleshooting

### "Branch protection rule failed"

**Problem:** Cannot enable branch protection

**Solutions:**
1. Ensure you have admin access to the repository
2. Verify the branch exists:
   ```bash
   git branch -r | grep main
   ```
3. Check GitHub CLI authentication:
   ```bash
   gh auth status
   ```

### "Status checks are not available"

**Problem:** Required status checks don't appear in the list

**Solutions:**
1. Run CI at least once to register the checks:
   ```bash
   git push origin main
   ```
2. Wait for workflows to complete
3. Refresh the settings page
4. Verify workflow names match exactly

### "Cannot push to protected branch"

**Problem:** Even admins cannot push

**Solutions:**
1. Check if "Include administrators" is enabled
2. Disable temporarily if needed (see Emergency Hotfix)
3. Create a PR instead (recommended)

### "Required reviewers not available"

**Problem:** Cannot get required number of reviews

**Solutions:**
1. Reduce required reviews to 1
2. Ensure team members have write access
3. Check if users are available

## Best Practices

### For Small Teams (1-3 developers)
- Require 1 approval
- Enable stale review dismissal
- Require CI to pass
- Allow admins to bypass (for emergencies)

### For Medium Teams (4-10 developers)
- Require 1-2 approvals
- Enable Code Owners reviews
- Require CI to pass
- Require conversation resolution
- Enable linear history (optional)

### For Large Teams (10+ developers)
- Require 2+ approvals
- Require Code Owners reviews
- Strict status checks (must be up to date)
- Require conversation resolution
- Enable linear history
- Restrict who can push

## Monitoring

### Check Protection Status Regularly

Add to your monitoring scripts:

```bash
# Check if protection is enabled
gh api repos/:owner/:repo/branches/main/protection \
  --jq '.required_status_checks.strict' || echo "Protection disabled!"
```

### Audit Branch Protection Changes

GitHub tracks changes to branch protection in the audit log:

```bash
# View recent protection changes
gh api /repos/:owner/:repo/events | jq '.[] | select(.type == "BranchProtectionRuleEvent")'
```

## References

- [GitHub Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [Required Status Checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)
- [Code Owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

## Support

If you encounter issues:

1. Check this documentation
2. Review GitHub's official docs
3. Check repository settings
4. Contact repository admin
5. Create an issue in this repository
