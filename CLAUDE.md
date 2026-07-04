# founder-stack

Consolidated Claude Code configuration: gstack + ECC + Agentic Sprint Kit.

## Quick Start

```bash
./install.sh                    # Full install to ~/.claude/
/update                         # Pull upstream changes from ECC + gstack
/orchestrate feature "desc"     # Single feature workflow
/orchestrate project "desc"     # Full v1 autonomous build
```

## What's Inside

| Source | What | Count |
|--------|------|-------|
| **ECC** | Agents, commands, rules, skills, hooks | 30 agents, 60 commands, 77 rules, 136 skills, 29 hooks |
| **gstack** | QA, review, ship, browse, product strategy | 17 skills |
| **Sprint Kit** | Spec-first autonomous project builder | 11 skills + agent docs |
| **awesome-design-md** | Production design systems for AI agents | 54 brand design systems |
| **marketingskills** | Corey Haines growth-marketing skills + platform CLIs | 46 skills, 65 CLIs (`skills/cgo-marketing/`) |
| **Custom** | Unified orchestrate + CGO growth team + progress tracker | /orchestrate, /cgo, /update, statusline |

## Workflow Entry Points

| Command | When to Use |
|---------|-------------|
| `/orchestrate feature "desc"` | Build a single feature end-to-end |
| `/orchestrate project "desc"` | Build an entire v1 autonomously (spec-first, multi-sprint) |
| `/orchestrate bugfix "desc"` | Investigate and fix a bug |
| `/orchestrate refactor "desc"` | Restructure code safely |
| `/orchestrate hotfix "desc"` | Fast-track fix → ship |
| `/orchestrate security "desc"` | Security audit |
| `/orchestrate qa` | QA pass on current branch |
| `/cgo <project> [goal]` | Run the Chief Growth Officer team — SEO + paid/performance marketing end to end |

## CGO — Chief Growth Officer Growth Team

Point an orchestrated growth-marketing team at any project (repo, product, or URL)
to plan and run real SEO + paid/performance marketing with measurement and
approval gates. Entry point: `/cgo` (skill `skills/cgo/SKILL.md`, command `commands/cgo.md`).

**The team** (`agents/cgo.md` + `agents/growth-*-lead.md`):

| Agent | Owns |
|-------|------|
| `cgo` | Strategy, ICP/positioning, channel mix, budget, synthesis |
| `growth-seo-lead` | Technical/content/AI SEO (GEO/AEO), programmatic SEO |
| `growth-paid-lead` | Google/Meta/LinkedIn/TikTok/X ads, bidding, ROAS/CAC |
| `growth-analytics-lead` | Tracking, reporting, attribution — via Supermetrics MCP |
| `growth-cro-lead` | Landing/funnel/offer conversion |
| `growth-content-lead` | On-brand production (reuses `brand-voice` + `content-engine`) |

**Backed by** the vendored `cgo-marketing` suite (46 skills + 65 zero-dep platform
CLIs in `skills/cgo-marketing/tools/clis/`) and the connected **Supermetrics MCP**
(live GA4/Ads/GSC data + campaign writes). All work grounds in a shared
`.agents/product-marketing.md` positioning doc.

**Autonomy default: execute-with-approval** — autonomous for research, audits,
read-only data pulls, and all drafts/artifacts; **pauses for explicit OK** before
any live spend change, campaign edit, or publish. Use `/cgo audit <project>` for
advisory-only (no execution). Never fabricates metrics; always attributes external analysis.

## Design Systems (Auto-Injected)

54 production design systems from real brands (Stripe, Linear, Airbnb, Vercel, etc.) stored in `design-systems/`. When a project has UI work:

1. **Automatic**: During `/orchestrate feature` or `/orchestrate project` with UI, if no `DESIGN.md` exists, the workflow auto-suggests a matching design system
2. **Manual**: Run `/design-reference pick` to browse and select, or `/design-reference apply stripe` to apply directly
3. **Zero-prompt**: Once `DESIGN.md` is in the project root, all agents (planner, tdd-guide, code-reviewer, /ux, /qa) automatically read it — no prompt changes needed

The design systems provide exact color tokens, typography scales, component specs, layout rules, do's/don'ts, and AI agent prompt guides. Source: [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT).

## Skill Priority

When gstack and ECC both cover a capability, prefer gstack:
- `/review` → gstack (structural safety review)
- `/qa` → gstack (systematic QA with browser)
- `/ship` → gstack (automated ship workflow)
- `/browse` → gstack (headless browser)
- `/research` → gstack (deep research)
- `/retro` → gstack (engineering retrospective)
- `/bookmark` → gstack (session save/resume)

## Sprint Kit Methodology

For full project builds (`/orchestrate project`), the sprint kit methodology applies:
- **Spec-first**: 9 spec documents generated before any code
- **Contract-driven**: Backend and frontend implement against API_CONTRACTS.md
- **ScrumMaster agent**: Background agent that resolves blockers autonomously
- **Source of truth**: PROMPT.md > GUARDRAILS > specs > code
- **Test-first**: All tests generated from acceptance criteria before implementation

Reference docs in `agent_docs/`:
- `agent-roles.md` — Agent role definitions and boundaries
- `coordination.md` — How agents avoid stepping on each other
- `guardrails.md` — What agents must never do
- `source-of-truth.md` — Conflict resolution hierarchy

## Upstream Tracking

This repo vendors four upstreams tracked in `.upstream`:
- **ECC**: github.com/affaan-m/everything-claude-code
- **gstack**: github.com/obedier/obstack
- **awesome-design-md**: github.com/VoltAgent/awesome-design-md
- **marketingskills**: github.com/coreyhaines31/marketingskills (MIT) → vendored to `skills/cgo-marketing/`

Run `/update` to pull latest changes. The update never overwrites custom files (orchestrate, `/cgo` + growth agents, sprint kit, agent_docs). Scope flags: `--ecc-only`, `--gstack-only`, `--design-md-only`, `--marketing-only`.
