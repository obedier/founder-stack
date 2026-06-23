# Dimensions

The 14 dimensions used to score a question and weight each voice. Definitions kept short and operational — these are not abstract values, they are *what an operator's track record demonstrably maps to*.

| Dimension | What it means | Score 10 means |
| --- | --- | --- |
| `operational_excellence` | Building durable mechanisms, execution discipline, repeatable systems | The decision lives or dies on whether the mechanism holds at scale (think six-page memos, two-pizza teams, Gemba walks) |
| `visionary` | 10-star thinking, redefining what's possible, multi-decade ambition | The question is "what does the world look like in 10 years if we're right" |
| `ecosystem_platform` | Flywheels, developer adoption, network effects, platform economics | Winner controls the platform other people build on (CUDA, AWS, iOS) |
| `speed_velocity` | Shipping speed, decision velocity, vertical-integration tempo | The bottleneck is "how fast can we move from idea to production" (not "is it the right idea") |
| `brand_narrative` | Story, taste, consumer perception, demo-ability | A stranger has to understand and want this in 10 seconds |
| `capital_allocation` | Where dollars go, ROIC, mechanism design around money | The decision is fundamentally about how to spend or save large amounts of capital |
| `consumer_product_ux` | End-user experience, behavior, taste | The product touches non-technical end-users and the experience is load-bearing |
| `ai_infrastructure` | Compute economics, model/data infrastructure, AI systems engineering | Compute cost curves, model performance, or infra moats are central |
| `market_creation` | New categories, supercycles, going from 0→1 | The market doesn't exist yet; this bet creates it |
| `responsible_deployment` | Scale safety, regulatory navigation, multi-stakeholder rollout | Failure modes include regulator backlash, safety incidents at scale, or harm to specific user populations |
| `first_principles` | Physics-bound reasoning, deletion, premise challenge | Every assumption has to be re-derived from physical/economic floor |
| `distribution` | Getting product to users at scale, channels, GTM | Distribution is the moat (or the missing thing) |
| `customer_obsession` | Working backwards from the customer, relentless customer focus | The right answer comes from a deep customer truth, not a strategic frame |
| `long_term_thinking` | Multi-decade horizon, durable bets, generational businesses | The decision only pays off over 10+ years and short-term ROI is a distraction |

## How to score a question

Read the question. For each dimension, ask: "Is this dimension materially load-bearing in this decision?"

- **9–10:** Central. The decision *is* this dimension. Strip it away and the question makes no sense.
- **6–8:** Important. The dimension materially affects which path wins.
- **3–5:** Relevant. The dimension is in the room but isn't determinative.
- **0–2:** Mostly absent. The dimension barely touches the decision.

Be honest. Most strategic questions are 9–10 on 2–4 dimensions, 6–8 on 3–5, and lower on the rest. If everything scores 8+, you haven't really read the question.

## Calibration examples

**Q: "Open-source our agent framework or keep it proprietary?"**
- `ecosystem_platform: 10` (this is fundamentally about flywheel design)
- `distribution: 9` (open-source is a distribution strategy)
- `market_creation: 8` (and category positioning)
- `capital_allocation: 7` (revenue model shifts materially)
- `long_term_thinking: 8`
- `brand_narrative: 6` (developer perception matters)
- `operational_excellence: 5` (community ops are real but secondary)
- `consumer_product_ux: 3` (this is dev-facing)
- `ai_infrastructure: 5`, `responsible_deployment: 4`, `first_principles: 5`, `customer_obsession: 6`, `speed_velocity: 5`, `visionary: 7`

**Q: "Ship our AI feature now with rough edges or hold for polish?"**
- `consumer_product_ux: 10`, `brand_narrative: 9`, `speed_velocity: 9`, `responsible_deployment: 7`, `customer_obsession: 8`, `distribution: 6`, others lower.

**Q: "Build our own foundation model?"**
- `ai_infrastructure: 10`, `capital_allocation: 9`, `long_term_thinking: 9`, `ecosystem_platform: 8`, `market_creation: 7`, `first_principles: 6`, others lower.

## Adding a dimension

If a real decision keeps surfacing a lens that doesn't fit any existing dimension, add it here. Then add the corresponding weight to every voice profile in `voices/`. Don't add dimensions speculatively — only when a real decision pulled one out.
