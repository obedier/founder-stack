---
description: Pull latest changes from ECC and gstack upstreams into founder-stack, show diff, apply with confirmation, and re-install.
---

# Update — Upstream Sync

Pull the latest from Everything Claude Code and gstack into your founder-stack repo, then re-install to `~/.claude/`.

## Usage

`/update [options]`

## What It Does

1. Fetches latest commits from both upstream repos
2. Shows you what changed (commit log summary)
3. Asks for confirmation before applying
4. Copies updated files into founder-stack (preserving your custom orchestrate, sprint kit skills, and agent_docs)
5. Re-runs the installer to push changes to `~/.claude/`

## Execution

When the user runs `/update`:

### Step 1: Check for updates

```bash
bash ~/CodeProjects/founder-stack/scripts/update.sh --dry-run
```

Show the user the output — how many new commits from each upstream.

### Step 2: Apply (if user confirms)

```bash
bash ~/CodeProjects/founder-stack/scripts/update.sh
```

This will prompt for confirmation interactively.

### Step 3: Re-install

After updates are applied to the founder-stack repo:

```bash
bash ~/CodeProjects/founder-stack/install.sh --skip-gstack-build
```

Use `--skip-gstack-build` unless the gstack update includes browse binary changes.

### Step 4: Report

Show what was updated:
- Number of new commits applied (ECC + gstack)
- Any new agents, commands, or skills added
- Current upstream SHAs (from `.upstream` file)

## Protected Files

The update script **never overwrites**:
- `commands/orchestrate.md` — your unified workflow
- `commands/update.md` — this command
- `skills/kit-*` — sprint kit skills
- `skills/gstack/` — only updated from gstack upstream, not ECC
- `agent_docs/` — sprint kit coordination docs
- `templates/` — sprint kit templates
- `scripts/orchestrate-progress.js` — progress tracker

## Security Scan (SkillSpector)

After applying upstream changes, the updater runs a **best-effort SkillSpector
scan** over `skills/` (fast `--no-llm` pass) and surfaces any HIGH/CRITICAL
findings before you `./install.sh` hundreds of third-party skill files to
`~/.claude/`. It never blocks the update — it only warns.

- Requires SkillSpector: `uv tool install git+https://github.com/NVIDIA/skillspector.git`
- If not installed, the scan is skipped with an install hint.
- Findings can be false positives (e.g. interactive scripts that echo values) —
  review the full JSON report before acting.
- Scan a single skill manually before adding it from anywhere:
  `skillspector scan <path-or-github-url>`

## Arguments

$ARGUMENTS:
- (none) — check both upstreams and apply
- `--ecc-only` — only check ECC
- `--gstack-only` — only check gstack
- `--dry-run` — show changes without applying
