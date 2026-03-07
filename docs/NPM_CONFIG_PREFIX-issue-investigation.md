# NPM_CONFIG_PREFIX Issue Investigation

**Date**: 2026-03-06

## Problem

Claude Code's Bash tool shell inherits `NPM_CONFIG_PREFIX=/Users/alyshialedlie/code-env/node`, which prevents nvm from loading:

```
nvm is not compatible with the "NPM_CONFIG_PREFIX" environment variable: currently set to "/Users/alyshialedlie/code-env/node"
```

Result: `node` and `npx` are not found in Claude Code shell sessions.

## Root Cause

- The Bash tool runs non-interactive `/bin/zsh`, which does not source `.zshrc` or `.zprofile`
- `NPM_CONFIG_PREFIX` is inherited from the parent process environment (the terminal that launched `claude`)
- `dotfiles/shell/common.sh:34` does `unset NPM_CONFIG_PREFIX` and then sources nvm — this works in interactive shells but never runs in Claude Code's non-interactive shell
- nvm refuses to load when `NPM_CONFIG_PREFIX` is set

## Investigation: Where is NPM_CONFIG_PREFIX set?

Searched all of the following — **none** set `NPM_CONFIG_PREFIX=~/code-env/node`:

| Location | Result |
|----------|--------|
| `~/dotfiles/` | Only `unset NPM_CONFIG_PREFIX` in `common.sh:34` |
| `~/.zshrc`, `~/.zprofile`, `~/.zshenv` | Not present (`.zshenv` didn't exist) |
| `~/.bashrc`, `~/.bash_profile`, `~/.profile` | Not present |
| `~/.npmrc` | No prefix config |
| `/etc/zprofile`, `/etc/zshrc`, `/etc/zshenv` | Not present |
| `~/.MacOSX/environment.plist` | Does not exist |
| `~/Library/LaunchAgents/*.plist` | Not present |
| iTerm preferences | Not present |
| `launchctl setenv` | Not present |
| `~/.local/` | Not present |
| `~/code-env/` | Not present |
| Claude Code binary (`~/.local/bin/claude`) | Compiled Bun binary, no match via `strings` |
| Kiro shell init | Not present (but Kiro history shows same issue was encountered) |

A clean `zsh --no-rcs --no-globalrcs` shell does **not** have the variable. It exists only in the inherited process environment — set by something upstream of `claude` that could not be identified.

## Fix

Created `~/.zshenv` which runs for **all** zsh contexts (interactive, non-interactive, login, non-login):

```bash
# Unset NPM_CONFIG_PREFIX so nvm can load (set by parent process/launchd)
unset NPM_CONFIG_PREFIX

# Load nvm for all zsh contexts (including non-interactive, e.g. Claude Code)
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"
```

## Existing Workaround

`~/.claude/node-shim.sh` resolves node from nvm's default alias and is used by all hooks (see `CLAUDE.md` Tools section). This predates the `.zshenv` fix and handles hook execution independently.

## Verification

```bash
# In Claude Code Bash tool (new session required):
which node   # /Users/alyshialedlie/.nvm/versions/node/v24.14.0/bin/node
which npx    # /Users/alyshialedlie/.nvm/versions/node/v24.14.0/bin/npx

# Manual verification (current session):
source ~/.zshenv && which node && node --version
```
