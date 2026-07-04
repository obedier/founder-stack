---
name: link-building
version: 1.0.0
description: |
  Earn authoritative backlinks and off-page signals: competitor backlink-gap
  analysis, link prospecting, digital PR, unlinked-mention reclamation, and
  outreach — the off-page half of SEO that on-site audits can't fix.
  Orchestrates the Ahrefs / Semrush / DataForSEO backlink CLIs in the
  cgo-marketing bundle and hands the actual outreach to founder-stack's
  lead-intelligence + cold-email/emails skills. Triggers: "link building",
  "backlinks", "off-page SEO", "backlink gap", "digital PR", "get links",
  "domain authority", "outreach for links".
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

# /link-building — Off-Page SEO, Backlinks & Digital PR

The off-page complement to the SEO Lead's on-site work. Technical/content SEO
makes a page *rankable*; links and off-page signals make it *rank*. This skill
finds link opportunities from real backlink data, prioritizes them, and drives
compliant outreach — closing the last flagged gap in the CGO growth stack.

## When to use

- Organic rankings are capped by authority, not on-page quality.
- You need a competitor **backlink-gap** analysis (who links to them, not you).
- Digital-PR, resource-page, guest-post, or unlinked-mention campaigns.
- Directory / citation tiers for a launch (coordinate with the bundle's `directory-submissions`).

Ground the ICP, proof points, and voice in `.agents/product-marketing.md` — link
outreach converts on genuine relevance and a real reason to link, not spray-and-pray.

## Data sources (execution layer)

Backlink data ships in the bundle at `~/.claude/skills/cgo-marketing/tools/clis/`
(repo: `skills/cgo-marketing/tools/clis/`). Node 18+, zero-dep, env-var creds,
`--dry-run`. See `skills/cgo-marketing/tools/REGISTRY.md` for auth.

| Tool | Gives you | Env |
|------|-----------|-----|
| `ahrefs.js` | Referring domains, backlink profile, DR, competitor links, broken links | `AHREFS_API_TOKEN` |
| `semrush.js` | Backlink gap, referring domains, authority score, competitor links | `SEMRUSH_API_KEY` |
| `dataforseo.js` | Backlinks, referring domains, anchors, bulk backlink metrics | `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` |
| `google-search-console.js` | Links to your site as Google sees them (ground truth) | GSC OAuth |

## Outreach layer (reuse, don't rebuild)

- **Prospect enrichment & contact-finding:** founder-stack `lead-intelligence` (`~/.claude/skills/lead-intelligence/`) — turn linking domains into scored, contactable prospects with warm-path detection (`social-graph-ranker`).
- **Outreach drafting/sequences:** bundle `cold-email` + `emails` (`~/.claude/skills/cgo-marketing/skills/`), in the canonical brand voice via the Content Lead.
- **Directory/citation tier:** bundle `directory-submissions`. **PR/newsjacking:** bundle `public-relations`.

## Method

1. **Baseline.** Pull your current backlink profile (referring domains, DR/authority, anchor mix) and cross-check against GSC's link report. Note toxic/spammy links to consider disavowing.
2. **Gap.** Run a backlink-gap: domains linking to 2+ competitors but not you (`ahrefs.js`/`semrush.js`). These are the warmest, most relevant targets — start here.
3. **Prospect.** Build the target list by opportunity type: resource pages, competitor-linking sites, unlinked brand mentions, broken-link reclamation (their dead link → your live asset), guest/expert contributions, digital-PR/data-story angles. Enrich + score via `lead-intelligence`.
4. **Qualify.** Score each by (relevance × authority × attainability). Drop low-relevance high-DA vanity targets — off-topic links don't move rankings and risk penalties.
5. **Give them a reason.** For each cluster, define the *linkable asset* or angle (original data, tool, definitive guide, expert quote). No asset → no campaign; loop the Content Lead / CRO Lead to create it.
6. **Outreach — drafted autonomously, sent on approval.** Personalized, brief, value-first messages/sequences in brand voice. Track status (sent / replied / linked) like a pipeline.
7. **Measure.** Report referring-domain growth, links won per campaign, and downstream rank/traffic movement (with the Analytics Lead) — and be honest about attribution lag.

## Outputs

- **Prospect sheet** — `target domain → opportunity type → DR/authority → relevance → contact → linkable asset → status`.
- **Backlink-gap summary** — highest-value domains linking to competitors but not you.
- **Outreach drafts** — per-prospect messages / a sequence, brand-voice, ready to send on approval.
- **Toxic-link / disavow candidates** — flagged, never auto-submitted.

Emit as CSV/markdown so `lead-intelligence` and the email skills consume them directly.

## Guardrails

- **White-hat only.** No link buying, PBNs, link exchanges at scale, or automated spam — these risk manual actions and torch the domain. If asked, refuse and explain the risk.
- **No fabricated metrics.** DR/authority/backlink counts come from tool responses; if no provider is configured, produce the *strategy and prospect structure* qualitatively and name the env var needed to enrich — never invent numbers.
- **Approval gates (execute-with-approval):** prospecting, gap analysis, and drafting are autonomous; **PAUSE for explicit OK before sending any outreach, submitting directories, or filing a disavow.** Respect anti-spam law (CAN-SPAM/GDPR): real identity, opt-out, no scraped-list blasting.
- **Attribute** each data pull (tool + date). Relevance beats volume — 10 on-topic links beat 100 generic ones.
