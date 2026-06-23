---
name: tech-council
description: Convene a 2–8 voice tech leadership council selected by dimensional fit to the decision. Default operators include Steve Jobs, Elon Musk, Jeff Bezos, Jensen Huang, Sundar Pichai, Marc Andreessen; optional voices include Satya Nadella, Charlie Munger, Andy Grove. Each run produces a durable, structured decision artifact with a mandatory kill criterion and revisit date. Use for strategic decisions where named operator judgment, weighted by domain fit, beats archetype lenses.
origin: founder-stack
version: 2
---

# Tech Council

A dimensionally-weighted council of named operators. Each decision picks **2–8 voices** from a library, weighted by how their actual track record maps to the dimensions the question lives in. Every run produces a durable artifact on disk with a mandatory kill criterion, so the council compounds across decisions instead of evaporating with the conversation.

This is for **strategic decision-making**, not implementation. For code review or factual lookup, use the right skill — this one is expensive on purpose.

## What's New in v2

- **Voice library** at `voices/` — 9 operators included, fork-friendly schema. Select 2–8 per decision. Add or remove by name.
- **Dimensional weighting** — score the question on 14 dimensions; each voice's believability is *computed* from their dimensional fit, not asserted.
- **Step 0: Press Release + FAQ** — write `decisions/<slug>/press-release.md` *before* voices fire. If you can't write a believable customer reaction, the decision isn't ready.
- **Step 0.5: Pre-council number commit** — synthesizer writes initial position + kill threshold (specific metric + value) + revisit date *before* any voice runs. Anti-confidence-laundering.
- **Structured artifact** — every run writes `decisions/<slug>/decision.md` with YAML frontmatter so decisions are addressable, queryable, and revisitable.
- **Kill criterion mandatory** — the verdict is invalid without one. It must be a falsifiable trigger with a date.

## When to Use

- Strategic, multi-year, multi-domain decisions where named operator playbooks matter
- Type 1 (one-way door) calls where the cost of *wrong operator framing* is high
- When you want named voices weighted by fit, not just generic archetype lenses

## When NOT to Use

| Instead of `tech-council` | Use |
| --- | --- |
| Generic decision needing archetype lenses | `council` |
| Type 2 (reversible) low-horizon single-domain | `council` or just decide |
| Verifying output correctness | `santa-method` |
| Breaking a feature into steps | `planner` |
| Code review for bugs / security | `code-reviewer` |
| Founder/CEO scope review (single voice) | `plan-ceo-review` |

## The 14 Dimensions

Every question is scored 0–10 on each. See `dimensions.md` for definitions.

1. `operational_excellence` — mechanisms, execution discipline
2. `visionary` — 10-star thinking, what's possible at scale
3. `ecosystem_platform` — flywheels, developer adoption, network effects
4. `speed_velocity` — shipping speed, decision velocity, vertical integration
5. `brand_narrative` — story, taste, consumer perception, demo-ability
6. `capital_allocation` — where dollars go, ROIC, mechanism design
7. `consumer_product_ux` — end-user experience, behavior, taste
8. `ai_infrastructure` — compute economics, model/data infrastructure
9. `market_creation` — new categories, supercycles
10. `responsible_deployment` — scale safety, regulatory, multi-stakeholder
11. `first_principles` — physics-bound reasoning, deletion, premise challenge
12. `distribution` — getting product to users at scale, channels, GTM
13. `customer_obsession` — working backwards from the customer
14. `long_term_thinking` — multi-decade horizon, durable bets

## The Voice Library

Defined in `voices/`. Each voice is a markdown file with YAML frontmatter (name, domain, signature move, time horizon, signature question, bias watch, and a 14-element `dimension_weights` table).

**Default roster (6):** Jobs, Musk, Bezos, Huang, Pichai, Andreessen.
**Optional (3):** Nadella, Munger, Grove.
**Fork:** drop a new `voices/<name>.md` matching the schema.

### Voice profile schema (frontmatter)

```yaml
name: <slug>
display_name: <Full Name>
era: "<years and roles>"
domain: <one-line lens>
signature_move: |
  <how they reason>
time_horizon: <years>
signature_question: "<the question they ask>"
bias_watch: <where they tend to be wrong — synthesizer-only, not injected to the persona prompt>
dimension_weights:
  operational_excellence: <0-10>
  visionary: <0-10>
  ecosystem_platform: <0-10>
  speed_velocity: <0-10>
  brand_narrative: <0-10>
  capital_allocation: <0-10>
  consumer_product_ux: <0-10>
  ai_infrastructure: <0-10>
  market_creation: <0-10>
  responsible_deployment: <0-10>
  first_principles: <0-10>
  distribution: <0-10>
  customer_obsession: <0-10>
  long_term_thinking: <0-10>
default_roster: <true|false>
```

## Voice Selection Algorithm (2–8 voices)

1. **Score the question** on the 14 dimensions (0–10 each). Be honest — most questions are not 10 on everything.
2. **Compute each voice's relevance** as the dot product of their dimension weights and the question's dimension scores:
   `relevance(v) = Σ_d voice_weights[v,d] × question_scores[d]`
3. **Rank voices by relevance** descending.
4. **Pick N where 2 ≤ N ≤ 8:**
   - Narrow, single-domain Type 1 → N = 2–3 (top relevance)
   - Standard cross-domain Type 1 → N = 4–6
   - High-complexity multi-domain Type 1 → N = 6–8
   - Type 2 → use `/council` or just decide; rarely needs this skill at all
5. **Diversity guardrail:** if the top-N is dominated by one dimension (e.g., 5 of 6 voices have their max weight on `ai_infrastructure`), swap the lowest-ranked in for the next voice that adds dimensional coverage. Avoid an echo chamber dressed up as a council.
6. **User override:** the user may add or remove any voice by name. Log the override and why in the decision artifact.

### Believability weighting (derived, not asserted)

In synthesis, each selected voice's weight equals their relevance ÷ sum of selected relevances. The synthesizer surfaces the top 2–3 as **load-bearing** and the rest as **commentary** — explicitly, in the output. No more "I think Jobs is more relevant here" hand-waving.

## Workflow

### Step 0 — Press Release + FAQ (Bezos)

Copy `templates/press-release.md` to `decisions/<slug>/press-release.md`. Fill in:
- 18-month-out headline
- Customer reaction paragraph (what changed, in their words)
- 5 internal FAQs: Why now? Why us? What's hard? What does failure look like? What does the world look like if it works?

If the PR/FAQ reads as nonsense or you can't fill it in, **abort the council** — the question isn't ready.

### Step 1 — Classify decision

- **Type:** Type 1 (one-way door, slow down) or Type 2 (two-way door, decide fast).
- **Horizon:** quarters / years / decade.
- **Domain mix:** which 2–4 dimensions dominate.

Type 2? Stop. Use `/council` or just decide.

### Step 2 — Score the question on 14 dimensions

Write the scores into the decision artifact frontmatter. This is the input to voice selection.

### Step 3 — Select voices (2–8)

Run the algorithm. Show the relevance ranking. Apply user overrides. Lock the roster before any voice fires.

### Step 4 — Pre-council number commit (Musk + Bezos)

Before any persona runs, the synthesizer writes to the decision artifact:

```yaml
synthesizer_initial:
  position: "<one paragraph>"
  kill_threshold:
    metric: "<specific measurable quantity>"
    value: "<the number>"
    by_date: "<absolute date>"
  revisit_date: "<absolute date>"
```

No vibe kill thresholds. If you can't name a metric and a number, the decision isn't real yet.

### Step 5 — Launch selected voices in parallel

Each persona subagent gets only:
- Their full profile (name, domain, signature move, horizon, signature question — *not* the bias note)
- The decision question
- The press release paragraph (not the full FAQ)
- Compact context (constraints, prior commitments)
- Output shape (6 sections, <350 words)

Prompt template:

```text
You are [DISPLAY_NAME] on a [N]-voice tech leadership council. Respond as that operator would — using their actual reasoning patterns, time horizons, and signature moves. Do not caricature; reason in their style.

Your domain weight: [DOMAIN]
Your signature move: [SIGNATURE_MOVE]
Your default time horizon: [TIME_HORIZON]
Your signature question: [SIGNATURE_QUESTION]

Decision question:
[THE QUESTION]

Working-backwards future state (18 months out):
[THE PRESS RELEASE PARAGRAPH]

Context:
[CONSTRAINTS THAT MATTER]

Respond in this exact shape:
1. Position — 1–2 sentences, direct, no hedging
2. Reasoning — 3 bullets using your signature move
3. What I'd build first — the one move you'd make in the first 30/90 days
4. Biggest risk — the failure mode you'd watch for
5. What would change my mind — one specific piece of evidence
6. One thing the others will miss — the texture only your seat sees
7. What the founder is most likely lying to themselves about on this call

Keep under 350 words. Be direct.
```

Note section 7 — Jobs's contribution to v2. Each voice now confronts the founder's blind spots, not just debates the other voices.

### Step 6 — Extract cruxes

Sort every meaningful disagreement into:
- **Fact crux** — different empirical beliefs (resolvable with evidence)
- **Value crux** — different priorities
- **Time-horizon crux** — different windows

Most "disagreements" are time-horizon cruxes in disguise.

### Step 7 — Apply believability weighting

For each selected voice, compute weight = relevance ÷ sum-of-selected-relevances. Name the top 2–3 as load-bearing. Write the weights into the artifact.

### Step 8 — Inversion pass (Munger)

"What would make this fail catastrophically in 24 months?" Check whether any voice surfaced it. If none did, you don't have the right roster on this question — re-run voice selection or add a relevant voice manually.

### Step 9 — Pressure test (optional)

If two voices align strongly against the synthesizer's initial position, re-prompt them with: "What specific evidence in the next 90 days would change your recommendation?" Convert opinion to falsifiable bet.

### Step 10 — Synthesize → write the decision artifact

Write `decisions/<slug>/decision.md` with the schema below. Kill criterion is mandatory and must include metric + value + date. If you can't write one, the verdict is invalid and the run is theater — go back to Step 4.

If the synthesizer's final position **changed** from initial, name which voice's argument changed it. If unchanged, name the voice that came closest to changing it.

## Decision Artifact Schema

`decisions/<slug>/decision.md`:

```yaml
---
decision_id: YYYY-MM-DD-<slug>
slug: <slug>
date: YYYY-MM-DD
title: "<short title>"
classification:
  type: type-1 | type-2
  horizon_years: <int>
  domain_mix: [<dim>, <dim>, <dim>]
dimensions:
  operational_excellence: 0-10
  visionary: 0-10
  ecosystem_platform: 0-10
  speed_velocity: 0-10
  brand_narrative: 0-10
  capital_allocation: 0-10
  consumer_product_ux: 0-10
  ai_infrastructure: 0-10
  market_creation: 0-10
  responsible_deployment: 0-10
  first_principles: 0-10
  distribution: 0-10
  customer_obsession: 0-10
  long_term_thinking: 0-10
voices:
  selected: [<name>, ...]
  excluded: [<name>, ...]
  user_overrides: [{action: add|remove, name: <name>, reason: "..."}]
  relevance:
    <name>: <int>
believability:
  load_bearing: [<name>, <name>, <name>]
  commentary: [<name>, ...]
  weights:
    <name>: <0-1>
synthesizer_initial:
  position: "..."
  kill_threshold:
    metric: "..."
    value: "..."
    by_date: YYYY-MM-DD
  revisit_date: YYYY-MM-DD
verdict:
  recommendation: "..."
  confidence: low | medium | high
  consensus: "..."
  strongest_dissent: "..."
  position_changed: true | false
  changed_by_voice: <name | null>
kill_criterion:
  metric: "..."
  value: "..."
  by_date: YYYY-MM-DD
status: open | revisited | killed | shipped
revisit_log: []
---

# <title>

## Press Release (18 months out)
<inline or reference to press-release.md>

## Positions
### <Voice 1>
<position + 7-section response>

### <Voice 2>
...

## Cruxes
- Fact: ...
- Value: ...
- Time horizon: ...

## Inversion check
Catastrophic failure mode: ...
Surfaced by: <voice or "no voice — flagged separately">

## Verdict
- Recommendation: ...
- Confidence: ...
- Consensus: ...
- Strongest dissent (kept visible): ...
- Kill criterion: <metric> hits <value> by <date> → abandon

## Revisit log
<appended when kill criterion fires or revisit date hits>
```

## Output Format (what the user sees)

Keep the on-screen output scannable. The full structured artifact lives on disk; the chat shows the verdict.

```markdown
## Tech Council: [title]

**Classification:** Type 1 / Type 2 — [one-line reason] · Horizon [X]y
**Dimensions (top 4):** [dim:score, dim:score, dim:score, dim:score]
**Voices (N):** [voice₁ (w%), voice₂ (w%), …] — **load-bearing:** [top 2–3]

### Press release (one paragraph)
[paste]

### Pre-council commit
- **Initial position:** ...
- **Kill threshold (logged):** [metric] hits [value] by [date]
- **Revisit:** [date]

### Positions (one line each, ranked by weight)
**[Voice]** [w%]: [1–2 sentence position]
... (N rows)

### Cruxes
- Fact: ...
- Value: ...
- Time horizon: ...

### Inversion
Catastrophic failure: [...] — surfaced by [...]

### Verdict
- Recommendation: ...
- Confidence: low / medium / high
- Position changed? yes/no [if yes: by whom and which argument]
- Strongest dissent: [...]
- **Kill criterion (mandatory):** [metric] hits [value] by [date] → abandon

Artifact: `decisions/<slug>/decision.md`
```

## Persistence and Revisit

- **Every run writes to disk.** No artifact → no decision.
- **When kill criterion trips:** re-open the artifact, append to `revisit_log`, optionally re-run only the voices whose cruxes are now testable. Status moves to `revisited`, then `killed` or `shipped`.
- **Quarterly review:** look at all `decisions/*/decision.md` — how often did `position_changed: true`? How many kill criteria fired? If neither happens, the council is theater.

## Anti-Patterns

- **No PR/FAQ.** Voices debate vapor. Always Step 0 first.
- **Vibe kill thresholds.** "If it doesn't feel right" is not a kill criterion. Metric + value + date or invalid.
- **Asserting believability.** "I think Jobs is more relevant" is hand-waving. Compute it from dimension scores.
- **Maxing out voices for theater.** 8 voices on a narrow question is noise. The algorithm should usually pick 3–5.
- **Skipping the diversity guardrail.** Five voices that all max on `ai_infrastructure` will reinforce, not challenge.
- **Treating named voices as oracles.** Believability weighting is the whole point — Huang on a B2C brand call is commentary, not verdict.
- **Persisting nothing.** If the artifact is never re-opened, the kill criterion is theater. Fix the calendaring, not the criterion.
- **Cosplay over substance.** Catchphrases are not reasoning. Each voice must *apply* their signature move to *this* decision.
- **Feeding subagents the full conversation.** Defeats the anti-anchoring mechanism. Pass only the question, PR paragraph, and minimal context.

## Related Skills

- `council` — four-archetype version for when named playbooks aren't load-bearing
- `santa-method` — adversarial verification of a specific claim
- `plan-ceo-review` — single-voice founder-mode plan review
- `plan-eng-review` — engineering-feasibility plan review
- `pmf-review` — product-market fit analysis
- `architecture-decision-records` — formalize if it becomes durable system policy
- `knowledge-ops` — persist durable decision deltas

## Example (compressed)

**Question:** Build our own foundation model, fine-tune open, or wrap APIs?

**Dimensions (scored):** ai_infrastructure:10, capital_allocation:9, long_term_thinking:9, ecosystem_platform:8, market_creation:7, first_principles:6, operational_excellence:6, distribution:5, visionary:5, responsible_deployment:5, speed_velocity:4, customer_obsession:3, consumer_product_ux:3, brand_narrative:3.

**Voice relevance (computed):**
- Huang 685, Bezos 624, Andreessen 612, Musk 588, Pichai 555, Nadella 612 *(if added)*, Munger 530, Grove 567, Jobs 478.

**Selected (N=5, Type 1 cross-domain):** Huang, Bezos, Andreessen, Musk, Pichai. Jobs excluded (lowest fit on this question — brand isn't load-bearing here). User adds Nadella manually (operator with relevant AI-platform scar tissue) → N=6.

**Load-bearing (top weights):** Huang (24%), Bezos (22%), Andreessen (21%). Commentary: Musk, Pichai, Nadella.

**Pre-council commit:** "Wrap commodity APIs; revisit if unit economics break." Kill threshold: blended inference cost per agent task > $0.40 at 1M tasks/month by 2027-05-22. Revisit: 2026-11-22.

The artifact lands at `decisions/2026-05-22-foundation-model/decision.md` with the full verdict + dissent.
