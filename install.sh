#!/bin/bash
set -euo pipefail

# founder-stack installer
# Copies all components to ~/.claude/ and configures hooks + statusline

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
SKIP_GSTACK_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --skip-gstack-build) SKIP_GSTACK_BUILD=true ;;
    --help|-h)
      echo "Usage: ./install.sh [--skip-gstack-build]"
      echo "  --skip-gstack-build  Skip rebuilding the gstack browse binary"
      exit 0
      ;;
  esac
done

echo "founder-stack installer"
echo "======================="
echo "Source: $SCRIPT_DIR"
echo "Target: $CLAUDE_DIR"
echo ""

# --- Copy components ---

echo "[1/8] Copying agents..."
mkdir -p "$CLAUDE_DIR/agents"
cp -R "$SCRIPT_DIR/agents"/*.md "$CLAUDE_DIR/agents/" 2>/dev/null || true

echo "[2/8] Copying commands..."
mkdir -p "$CLAUDE_DIR/commands"
cp -R "$SCRIPT_DIR/commands"/*.md "$CLAUDE_DIR/commands/" 2>/dev/null || true

echo "[3/8] Copying rules..."
cp -R "$SCRIPT_DIR/rules" "$CLAUDE_DIR/"

echo "[4/8] Copying skills..."
# Copy all skill directories (preserves gstack as a dir, kit-* as dirs, ECC skills as dirs)
for skill_dir in "$SCRIPT_DIR/skills"/*/; do
  skill_name=$(basename "$skill_dir")
  # Skip node_modules, .git dirs inside skills
  if [ "$skill_name" = "node_modules" ] || [ "$skill_name" = ".git" ]; then
    continue
  fi
  mkdir -p "$CLAUDE_DIR/skills/$skill_name"
  cp -R "$skill_dir"* "$CLAUDE_DIR/skills/$skill_name/" 2>/dev/null || true
done

echo "[5/8] Copying scripts and hooks..."
mkdir -p "$CLAUDE_DIR/scripts/hooks" "$CLAUDE_DIR/scripts/lib"
cp -R "$SCRIPT_DIR/scripts/hooks"/* "$CLAUDE_DIR/scripts/hooks/" 2>/dev/null || true
cp -R "$SCRIPT_DIR/scripts/lib"/* "$CLAUDE_DIR/scripts/lib/" 2>/dev/null || true
# Copy top-level scripts
for f in "$SCRIPT_DIR/scripts"/*.js "$SCRIPT_DIR/scripts"/*.sh; do
  [ -f "$f" ] && cp "$f" "$CLAUDE_DIR/scripts/"
done

echo "[6/9] Copying agent docs and templates..."
mkdir -p "$CLAUDE_DIR/agent_docs"
cp -R "$SCRIPT_DIR/agent_docs"/*.md "$CLAUDE_DIR/agent_docs/" 2>/dev/null || true

echo "[6.5/9] Copying design systems..."
mkdir -p "$CLAUDE_DIR/design-systems"
cp -R "$SCRIPT_DIR/design-systems"/*.md "$CLAUDE_DIR/design-systems/" 2>/dev/null || true

# --- gstack setup ---

if [ "$SKIP_GSTACK_BUILD" = false ] && [ -f "$CLAUDE_DIR/skills/gstack/setup" ]; then
  echo "[7/9] Building gstack browse binary..."
  cd "$CLAUDE_DIR/skills/gstack"
  if command -v bun &>/dev/null; then
    bash setup 2>&1 | tail -5
  else
    echo "  Skipping: bun not found (install bun for browser QA)"
  fi
  cd "$SCRIPT_DIR"
else
  echo "[7/9] Skipping gstack build (--skip-gstack-build or no setup script)"
fi

# --- Create gstack symlinks ---

echo "  Creating gstack skill symlinks..."
cd "$CLAUDE_DIR/skills"
for skill_dir in gstack/*/; do
  skill_name=$(basename "$skill_dir")
  # Skip non-skill dirs
  case "$skill_name" in
    node_modules|.git|browse|dist|src) continue ;;
  esac
  # Only symlink if it has a SKILL.md
  if [ -f "gstack/$skill_name/SKILL.md" ]; then
    ln -snf "gstack/$skill_name" "$skill_name" 2>/dev/null || true
  fi
done
cd "$SCRIPT_DIR"

# --- Merge hooks + statusline into settings.json ---

echo "[9/9] Configuring settings.json..."
node -e "
const fs = require('fs');
const path = require('path');

const settingsPath = path.join('$CLAUDE_DIR', 'settings.json');
const hooksPath = path.join('$SCRIPT_DIR', 'hooks', 'hooks.json');

// Read existing settings
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}

// Read hooks from source (hooks.json may have a top-level 'hooks' key or be flat)
let hooksRaw = {};
try { hooksRaw = JSON.parse(fs.readFileSync(hooksPath, 'utf8')); } catch {}
const hooksConfig = hooksRaw.hooks || hooksRaw;

// Replace hooks with canonical version from hooks.json (deduplication by replacement)
// Hooks in hooks.json use 'id' fields — we remove any existing hook with the same id,
// then remove old-format hooks (no id, command uses run-with-flags-shell.sh or the
// old direct script paths), and finally add all canonical hooks fresh.
if (!settings.hooks) settings.hooks = {};

// Build set of canonical ids to replace
const canonicalIds = new Set();
for (const entries of Object.values(hooksConfig)) {
  if (!Array.isArray(entries)) continue;
  for (const entry of entries) {
    if (entry.id) canonicalIds.add(entry.id);
  }
}

// Remove stale hooks: same id (old version) or old-format hooks that canonical replaces
for (const event of Object.keys(settings.hooks)) {
  settings.hooks[event] = (settings.hooks[event] || []).filter(entry => {
    // Remove if it has a canonical id (will be re-added fresh)
    if (entry.id && canonicalIds.has(entry.id)) return false;
    // Remove old-format hooks: direct run-with-flags-shell.sh or direct script path calls
    const cmd = (entry.hooks || []).map(h => h.command || '').join(' ');
    if (cmd.includes('run-with-flags-shell.sh')) return false;
    if (cmd.includes('auto-tmux-dev.js')) return false;
    if (cmd.includes('block-no-verify')) return false;
    // Remove hooks added by old installer (direct path to ~/.claude/scripts/hooks/*.js
    // without the plugin-hook-bootstrap loader, i.e. no CLAUDE_PLUGIN_ROOT resolution)
    if (/node "\/[^"]+\/\.claude\/scripts\/hooks\/run-with-flags\.js"/.test(cmd)) return false;
    return true;
  });
}

// Add all canonical hooks fresh
for (const [event, entries] of Object.entries(hooksConfig)) {
  if (!Array.isArray(entries)) continue;
  if (!settings.hooks[event]) settings.hooks[event] = [];
  const existingIds = new Set(settings.hooks[event].map(e => e.id).filter(Boolean));
  const existingKeys = new Set(settings.hooks[event].map(e => JSON.stringify(e)));
  for (const entry of entries) {
    if (entry.id && existingIds.has(entry.id)) continue;
    const key = JSON.stringify(entry);
    if (!existingKeys.has(key)) {
      settings.hooks[event].push(entry);
      existingIds.add(entry.id);
      existingKeys.add(key);
    }
  }
}

// Add statusline if not present
if (!settings.statusLine) {
  settings.statusLine = {
    type: 'command',
    command: 'node ~/.claude/scripts/orchestrate-progress.js',
    description: 'Status line with orchestrate workflow progress breadcrumb trail'
  };
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log('  Settings updated (hooks merged, statusline configured)');
"

echo ""
echo "Done! founder-stack installed to $CLAUDE_DIR"
echo ""
echo "Installed:"
echo "  Agents:      $(ls "$CLAUDE_DIR/agents"/*.md 2>/dev/null | wc -l | tr -d ' ')"
echo "  Commands:    $(ls "$CLAUDE_DIR/commands"/*.md 2>/dev/null | wc -l | tr -d ' ')"
echo "  Rules:       $(find "$CLAUDE_DIR/rules" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
echo "  Skills:      $(ls -d "$CLAUDE_DIR/skills"/*/ 2>/dev/null | wc -l | tr -d ' ')"
echo "  Design sys:  $(ls "$CLAUDE_DIR/design-systems"/*.md 2>/dev/null | wc -l | tr -d ' ')"
echo "  Agent docs:  $(ls "$CLAUDE_DIR/agent_docs"/*.md 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "Start a new Claude Code session to activate."
