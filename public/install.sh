#!/usr/bin/env bash
# Hoos Planner — one-command install of the full version (web catalog + live Stellic/SIS tools for Claude).
#   curl -fsSL https://hoosplanner.zrk.ventures/install.sh | bash
# Safe to re-run. Installs into ~/hoos-planner, never asks for NetBadge, never stores credentials.
set -euo pipefail

HOOS_HOME="${HOOS_HOME:-$HOME/hoos-planner}"
HOOS_API="${HOOS_API:-https://hoosplanner.zrk.ventures}"
HOOS_REPO="${HOOS_REPO:-https://github.com/Zrk1212/hoos-planner.git}"
REGISTER="${HOOS_REGISTER:-1}"
TODO=()

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
todo() { TODO+=("$*"); printf '  \033[33mTODO:\033[0m %s\n' "$*"; }

say "Hoos Planner installer"
if [ "$(uname -s)" != "Darwin" ]; then
  note "This installer targets macOS (the live SIS/Stellic tools drive Chrome on your Mac)."
  note "On another OS you can still use the web app (${HOOS_API}) and the cloud connector (${HOOS_API}/api/mcp)."
  exit 1
fi

# 1. git + node
if ! command -v git >/dev/null 2>&1; then
  todo "git is missing. Run: xcode-select --install   (accept the dialog), then re-run this installer."
fi
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  if command -v brew >/dev/null 2>&1; then
    say "Installing Node.js with Homebrew"; brew install node >/dev/null
  else
    todo "Node.js 20+ is missing. Install it from https://nodejs.org (LTS) or with Homebrew (brew install node), then re-run."
  fi
fi

# 2. browser-harness (drives your own signed-in Chrome over the DevTools protocol)
if ! command -v browser-harness >/dev/null 2>&1; then
  say "Installing browser-harness (Python)"
  if command -v pipx >/dev/null 2>&1; then pipx install browser-harness >/dev/null 2>&1 || pipx upgrade browser-harness >/dev/null 2>&1 || true
  elif command -v python3 >/dev/null 2>&1; then python3 -m pip install --user --upgrade browser-harness >/dev/null 2>&1 || true
  fi
  if ! command -v browser-harness >/dev/null 2>&1; then
    if [ -x "$HOME/.local/bin/browser-harness" ]; then export PATH="$HOME/.local/bin:$PATH"; else
      todo "browser-harness did not install. Run: python3 -m pip install --user browser-harness   and make sure ~/.local/bin is on your PATH."
    fi
  fi
fi

# 3. the app
if command -v git >/dev/null 2>&1; then
  if [ -d "$HOOS_HOME/.git" ]; then say "Updating $HOOS_HOME"; git -C "$HOOS_HOME" pull --ff-only -q || note "git pull failed; continuing with the existing copy"
  else say "Downloading Hoos Planner to $HOOS_HOME"; git clone -q "$HOOS_REPO" "$HOOS_HOME"; fi
fi
if [ -d "$HOOS_HOME" ] && command -v node >/dev/null 2>&1; then
  say "Installing dependencies"; (cd "$HOOS_HOME" && npm install --no-audit --no-fund --silent)
  cat > "$HOOS_HOME/.env.local" <<ENV
# Friend mode: catalog and plan codes come from the public app; no database keys on this machine.
HOOS_API=${HOOS_API}
DEFAULT_TERM=1272
ENV
fi

# 4. register the MCP server with Claude
BIN="$HOOS_HOME/scripts/mcp-stdio.ts"
if [ "$REGISTER" = "1" ] && [ -f "$BIN" ]; then
  if command -v claude >/dev/null 2>&1; then
    say "Registering with Claude Code"
    claude mcp remove -s user hoos-planner >/dev/null 2>&1 || true
    claude mcp add -s user hoos-planner -e LIVE_BROWSER=1 -e LIVE_WRITES=1 -e HOOS_API="$HOOS_API" -- npx tsx "$BIN" >/dev/null && note "claude mcp: hoos-planner added (user scope)"
  else
    todo "Claude Code is not installed. Install it (npm install -g @anthropic-ai/claude-code) and re-run, or use the cloud connector ${HOOS_API}/api/mcp in claude.ai."
  fi
  DESKTOP_DIR="$HOME/Library/Application Support/Claude"
  if [ -d "$DESKTOP_DIR" ] && command -v python3 >/dev/null 2>&1; then
    say "Registering with the Claude desktop app"
    python3 - "$DESKTOP_DIR/claude_desktop_config.json" "$BIN" "$HOOS_API" <<'PY'
import json, os, sys
path, bin_, api = sys.argv[1:4]
cfg = {}
if os.path.exists(path):
    try: cfg = json.load(open(path))
    except Exception: cfg = {}
cfg.setdefault("mcpServers", {})["hoos-planner"] = {"command": "npx", "args": ["tsx", bin_], "env": {"LIVE_BROWSER": "1", "LIVE_WRITES": "1", "HOOS_API": api}}
json.dump(cfg, open(path, "w"), indent=2)
print("  claude_desktop_config.json updated")
PY
  fi
fi

# 5. self-test (catalog over the public API, no browser)
if [ -f "$BIN" ] && command -v node >/dev/null 2>&1; then
  say "Self-test"
  if (cd "$HOOS_HOME" && HOOS_API="$HOOS_API" npx tsx scripts/mcp-smoke.ts stdio >/dev/null 2>&1); then note "catalog tools OK"; else todo "The self-test failed. Run: cd $HOOS_HOME && npx tsx scripts/mcp-smoke.ts stdio   and share the output."; fi
fi

say "Next steps"
note "1. In Chrome open chrome://inspect/#remote-debugging and tick 'Allow remote debugging for this browser instance'."
note "2. Sign in to SIS (https://sisuva.admin.virginia.edu) and Stellic (https://login.stellic.virginia.edu) in Chrome yourself (NetBadge + Duo)."
note "3. Restart Claude Code / the Claude app so the hoos-planner tools load, then ask: 'read my Stellic audit and SIS cart and tell me what I still owe'."
note "   Cart changes always pop a macOS confirmation dialog; nothing is ever enrolled for you."
if [ ${#TODO[@]} -gt 0 ]; then say "Things to finish first:"; for t in "${TODO[@]}"; do note "- $t"; done; exit 2; fi
say "Done."
