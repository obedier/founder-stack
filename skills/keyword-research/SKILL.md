---
name: keyword-research
version: 1.0.0
description: |
  Turn a product, domain, or seed list into a prioritized, intent-clustered
  keyword map with real volume / difficulty / CPC / SERP data — the shared
  demand layer for both SEO (keyword→URL content map) and paid search
  (ad-group keyword + negative-keyword lists). Orchestrates the DataForSEO /
  Semrush / Ahrefs / Keywords-Everywhere / Google Search Console CLIs shipped
  in the cgo-marketing bundle. Triggers: "keyword research", "keyword map",
  "what should we rank for", "keyword gap", "search demand", "negative keywords".
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

# /keyword-research — Search Demand Map (SEO + Paid)

The one demand layer both search channels build on. It produces a single
intent-clustered keyword map that the **SEO Lead** turns into a content /
URL plan and the **Paid Lead** turns into ad-group keyword sets and
negative-keyword lists. Fills the gap the vendored marketing suite left open
(it has SEO and ads skills but no standalone keyword-research skill).

## When to use

- Standing up SEO or paid search on a new project, or re-planning either.
- You need real volume / difficulty / CPC / SERP data, not guesses.
- Competitor keyword-gap analysis, or negative-keyword discovery for paid.

Ground the ICP and language in `.agents/product-marketing.md` first — good
keywords use the customer's verbatim terms, not internal jargon.

## Data sources (execution layer)

All ship in the bundle at `~/.claude/skills/cgo-marketing/tools/clis/` (repo:
`skills/cgo-marketing/tools/clis/`). Node 18+, zero-dependency, read creds from
env vars, support `--dry-run`. Check `skills/cgo-marketing/tools/REGISTRY.md`
for the auth each needs.

| Tool | Gives you | Env |
|------|-----------|-----|
| `dataforseo.js` | Volume, difficulty, CPC, SERP, related/questions — the workhorse | `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` |
| `google-search-console.js` | **Your own** ranking queries, impressions, clicks, position — the truest seed source | GSC OAuth |
| `semrush.js` | Volume/difficulty, competitor organic + paid keywords, gap | `SEMRUSH_API_KEY` |
| `ahrefs.js` | Difficulty, SERP, competitor keywords | `AHREFS_API_TOKEN` |
| `keywords-everywhere.js` | Cheap volume/CPC enrichment for large lists | `KEYWORDS_EVERYWHERE_API_KEY` |

The **Supermetrics MCP** can also pull GSC/Google Ads query data — use it for
account-connected pulls. Prefer live tools over `WebSearch`; only fall back to
`WebSearch` for qualitative SERP reads when no provider is configured.

## Method

1. **Seed.** Gather seeds from three places: (a) the product/ICP (`.agents/product-marketing.md` — jobs, features, categories, competitor names), (b) **your own GSC queries** you already rank for (highest-signal — `google-search-console.js`), (c) competitor domains (`semrush.js`/`ahrefs.js` organic + paid keywords).
2. **Expand.** For each seed, pull related terms, questions, and autocomplete via `dataforseo.js`. De-dupe and normalize.
3. **Enrich.** Attach volume, keyword difficulty, CPC, and current rank (if any) to every term. For large lists, enrich cheaply with `keywords-everywhere.js`, reserving `dataforseo.js` for the shortlist.
4. **Classify intent.** Tag each keyword: **informational / commercial / transactional / navigational**. Intent decides the channel and page type — transactional/commercial skew paid + money pages; informational feeds SEO content.
5. **Cluster.** Group by SERP overlap / topic into clusters that map to a single page (one primary keyword per URL — avoid cannibalization). This is the unit the SEO Lead builds against.
6. **Prioritize.** Score each cluster by **(demand × business fit × achievability)**: volume/traffic potential, how close intent is to revenue, and difficulty vs. the site's authority. Rank; don't dump an unsorted list.
7. **Split negatives (paid).** From the expansion, surface irrelevant/wrong-intent terms as a **negative-keyword list** so paid search doesn't burn budget on mismatched queries. This is a first-class output, not an afterthought.

## Outputs

Produce a single `keyword-map` the whole team consumes:

- **SEO view** — `keyword → target URL → primary/secondary terms → intent → cluster → priority → difficulty`. Hand to `growth-seo-lead` (feeds `content-strategy`, `site-architecture`).
- **Paid view** — `ad group → keywords (+ match type) → CPC → est. competition`, plus a **negative-keyword list**. Hand to `growth-paid-lead` (feeds `ads`).
- A short **gap summary** — high-value clusters where competitors rank/bid and you don't.

Emit as CSV/markdown tables so the CLIs and downstream skills can consume them directly.

## Guardrails

- **No fabricated metrics.** Every volume/difficulty/CPC number must come from a tool response. If no provider is configured, say so, produce the *structure* (seeds, clusters, intents) qualitatively, and tell the user exactly which env var to set to enrich it — never invent numbers.
- **One primary keyword per URL** — flag cannibalization where two clusters target the same page.
- **Attribute the source** of each data pull (which tool, what date). Rank data ages fast.
- **Dry-run first** on any CLI, and respect provider rate limits on large lists (batch + cache).
