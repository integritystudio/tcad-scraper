# Branch Protection

GitHub branch protection rules for `main`.

## Current Rules

| Rule | Setting |
|------|---------|
| Require PR before merging | Yes (1 approval) |
| Dismiss stale approvals on new commits | Yes |
| Require status checks to pass | Yes |
| Required checks | `CI Pipeline Success`, `Lint & Type Check`, `Build Verification` |
| Require conversation resolution | Yes |
| Allow force pushes | No |
| Allow deletions | No |
| Include administrators | No (admins can bypass for emergencies) |

## Setup

```bash
# Automated (uses gh CLI)
./scripts/setup-branch-protection.sh

# Verify
gh api repos/:owner/:repo/branches/main/protection | jq
```

## Emergency Bypass

```bash
# Disable (admin only)
gh api --method DELETE "/repos/:owner/:repo/branches/main/protection"

# Re-enable after fix
./scripts/setup-branch-protection.sh
```
