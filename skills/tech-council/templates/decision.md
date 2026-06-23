---
decision_id: YYYY-MM-DD-<slug>
slug: <slug>
date: YYYY-MM-DD
title: "<short title>"

classification:
  type: type-1   # type-1 (irreversible) or type-2 (reversible)
  horizon_years: 5
  domain_mix: [ai_infrastructure, capital_allocation, ecosystem_platform]

# Step 2 — Dimensions scored 0–10
dimensions:
  operational_excellence: 0
  visionary: 0
  ecosystem_platform: 0
  speed_velocity: 0
  brand_narrative: 0
  capital_allocation: 0
  consumer_product_ux: 0
  ai_infrastructure: 0
  market_creation: 0
  responsible_deployment: 0
  first_principles: 0
  distribution: 0
  customer_obsession: 0
  long_term_thinking: 0

# Step 3 — Voice selection
voices:
  selected: []        # ordered by relevance, top first
  excluded: []        # voices ranked but not chosen
  user_overrides: []  # [{action: add|remove, name: <name>, reason: "..."}]
  relevance: {}       # name -> integer score

believability:
  load_bearing: []    # top 2–3 selected voices
  commentary: []      # remaining selected voices
  weights: {}         # name -> 0-1 (sums to 1.0 across selected)

# Step 4 — Pre-council number commit (BEFORE any voice fires)
synthesizer_initial:
  position: ""
  kill_threshold:
    metric: ""
    value: ""
    by_date: YYYY-MM-DD
  revisit_date: YYYY-MM-DD

# Step 10 — Final verdict
verdict:
  recommendation: ""
  confidence: low      # low | medium | high
  consensus: ""
  strongest_dissent: ""
  position_changed: false
  changed_by_voice: null

# Mandatory — no kill criterion = invalid verdict
kill_criterion:
  metric: ""
  value: ""
  by_date: YYYY-MM-DD

status: open          # open | revisited | killed | shipped
revisit_log: []       # appended when kill criterion fires or revisit_date hits
---

# <title>

## Press release (one paragraph)

See `press-release.md` for the full PR/FAQ. Inline summary:

> [Paste the press-release opening paragraph.]

## Voice positions

### <Voice 1 display_name>  ·  weight <w%>  ·  load-bearing | commentary

1. **Position** —
2. **Reasoning** —
3. **What I'd build first** —
4. **Biggest risk** —
5. **What would change my mind** —
6. **One thing the others will miss** —
7. **What the founder is most likely lying to themselves about** —

### <Voice 2 display_name>  ·  weight <w%>  ·  load-bearing | commentary
…

## Cruxes

- **Fact:** [empirical disagreement, who's on each side]
- **Value:** [priority disagreement, who's on each side]
- **Time horizon:** [window disagreement, who's on each side]

## Inversion check

**Catastrophic failure mode:** [what would kill this in 24 months]
**Surfaced by:** [voice name, or "no voice — flagged separately"]

## Verdict

- **Recommendation:** [synthesized path]
- **Confidence:** low / medium / high
- **Consensus:** [where the voices align]
- **Strongest dissent (kept visible):** [the dissent that didn't win, with the voice that owned it]
- **Position changed?** yes/no [if yes, which voice's argument changed it; if no, which came closest]
- **Kill criterion (mandatory):** `<metric>` hits `<value>` by `<date>` → abandon this path

## Revisit log

<!-- Append each entry when the kill criterion fires or the revisit_date hits. -->

<!--
- date: YYYY-MM-DD
  trigger: kill-criterion-fired | scheduled-revisit
  new_evidence: ""
  status_change: open -> revisited | killed | shipped
  notes: ""
-->
