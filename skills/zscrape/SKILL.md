---
name: zscrape
version: 1.0.0
description: |
  Scrape web pages that block normal fetching, using the Zyte API — with a
  cost-first escalation ladder so you never over-pay. Auto-avoids bans
  (rotating/residential IPs, anti-bot bypass), renders JavaScript only when
  needed, and can pull structured product/article/SERP data. Use ONLY when
  self-scraping (WebFetch / headless /browse) is blocked or JS-walled; Zyte is
  metered per successful request. Triggers: "zscrape", "scrape with zyte",
  "this site blocks me", "bypass the bot wall", "scrape behind cloudflare",
  "residential proxy scrape", "scrape a JS-rendered / protected page".
origin: custom
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - WebFetch
---

# /zscrape — Zyte-powered scraping (cheapest mode that works)

Zyte API is a paid, metered scraping backend that avoids bans and renders JS.
**It is not the default scraper — it is the escape hatch.** This skill's whole
job is to get you the page *without lighting money on fire*: try the free/cheap
path first, reach for Zyte only when you're actually blocked, and inside Zyte
always start on the cheapest request mode.

## Decision: self-scrape vs Zyte (do this first)

**Try our own tools first — they're free:**

| Situation | Use | Cost |
|-----------|-----|------|
| Static/public page, just need the text | `WebFetch` | free |
| Need JS render, clicks, or screenshots, site NOT bot-protected | `/browse` (headless) | free |
| **Blocked** (403/429/CAPTCHA), Cloudflare/DataDome/PerimeterX wall, or IP-banned | **`/zscrape`** | metered |
| Need residential IP / specific-country geolocation | **`/zscrape --geo=XX`** | metered |
| Need structured product/article/SERP data at scale | **`/zscrape --extract=…`** | metered |

Rule of thumb: **if `WebFetch` or `/browse` already returns the content, do NOT
use Zyte.** Only escalate to Zyte on evidence of blocking — a 403/429, a CAPTCHA
/ "enable JavaScript" wall, an empty body, or a bot-check interstitial.

## The cost ladder (inside Zyte)

You pay per **successful** Zyte response. Bans, 429s, and target 4xx/5xx are
**free**, so retrying and escalating costs nothing until something works.
Browser rendering costs several times a plain HTTP request; screenshots and
automatic extraction add cost on top of that.

```
1. httpResponseBody   ← cheapest. plain HTTP through Zyte's ban-avoiding proxies
2. browserHtml        ← headless browser + JS. only when step 1 comes back empty
3. screenshot / extract=product|article|serp   ← add-ons; only when truly needed
```

The CLI defaults to `--mode=auto`: it sends the cheap HTTP request, and **only**
escalates to browser rendering if the returned HTML has almost no visible text
(the tell-tale of a JS-rendered SPA or bot shell). Every run prints the mode it
actually billed to stderr (`[ok] mode=http` / `[escalate] … browser`).

## Tool

`tools/zscrape.js` — zero-dependency Node 18+ CLI. Reads `ZYTE_API_KEY` from env
(`--key-alt` uses `ZYTE_API_KEY_ALT`). Both live in `~/.keys.sh`, so
`source ~/.keys.sh` once per shell first. Never echo the key.

```bash
source ~/.keys.sh
SK=~/.claude/skills/zscrape/tools/zscrape.js   # or ./skills/zscrape/tools/zscrape.js in-repo

# Cheapest path, auto-escalates only if the page is JS-walled:
node "$SK" https://example.com

# Preview the request + billed mode WITHOUT spending:
node "$SK" https://example.com --dry-run

# Force cheapest and never escalate (fail loud instead of paying for browser):
node "$SK" https://example.com --mode=http

# Force browser rendering (JS-heavy site you already know needs it):
node "$SK" https://app.example.com --mode=browser --out=page.html

# Structured extraction (returns clean JSON, skips paying for raw HTML too):
node "$SK" https://shop.example.com/p/123 --extract=product --json

# Geolocated / anti-ban, plus a screenshot as evidence:
node "$SK" https://example.com --geo=US --screenshot=proof.png

# Browser actions (click, scroll, wait) — forces browser mode:
node "$SK" https://example.com --actions='[{"action":"click","selector":{"type":"css","value":".more"}},{"action":"waitForTimeout","timeout":2}]'
```

Options: `--mode=auto|http|browser`, `--extract=product|article|productList|serp`,
`--screenshot[=file]`, `--geo=CC`, `--headers="K: V; K2: V2"`, `--actions=JSON`,
`--out=file`, `--json`, `--key-alt`, `--dry-run`.

## Method

1. **Prove you need it.** Attempt `WebFetch`/`/browse` first (or explain why you
   already know it's blocked). Don't open with Zyte.
2. **Dry-run to price it.** For anything beyond a single page, run `--dry-run`
   first and confirm the mode. Browser/extract/screenshot = real money.
3. **Start cheap.** Use default `--mode=auto`. Let it escalate only if the cheap
   body is empty. Prefer `--mode=http` for known-static protected sites.
4. **Prefer `--extract` over parsing HTML yourself** when you need structured
   product/article/SERP fields — it's often cheaper and cleaner than browser +
   hand-parsing, and it skips paying for raw HTML.
5. **Batch politely.** For many URLs, loop the CLI, cache results to disk, and
   stop on repeated failures — don't hammer (failures are free but pointless).
6. **Report what you spent.** Tell the user which mode ran per URL (the CLI
   prints it), so cost is visible.

## Guardrails

- **Zyte is the last resort, not the default.** If a free tool returns the
  content, use the free tool. Escalating to Zyte "just in case" wastes credits.
- **Cheapest mode first, always.** Never open on `--mode=browser` /
  `--screenshot` / `--extract` unless the task genuinely requires it. Auto mode
  exists so you don't over-pay by habit.
- **Never hardcode or echo the key.** It comes from `ZYTE_API_KEY` in
  `~/.keys.sh`. Don't print it, commit it, or pass it on a command line.
- **Respect the target.** Honor robots/ToS and legal constraints; scrape only
  what the user is authorized to. This tool bypasses *anti-bot blocking*, not
  *permission*.
- **Fail loud on non-200.** Bans/429s are free; surface Zyte's error rather than
  silently retrying forever. Large jobs should have a stop condition.
- **Don't fabricate.** If a page can't be fetched, say so and show the Zyte
  status — never invent page content.
```
