---
name: viewpoint
version: 1.1.0
description: |
  Get a different viewpoint / second opinion from independent frontier models
  hosted on NVIDIA's platform (integrate.api.nvidia.com). Use when you want to
  pressure-test a plan, decision, design, or piece of reasoning against models
  from other labs — a "council of experts" that is NOT Claude. Triggers:
  "different viewpoint", "second opinion", "what would another model say",
  "council", "devil's advocate", "sanity check this with another model".
origin: custom
allowed-tools:
  - Bash
  - Read
---

# /viewpoint — A Different Viewpoint from an Independent Council

Claude (you) is one perspective. This skill sends the current question, plan, or
reasoning to **frontier models from other labs** hosted on NVIDIA's inference
platform, so the user gets a genuinely independent second opinion instead of a
single model agreeing with itself.

## When to use

- The user asks for a "different viewpoint", "second opinion", or "council".
- A decision is ambiguous and would benefit from adversarial or diverse input.
- Before committing to an architecture, plan, or tradeoff you want a sanity check.
- The user wants a devil's-advocate / red-team read from a non-Claude model.

Do **not** use it for factual lookups or anything where a single authoritative
answer exists — this is for *judgment*, not retrieval.

## Setup (already done on this machine)

- **Endpoint:** `https://integrate.api.nvidia.com/v1` (OpenAI-compatible).
- **Auth:** `NVIDIA_API_KEY1` in `~/.keys.sh`. The helper script reads it
  automatically (env var first, then parses `~/.keys.sh`). Never print the key.

## The council (default 3 models)

Picked for **reliability + capability + independent training lineages** — three
labs, three regions, so their agreement or disagreement actually means something:

| Model id | Lab / region |
|---|---|
| `moonshotai/kimi-k2.6` | Moonshot AI (CN) — strong agentic/reasoning |
| `z-ai/glm-5.1` | Zhipu AI (CN) — strong reasoning |
| `mistralai/mistral-large-3-675b-instruct-2512` | Mistral AI (EU) — fast, decisive |

Deliberately excluded: `deepseek-v4-pro` (self-identifies as Claude → likely
Claude-distilled → correlated views, defeats the point), `qwen3.5-397b` and
`openai/gpt-oss-120b` (timed out >110s — too unreliable for a live council),
`nvidia/*-nemotron-ultra` (404 — not enabled on this account).
Solid alternates you can swap in: `meta/llama-3.3-70b-instruct` (US lineage,
very fast), `mistralai/mistral-large-2-instruct`.

## How to run it

The helper script is `nvidia_ask.py` in this skill's directory. Prefer piping
the prompt on stdin so long/multi-line context is passed cleanly.

**Full council (parallel, ~15–20s):**
```bash
echo "PROMPT / plan / question here" | python3 <skill-dir>/nvidia_ask.py --council
```

**Single model:**
```bash
echo "PROMPT" | python3 <skill-dir>/nvidia_ask.py -m z-ai/glm-5.1
```

**With a role / adversarial framing:**
```bash
echo "PROMPT" | python3 <skill-dir>/nvidia_ask.py --council \
  -s "You are a skeptical staff engineer. Argue the strongest case AGAINST this."
```

**List all available model ids:** `python3 <skill-dir>/nvidia_ask.py --list`

`<skill-dir>` is this skill's folder — `~/.claude/skills/viewpoint/` when
installed, or `skills/viewpoint/` in the founder-stack repo.

### Flags
- `--council` — query all 3 council models in parallel (one process, threaded).
- `-m, --model` — single model id (default `moonshotai/kimi-k2.6`).
- `--challenge "<leaning>"` — **red-team framing (enhancement #1).** Forces every
  model to argue the strongest case *against* the stated leaning before giving its
  own take. Pass your (Claude's) current leaning so your framing doesn't
  pre-decide the answer at both ends of the pipeline.
- `--structured` — **disagreement-first output (enhancement #2).** Each model
  returns `POSITION / CONFIDENCE / REASONING / CRUX / BLIND SPOT`. The CRUX and
  BLIND SPOT fields are what let you separate real divergence from shared-training
  agreement. Composes with `--challenge` and `-s`.
- `-s, --system` — extra system prompt, appended after the above.
- `--max-tokens` (default 2048), `--temperature` (default 0.3), `--timeout` (default 120).
- `--json` — raw JSON instead of formatted sections.

**Recommended default for real decisions:**
```bash
echo "PROMPT" | python3 <skill-dir>/nvidia_ask.py --council --structured \
  --challenge "Claude leans toward <your current recommendation>"
```

## Workflow

1. **Commit to your own answer first.** Before calling the council, decide what
   *you* (Claude) recommend. This is what you'll hand to `--challenge` so the
   council attacks your leaning instead of being led toward it.
2. **Frame a self-contained prompt.** The council has none of this conversation's
   context. Include the decision, the real constraints (the ones that actually
   drive the answer — team skills, scale, deadlines), prior art you rejected, and
   what you want. Ask for a *clear stance*, not "it depends".
3. **Run the council adversarially + structured** (the recommended default above):
   `--council --structured --challenge "Claude leans toward X"`.
4. **Synthesize disagreement-first — do not average.**
   - **Lead with the sharpest disagreement** and the CRUX behind it. That's the
     paid signal; unanimous agreement is likely stuff you already knew (shared
     training bias, not independent confirmation).
   - **Use the BLIND SPOT / cross-prediction as a correlation check:** if the
     models accurately predict each other, treat their agreement as *correlated*
     and discount it; if they genuinely surprise each other, that's real diversity.
   - **Weigh by CONFIDENCE + CRUX,** not by vote count.
   - **State whether it changed your mind,** and give the user your final call.
5. **Always attribute.** Label external opinions clearly as coming from
   Kimi / GLM / Mistral via NVIDIA — never present them as your own.

## Data-sharing guardrail (context handoff)

Everything in the prompt is sent to a third-party inference endpoint (NVIDIA +
the model labs). **Do not paste secrets, credentials, or proprietary source**
into the council prompt without the user's OK. Prefer describing code over
pasting it; if raw snippets genuinely help, redact identifiers and say what you
sent. (A consent-gated `--context-file` attach flow is the planned enhancement #3.)

## Gotchas

- **Reasoning models leak thinking.** `kimi-k2.6` is a reasoning model and may
  return its chain-of-thought inside the answer text. That's expected; quote the
  conclusion, not the scratch work. Give reasoning models room (`--max-tokens
  1024+`) or they can return an empty final answer.
- **Empty answer field** → the script falls back to the `reasoning_content`
  field and labels it; if a model returns nothing useful, drop it and note that.
- **Per-model failures don't abort the council.** A model that errors/times out
  is reported inline as `ERROR:`; the others still return.
- **Cost/latency.** This calls external paid inference on the user's NVIDIA key.
  Use `--council` for real decisions, a single model for quick gut-checks. Keep
  `--max-tokens` modest for cheap runs.
- **Key hygiene.** The key lives in `~/.keys.sh`; the script reads it directly.
  Don't echo it, don't pass it on the command line.
