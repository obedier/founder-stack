---
name: cgo
version: 1.0.0
description: |
  Chief Growth Officer — an orchestrated growth-marketing team you point at any
  project (repo, product, or URL) to plan and run real SEO + paid/performance
  marketing. Convenes a CGO strategist plus SEO, Paid, Analytics, CRO, and
  Content leads, backed by 46 marketing skills and a live ad/analytics data
  plane. Triggers: "cgo", "grow this", "run marketing on", "growth plan",
  "SEO and ads for", "chief growth officer", "performance marketing".
origin: custom
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - WebSearch
  - WebFetch
---

# /cgo — Chief Growth Officer & Growth Team

Point a full growth-marketing team at any project and run best-practice SEO +
paid/performance marketing end to end. This skill **orchestrates** — it sequences
a CGO strategist and five specialist leads, each backed by deep, eval-tested
marketing skills and a real execution layer (platform CLIs + the Supermetrics
MCP data plane).

## When to use

- "Grow this product", "run marketing on <project/URL>", "build a growth plan".
- You want SEO + paid acquisition planned and executed with measurement, not just advice.
- A launch, a stalled funnel, a new channel, or a recurring growth operation.

Not for: one-off copy edits or a single lookup — call the specific skill/agent directly.

## The team

| Agent | Owns | Backed by (skills in `cgo-marketing/skills/`) |
|---|---|---|
| **cgo** | Strategy, ICP, channel mix, budget, synthesis | `product-marketing`, `marketing-plan`, `marketing-loops` |
| **growth-seo-lead** | Technical/content/AI SEO, programmatic | `seo-audit`, `ai-seo`, `programmatic-seo`, `site-architecture`, `schema`, `content-strategy` |
| **growth-paid-lead** | Google/Meta/LinkedIn/TikTok/X ads, bidding, ROAS | `ads`, `ad-creative`, `ab-testing`, `marketing-psychology` |
| **growth-analytics-lead** | Tracking, reporting, ROAS/CAC/LTV, attribution | `analytics`, `ab-testing` + **Supermetrics MCP** |
| **growth-cro-lead** | Landing/funnel/offer conversion | `cro`, `signup`, `popups`, `copywriting`, `offers`, `pricing` |
| **growth-content-lead** | On-brand production across channels | founder-stack `brand-voice`/`content-engine`/`article-writing` + `social`, `emails`, `launch` |

## The shared spine

All work is grounded in one doc — **`.agents/product-marketing.md`** in the target
project (ICP, JTBD Four Forces, personas, verbatim customer language, proof, voice).
The CGO generates it first (via the `product-marketing` skill) if absent. Every
lead reads it before acting, so their work stays coherent instead of re-deriving
positioning six different ways.

## Workflow

Run these phases. Dispatch each lead with the **Task tool** (agent types above),
giving a self-contained brief. Phases 2–5 fan out in parallel where independent.

1. **Intake & ground.**
   - Identify the target (repo path, product, or URL) and the goal.
   - Ensure `.agents/product-marketing.md` exists; if not, the **cgo** agent creates it.
   - Establish growth stage, current channels, and unit economics (CAC/LTV/margin/payback).

2. **Strategy (cgo).** The CGO sets the constraint metric, picks 2–3 channels (and names what's excluded), sets a budget envelope + target blended CAC / break-even ROAS, and writes a brief per lead. Use `marketing-plan` (AARRR).

3. **Audit & plan (specialist leads, parallel).**
   - SEO Lead → technical + content + AI-search audit, keyword→URL map (GSC/DataForSEO).
   - Paid Lead → campaign architecture, keyword/negative lists, creative, bid strategy (dry-run only).
   - Analytics Lead → tracking/UTM audit, KPI + dashboard plan, baseline pull via Supermetrics.
   - CRO Lead → conversion audit of the landing/funnel surface, prioritized hypotheses.
   - Content Lead → content plan in the canonical brand voice, mapped to SEO/Paid specs.

4. **Synthesize (cgo).** Reconcile conflicts disagreement-first (e.g. paid economics vs. runway). Produce the sequenced program: what ships this cycle, in what order, at what budget, measured how.

5. **Execute — with approval gates.**
   - **Autonomous:** research, audits, read-only data pulls, and all drafts/artifacts (campaign CSVs, GAQL, content, schema).
   - **Human gate — PAUSE for explicit OK:** creating/editing live campaigns, changing budgets/bids, publishing content, submitting directories, sending email/SMS. Present the exact artifact + projected cost/impact, then wait.

6. **Measure & loop.** Analytics Lead reports against the constraint metric. The CGO decides scale / hold / kill and re-briefs. For recurring operations (weekly reporting, budget pacing, rank tracking), stand up a loop via `marketing-loops` with an explicit cadence, self-check, stop condition, and human checkpoint (use founder-stack `/loop` or `/schedule`).

## Execution layer

- **Live ad/analytics data & campaign writes:** the connected **Supermetrics MCP** (`data_source_discovery` → `data_query`; `campaign_create/update`) — load via ToolSearch. Never fabricate metrics; use only discovered field IDs.
- **Platform CLIs** (`skills/cgo-marketing/tools/clis/*.js`, Node 18+, zero-dep, read creds from env, `--dry-run` supported): `google-ads.js`, `meta-ads.js`, `linkedin-ads.js`, `dataforseo.js`, `google-search-console.js`, `semrush.js`, `ahrefs.js`, and ~58 more. `tools/REGISTRY.md` maps each tool to its MCP/CLI/guide.
- **Graceful degradation:** where creds/MCP for a platform are absent, produce ready-to-run artifacts and tell the user exactly which env var / auth to set. Never block the whole program on one missing integration.

## Guardrails

- **Data-sharing:** prompts to external models/tools leave the machine — don't paste secrets, credentials, or proprietary source without the user's OK.
- **Spend safety:** never exceed the CGO's budget envelope; every paid action shows projected daily spend + expected CAC/ROAS before the gate.
- **Honesty:** no fabricated metrics, fake reviews, cloaking, or policy-violating ad copy. Label estimates. Attribute external analysis.
- **Known upstream gaps to flag, not fake:** standalone keyword-research and off-page/link-building skills are thin — surface these as needs rather than pretending coverage.

## Gaps this fills / known limits

Founder-stack already had deep content, research, organic-distribution, and on-site
SEO. This adds the missing **paid + measurement half** and wires the Supermetrics
data plane that nothing previously consumed. Multi-touch attribution is only partial
(lives inside `ads`); treat attribution claims with appropriate humility.
