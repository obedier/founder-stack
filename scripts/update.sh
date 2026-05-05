#!/bin/bash
set -euo pipefail

# founder-stack upstream updater
# Pulls latest from ECC and gstack, shows diff, applies with confirmation

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
UPSTREAM_FILE="$REPO_ROOT/.upstream"
DRY_RUN=false
ECC_ONLY=false
GSTACK_ONLY=false
DESIGN_MD_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --ecc-only) ECC_ONLY=true ;;
    --gstack-only) GSTACK_ONLY=true ;;
    --design-md-only) DESIGN_MD_ONLY=true ;;
    --help|-h)
      echo "Usage: ./scripts/update.sh [--dry-run] [--ecc-only] [--gstack-only] [--design-md-only]"
      echo "  --dry-run          Show changes without applying"
      echo "  --ecc-only         Only update ECC components"
      echo "  --gstack-only      Only update gstack components"
      echo "  --design-md-only   Only update design systems from awesome-design-md"
      exit 0
      ;;
  esac
done

# Read current tracked SHAs
ECC_SHA=$(grep "^ecc=" "$UPSTREAM_FILE" | cut -d= -f2)
GSTACK_SHA=$(grep "^gstack=" "$UPSTREAM_FILE" | cut -d= -f2)
DESIGN_MD_SHA=$(grep "^design_md=" "$UPSTREAM_FILE" | cut -d= -f2 || echo "")

echo "founder-stack updater"
echo "====================="
echo "Current ECC:       ${ECC_SHA:0:12}"
echo "Current gstack:    ${GSTACK_SHA:0:12}"
echo "Current design-md: ${DESIGN_MD_SHA:0:12}"
echo ""

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

ECC_CHANGES=0
GSTACK_CHANGES=0
DESIGN_MD_CHANGES=0

# Ensure the old tracked SHA is reachable in a (possibly shallow) clone.
# If not present, unshallow the clone so `git log OLD..NEW` works.
ensure_history() {
  local dir="$1"
  local old_sha="$2"
  if [ -z "$old_sha" ]; then return 0; fi
  if ! (cd "$dir" && git cat-file -e "${old_sha}^{commit}" 2>/dev/null); then
    (cd "$dir" && git fetch --unshallow --quiet 2>/dev/null) || \
      (cd "$dir" && git fetch --depth=10000 --quiet 2>/dev/null) || true
  fi
}

# --- ECC ---
if [ "$GSTACK_ONLY" = false ]; then
  echo "Fetching ECC upstream..."
  git clone --quiet --depth=100 https://github.com/affaan-m/everything-claude-code "$TMPDIR/ecc" 2>/dev/null || {
    echo "ERROR: Failed to clone ECC. Check network."
    exit 1
  }

  ECC_NEW_SHA=$(cd "$TMPDIR/ecc" && git rev-parse HEAD)
  ensure_history "$TMPDIR/ecc" "$ECC_SHA"
  if [ "$ECC_SHA" = "$ECC_NEW_SHA" ]; then
    echo "  ECC: already up to date ($ECC_SHA)"
  else
    echo ""
    echo "=== ECC changes (${ECC_SHA:0:8}..${ECC_NEW_SHA:0:8}) ==="
    cd "$TMPDIR/ecc"
    git log -n 30 --oneline "$ECC_SHA".."$ECC_NEW_SHA" 2>/dev/null || true
    ECC_CHANGES=$(git log --oneline "$ECC_SHA".."$ECC_NEW_SHA" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
    echo "  ($ECC_CHANGES new commits)"
    cd "$REPO_ROOT"
  fi
fi

# --- gstack ---
if [ "$ECC_ONLY" = false ]; then
  echo ""
  echo "Fetching gstack upstream..."
  git clone --quiet --depth=100 https://github.com/obedier/obstack "$TMPDIR/gstack" 2>/dev/null || {
    echo "ERROR: Failed to clone gstack. Check network."
    exit 1
  }

  GSTACK_NEW_SHA=$(cd "$TMPDIR/gstack" && git rev-parse HEAD)
  ensure_history "$TMPDIR/gstack" "$GSTACK_SHA"
  if [ "$GSTACK_SHA" = "$GSTACK_NEW_SHA" ]; then
    echo "  gstack: already up to date ($GSTACK_SHA)"
  else
    echo ""
    echo "=== gstack changes (${GSTACK_SHA:0:8}..${GSTACK_NEW_SHA:0:8}) ==="
    cd "$TMPDIR/gstack"
    git log -n 30 --oneline "$GSTACK_SHA".."$GSTACK_NEW_SHA" 2>/dev/null || true
    GSTACK_CHANGES=$(git log --oneline "$GSTACK_SHA".."$GSTACK_NEW_SHA" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
    echo "  ($GSTACK_CHANGES new commits)"
    cd "$REPO_ROOT"
  fi
fi

# --- awesome-design-md ---
if [ "$ECC_ONLY" = false ] && [ "$GSTACK_ONLY" = false ]; then
  echo ""
  echo "Fetching awesome-design-md upstream..."
  git clone --quiet --depth=100 https://github.com/VoltAgent/awesome-design-md "$TMPDIR/design-md" 2>/dev/null || {
    echo "WARNING: Failed to clone awesome-design-md. Skipping."
  }

  if [ -d "$TMPDIR/design-md" ]; then
    DESIGN_MD_NEW_SHA=$(cd "$TMPDIR/design-md" && git rev-parse HEAD)
    ensure_history "$TMPDIR/design-md" "$DESIGN_MD_SHA"
    if [ "$DESIGN_MD_SHA" = "$DESIGN_MD_NEW_SHA" ]; then
      echo "  awesome-design-md: already up to date ($DESIGN_MD_SHA)"
    else
      echo ""
      echo "=== awesome-design-md changes (${DESIGN_MD_SHA:0:8}..${DESIGN_MD_NEW_SHA:0:8}) ==="
      cd "$TMPDIR/design-md"
      git log -n 30 --oneline "$DESIGN_MD_SHA".."$DESIGN_MD_NEW_SHA" 2>/dev/null || true
      DESIGN_MD_CHANGES=$(git log --oneline "$DESIGN_MD_SHA".."$DESIGN_MD_NEW_SHA" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
      echo "  ($DESIGN_MD_CHANGES new commits)"
      cd "$REPO_ROOT"
    fi
  fi
elif [ "$DESIGN_MD_ONLY" = true ]; then
  echo "Fetching awesome-design-md upstream..."
  git clone --quiet --depth=100 https://github.com/VoltAgent/awesome-design-md "$TMPDIR/design-md" 2>/dev/null || {
    echo "ERROR: Failed to clone awesome-design-md. Check network."
    exit 1
  }

  DESIGN_MD_NEW_SHA=$(cd "$TMPDIR/design-md" && git rev-parse HEAD)
  ensure_history "$TMPDIR/design-md" "$DESIGN_MD_SHA"
  if [ "$DESIGN_MD_SHA" = "$DESIGN_MD_NEW_SHA" ]; then
    echo "  awesome-design-md: already up to date ($DESIGN_MD_SHA)"
  else
    echo ""
    echo "=== awesome-design-md changes (${DESIGN_MD_SHA:0:8}..${DESIGN_MD_NEW_SHA:0:8}) ==="
    cd "$TMPDIR/design-md"
    git log -n 30 --oneline "$DESIGN_MD_SHA".."$DESIGN_MD_NEW_SHA" 2>/dev/null || true
    DESIGN_MD_CHANGES=$(git log --oneline "$DESIGN_MD_SHA".."$DESIGN_MD_NEW_SHA" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
    echo "  ($DESIGN_MD_CHANGES new commits)"
    cd "$REPO_ROOT"
  fi
fi

# --- Summary ---
TOTAL_CHANGES=$((ECC_CHANGES + GSTACK_CHANGES + DESIGN_MD_CHANGES))
echo ""
echo "Summary: $TOTAL_CHANGES new commits ($ECC_CHANGES ECC, $GSTACK_CHANGES gstack, $DESIGN_MD_CHANGES design-md)"

if [ "$TOTAL_CHANGES" -eq 0 ]; then
  echo "Nothing to update."
  exit 0
fi

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "(dry run — no changes applied)"
  exit 0
fi

# --- Confirm ---
echo ""
read -p "Apply updates? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

# --- Apply ECC ---
if [ "$GSTACK_ONLY" = false ] && [ "$ECC_CHANGES" -gt 0 ]; then
  echo ""
  echo "Applying ECC updates..."
  ECC_SRC="$TMPDIR/ecc"

  # Copy ECC components (skip skills/gstack and skills/kit-*)
  cp -R "$ECC_SRC/agents"/*.md "$REPO_ROOT/agents/" 2>/dev/null || true
  cp -R "$ECC_SRC/rules" "$REPO_ROOT/"

  # Commands: copy all EXCEPT our custom orchestrate and update
  for cmd in "$ECC_SRC/commands"/*.md; do
    cmd_name=$(basename "$cmd")
    if [ "$cmd_name" != "orchestrate.md" ] && [ "$cmd_name" != "update.md" ]; then
      cp "$cmd" "$REPO_ROOT/commands/"
    fi
  done

  # Skills: copy ECC skills, skip anything that would overwrite gstack or kit-*
  for skill_dir in "$ECC_SRC/skills"/*/; do
    skill_name=$(basename "$skill_dir")
    case "$skill_name" in
      gstack|kit-*|remote-trainer) continue ;;  # Don't overwrite our native skills
    esac
    mkdir -p "$REPO_ROOT/skills/$skill_name"
    cp -R "$skill_dir"* "$REPO_ROOT/skills/$skill_name/" 2>/dev/null || true
  done

  # Hooks, scripts, manifests
  cp -R "$ECC_SRC/hooks"/* "$REPO_ROOT/hooks/" 2>/dev/null || true
  cp -R "$ECC_SRC/scripts/hooks"/* "$REPO_ROOT/scripts/hooks/" 2>/dev/null || true
  cp -R "$ECC_SRC/scripts/lib"/* "$REPO_ROOT/scripts/lib/" 2>/dev/null || true
  cp -R "$ECC_SRC/manifests"/* "$REPO_ROOT/manifests/" 2>/dev/null || true

  # Update SHA
  sed -i '' "s/^ecc=.*/ecc=$ECC_NEW_SHA/" "$UPSTREAM_FILE"
  echo "  ECC updated to ${ECC_NEW_SHA:0:12}"
fi

# --- Apply gstack ---
if [ "$ECC_ONLY" = false ] && [ "$GSTACK_CHANGES" -gt 0 ]; then
  echo ""
  echo "Applying gstack updates..."
  GSTACK_SRC="$TMPDIR/gstack"

  # Copy gstack contents (preserve local binary)
  for item in "$GSTACK_SRC"/*/; do
    item_name=$(basename "$item")
    case "$item_name" in
      node_modules|.git|dist) continue ;;
    esac
    mkdir -p "$REPO_ROOT/skills/gstack/$item_name"
    cp -R "$item"* "$REPO_ROOT/skills/gstack/$item_name/" 2>/dev/null || true
  done
  # Copy top-level files
  for f in "$GSTACK_SRC"/*.md "$GSTACK_SRC"/*.json "$GSTACK_SRC"/setup "$GSTACK_SRC"/VERSION; do
    [ -f "$f" ] && cp "$f" "$REPO_ROOT/skills/gstack/"
  done

  # Update SHA
  sed -i '' "s/^gstack=.*/gstack=$GSTACK_NEW_SHA/" "$UPSTREAM_FILE"
  echo "  gstack updated to ${GSTACK_NEW_SHA:0:12}"
fi

# --- Apply awesome-design-md ---
if [ "$DESIGN_MD_CHANGES" -gt 0 ] && [ -d "$TMPDIR/design-md" ]; then
  echo ""
  echo "Applying awesome-design-md updates..."
  mkdir -p "$REPO_ROOT/design-systems"
  for dir in "$TMPDIR/design-md/design-md"/*/; do
    brand=$(basename "$dir")
    if [ -f "$dir/DESIGN.md" ]; then
      cp "$dir/DESIGN.md" "$REPO_ROOT/design-systems/${brand}.md"
    fi
  done

  # Update SHA
  sed -i '' "s/^design_md=.*/design_md=$DESIGN_MD_NEW_SHA/" "$UPSTREAM_FILE"
  echo "  awesome-design-md updated to ${DESIGN_MD_NEW_SHA:0:12}"
  echo "  Design systems: $(ls "$REPO_ROOT/design-systems"/*.md 2>/dev/null | wc -l | tr -d ' ') brands"
fi

# Update timestamp
sed -i '' "s/^updated=.*/updated=$(date +%Y-%m-%d)/" "$UPSTREAM_FILE"

echo ""
echo "Updates applied to founder-stack repo."
echo "Run ./install.sh to push changes to ~/.claude/"
