# /cgo — Chief Growth Officer & Growth Team

Point an orchestrated growth-marketing team at any project to plan and run real
SEO + paid/performance marketing, with measurement and approval gates.

## Usage

```
/cgo <project path | product | URL> [goal]
/cgo grow "https://example.com" "cut CAC, scale paid search"
/cgo audit <project>          # audit-only: no execution, produces the growth plan + artifacts
/cgo report <project>         # measurement cycle only: pull data, score, re-prioritize
```

With no goal, the CGO diagnoses the biggest growth constraint and proposes one.

## What it does

Runs the **`cgo` skill** workflow — see `skills/cgo/SKILL.md` for the full phase
sequence. In short:

1. **Ground** in `.agents/product-marketing.md` (generate if missing).
2. **Strategize** — the `cgo` agent sets constraint metric, channel mix, budget, targets.
3. **Fan out** to the specialist leads (parallel):
   - `growth-seo-lead` · `growth-paid-lead` · `growth-analytics-lead` · `growth-cro-lead` · `growth-content-lead`
4. **Synthesize** into a sequenced program.
5. **Execute with approval gates** — autonomous for research/audits/drafts/read-only data; **PAUSE for explicit OK** before any live spend change or publish.
6. **Measure & loop** — report against the constraint metric; scale / hold / kill; stand up recurring loops via `marketing-loops`.

## Team & backing skills

Six agents (`agents/cgo.md` + `agents/growth-*-lead.md`) backed by the vendored
`cgo-marketing` suite (46 skills + 65 platform CLIs) and the founder-stack content
stack. Live data/execution via the **Supermetrics MCP** and `skills/cgo-marketing/tools/clis/`.

## Defaults

- **Autonomy:** execute-with-approval (spend/publish gated). Use `/cgo audit` for advisory-only.
- **Budget:** never exceeds the envelope the CGO sets with you up front.
- **Attribution:** external analysis is always labeled; metrics are never fabricated.
