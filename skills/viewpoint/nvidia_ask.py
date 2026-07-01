#!/usr/bin/env python3
"""Query NVIDIA-hosted models (integrate.api.nvidia.com, OpenAI-compatible) for a
second opinion / different viewpoint.

Auth: reads $NVIDIA_API_KEY1 (or $NVIDIA_API_KEY); falls back to parsing ~/.keys.sh.
Stdlib only — no pip installs.

Examples:
  echo "Is Postgres or SQLite right for a single-user desktop app?" | ./nvidia_ask.py
  ./nvidia_ask.py -m z-ai/glm-5.1 -s "You are a skeptical staff engineer." "Critique this plan: ..."
  ./nvidia_ask.py --council < prompt.txt          # ask all 3 council models in parallel
  ./nvidia_ask.py --list                          # list available model ids
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
KEYS_FILE = Path.home() / ".keys.sh"

# Curated council: three frontier models from three independent labs/regions.
# Chosen for reliability + capability + genuinely different training lineages.
COUNCIL = [
    ("moonshotai/kimi-k2.6", "Kimi (Moonshot AI)"),
    ("z-ai/glm-5.1", "GLM (Zhipu AI)"),
    ("mistralai/mistral-large-3-675b-instruct-2512", "Mistral Large 3 (Mistral AI)"),
]
DEFAULT_MODEL = COUNCIL[0][0]

# --structured: force cruxes + cross-prediction so the synthesizer can tell real
# divergence from shared-training-bias agreement (council enhancement #2).
STRUCTURED_SYSTEM = """You are one voice on an independent review council. \
Answer in exactly this structure, and take a clear stance (never "it depends"):

POSITION: your recommendation in 1-2 sentences.
CONFIDENCE: an integer 0-100 for how sure you are.
REASONING: the strongest 2-4 concrete points for your position.
CRUX: the single fact or condition that, if false, would flip your answer.
BLIND SPOT: what a model trained differently from you might argue instead, and \
why they could be right.

Be specific. Do not hedge or pad."""

# --challenge: red-team the proposer's leaning so Claude's framing does not
# pre-decide the answer at both ends of the pipeline (council enhancement #1).
CHALLENGE_TEMPLATE = """The proposer is currently leaning toward this position:
"{leaning}"
Do NOT simply agree. First argue the strongest, most specific case AGAINST it, \
name what it overlooks or gets wrong, and propose at least one concrete \
alternative. Only then give your own final recommendation."""


def build_system(structured, challenge, user_system):
    """Compose the final system prompt from optional parts (order matters:
    challenge framing first, then output-format scaffold, then user override)."""
    parts = []
    if challenge:
        parts.append(CHALLENGE_TEMPLATE.format(leaning=challenge.strip()))
    if structured:
        parts.append(STRUCTURED_SYSTEM)
    if user_system:
        parts.append(user_system)
    return "\n\n".join(parts) or None


def load_key():
    key = os.environ.get("NVIDIA_API_KEY1") or os.environ.get("NVIDIA_API_KEY")
    if key:
        return key.strip()
    try:
        text = KEYS_FILE.read_text()
    except OSError:
        return None
    m = re.search(r'NVIDIA_API_KEY1\s*=\s*"?([^"\n]+)"?', text)
    return m.group(1).strip() if m else None


def ask(model, prompt, system, max_tokens, temperature, timeout, key):
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    body = json.dumps({
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }).encode()
    req = urllib.request.Request(
        BASE + "/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:400]
        raise RuntimeError(f"HTTP {e.code}: {detail}")
    except (urllib.error.URLError, TimeoutError) as e:
        raise RuntimeError(f"request failed after {time.time()-t0:.0f}s: {e}")
    elapsed = time.time() - t0
    msg = data["choices"][0]["message"]
    content = (msg.get("content") or "").strip()
    reasoned = False
    if not content:
        content = (msg.get("reasoning_content") or "").strip()
        reasoned = bool(content)
    usage = data.get("usage", {})
    return {
        "model": data.get("model", model),
        "content": content or "<empty response>",
        "reasoned_only": reasoned,
        "completion_tokens": usage.get("completion_tokens"),
        "total_tokens": usage.get("total_tokens"),
        "elapsed": elapsed,
    }


def list_models(key):
    req = urllib.request.Request(
        BASE + "/models", headers={"Authorization": f"Bearer {key}"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return sorted(m["id"] for m in data.get("data", []))


def print_result(res, label=None):
    head = label or res["model"]
    meta = f"{res['model']} · {res['elapsed']:.0f}s"
    if res.get("completion_tokens") is not None:
        meta += f" · {res['completion_tokens']} tok"
    if res.get("reasoned_only"):
        meta += " · (reasoning trace — no final answer field)"
    print(f"\n{'='*70}\n### {head}\n_{meta}_\n{'-'*70}")
    print(res["content"])


def main():
    ap = argparse.ArgumentParser(description="Ask NVIDIA-hosted models for a viewpoint.")
    ap.add_argument("prompt", nargs="*", help="prompt text (or pipe via stdin)")
    ap.add_argument("-m", "--model", default=DEFAULT_MODEL, help="model id")
    ap.add_argument("-s", "--system", default=None, help="system prompt")
    ap.add_argument("--structured", action="store_true",
                    help="require POSITION/CONFIDENCE/CRUX/BLIND SPOT output")
    ap.add_argument("--challenge", default=None, metavar="LEANING",
                    help="red-team framing: force the case AGAINST this leaning")
    ap.add_argument("--council", action="store_true",
                    help="query all 3 council models in parallel")
    ap.add_argument("--max-tokens", type=int, default=2048)
    ap.add_argument("--temperature", type=float, default=0.3)
    ap.add_argument("--timeout", type=int, default=120)
    ap.add_argument("--json", action="store_true", help="emit raw JSON")
    ap.add_argument("--list", action="store_true", help="list model ids and exit")
    args = ap.parse_args()

    key = load_key()
    if not key:
        sys.exit("ERROR: no NVIDIA API key. Set $NVIDIA_API_KEY1 or add it to ~/.keys.sh")

    if args.list:
        for mid in list_models(key):
            print(mid)
        return

    prompt = " ".join(args.prompt).strip() or sys.stdin.read().strip()
    if not prompt:
        sys.exit("ERROR: empty prompt (pass as args or pipe via stdin)")

    system = build_system(args.structured, args.challenge, args.system)

    if args.council:
        results = {}
        with ThreadPoolExecutor(max_workers=len(COUNCIL)) as pool:
            futs = {
                pool.submit(ask, mid, prompt, system, args.max_tokens,
                            args.temperature, args.timeout, key): (mid, label)
                for mid, label in COUNCIL
            }
            for fut in futs:
                mid, label = futs[fut]
                try:
                    results[mid] = (label, fut.result())
                except Exception as e:  # noqa: BLE001 — report per-model, keep others
                    results[mid] = (label, {"error": str(e)})
        if args.json:
            print(json.dumps({k: v[1] for k, v in results.items()}, indent=2))
            return
        for mid, label in COUNCIL:  # stable order
            label, res = results[mid]
            if "error" in res:
                print(f"\n{'='*70}\n### {label}\n_{mid}_\n{'-'*70}\nERROR: {res['error']}")
            else:
                print_result(res, label)
        return

    res = ask(args.model, prompt, system, args.max_tokens,
              args.temperature, args.timeout, key)
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print_result(res)


if __name__ == "__main__":
    main()
