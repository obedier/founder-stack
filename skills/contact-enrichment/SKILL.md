---
name: contact-enrichment
description: >-
  Enrich property/listing records with owner identity + contact info (name, mailing
  address, phone, email) into a human-review CSV, using a cost-first escalation ladder:
  free county property-appraiser records via a headless browser, then a paid skip-trace
  API only for phone/email. Read-only on the source; output is review-only, never bulk
  outreach. Triggers: "enrich contacts", "skip trace", "find owner phone/email",
  "property owner lookup", "append contact info to listings", "who owns this address".
---

# Contact Enrichment (property/listing owners → reviewable contacts)

Turn a set of records that have an **address** (and maybe a partial name) into a
human-review CSV of **owner name + mailing address + phone + email**, cheaply and
compliantly. Every lookup is deterministic code or a metered API — never one LLM agent
per record.

## When to use
- You have listings/parcels/addresses and need owner identity and/or contact info.
- You want a review file for a human to verify before any use — not auto-import, not DB writes.

## When NOT to use
- Bulk cold-outreach / spam list building. This skill produces a **review file only**;
  calling/texting/emailing is gated behind compliance (below).
- Circumventing a site's anti-bot to scrape data it deliberately blocks. Use the site's
  bulk-data download instead (see ladder step d).

## The escalation ladder (cheapest + most authoritative first — this is the core)
Work top-down; stop when you have what you need.

**a. Enumerate (free, read-only).** Pull records from the source DB/file into a normalized
JSON list with a **stable id**, address parts, and existing-contact status. Never write the
source. → `scripts/enumerate.js` (adapt the model/query to the project).

**b. County property appraiser (free, authoritative).** Address → **owner name + mailing
address + parcel/folio**, by driving the county appraiser's site in the `/browse` headless
browser. Deterministic, **zero LLM tokens per record**, resumable. Most appraiser sites are
JS SPAs that block `curl`/`WebFetch` — the headless browser renders them. → `scripts/bcpa_driver.js`
(Broward/BCPA is the worked example; add other counties as **config**: search URL, input
selector, result parser). Owner-of-record ≠ phone/email — appraiser data never has those.

**c. Skip-trace / append API (paid, for phone/email only).** Name+address → phone(s)+email(s)
+ DNC/TCPA flags. **Provider-agnostic adapter**; a Tracerfy adapter ships here.
→ `scripts/contact_append.js` (single/instant) and `scripts/tracerfy_batch.js` (bulk).
**Always prefer the BATCH endpoint** (Tracerfy normal = 1 credit/$0.02) over instant
(5 credits/$0.10) — 5× cheaper, **misses are free**. Load keys from `~/.keys.sh`, never the CLI/repo.

**d. Free bulk-data fallback (no API cost).** Voter files and corp/business registries
(e.g. FL sunbiz) publish **bulk data downloads** — load to a local table, join by
name+address. Note: some registries hard-block live automation (sunbiz returns 403 to both
`curl` and the headless browser) — **do not circumvent access controls; use the download**.

## Resumable ledger pattern (used throughout)
- **Append-only CSV is the source of truth.** A record is "done" iff its id is already a row.
- **Idempotent + resumable:** membership check by id; never emit a duplicate.
- **Single coordinated writer**; **per-row flush** so a timeout/kill never loses progress.
- A **STATE.md** the loop reads first (see `templates/STATE.example.md`).
- Harness commands: `select`, `write`, `emit-complete` (cheap review-only rows for records
  that already have contact), `summary`. → `scripts/harness.js`.

## Compliance (non-negotiable)
Appended phone/email is **personal data**. Output is **review-only**.
- Calls/texts → **TCPA + Federal/State DNC**; email → **CAN-SPAM**. Respect every
  provider's **ToS**.
- Require an explicit opt-in (`APPEND_CONFIRM_COMPLIANT=1`) before any **paid** append; the
  tools refuse to spend without it.
- **DNC-scrub** phones before outreach (Tracerfy `/v1/api/dnc/scrub-from-queue/`, 1 credit/phone,
  returns a clean-phones list); flag `dnc`/`litigator` numbers. Honor takedown/claim/opt-out.
- Never use the output for bulk cold outreach.

## Cost discipline
- Cheapest authoritative source first (free appraiser before paid API).
- **Batch over instant.** Misses are free — don't pre-filter so hard you skip easy hits.
- **Pilot ~10, report hit-rate + $/record, then scale.** Checkpoint before large spends.
- `log()` what you skipped (a silent top-N cap reads as "covered everything").

## Anti-patterns (learned the expensive way — do NOT repeat)
- ❌ **One LLM agent per record** for structured lookups. On JS SPAs they thrash for minutes
  and dollars and can recursively spawn more agents. Use deterministic scripts + `/browse`.
- ❌ **Guessing an API contract.** Verify endpoint + content-type + required fields with ONE
  probe first. (Tracerfy batch needs `multipart/form-data`, not JSON — JSON → 415 free; and
  `normal` traces require name + mailing columns — missing → 400 free.)
- ❌ **Losing the id on the way back.** Pass a passthrough `id` column into batch jobs so
  results map back exactly; keep a normalized address+city fallback.
- ❌ **Reusing a stale page** on a stateful SPA. Fresh-load per query or you re-read the last result.
- ❌ **Committing PII.** gitignore the review CSVs and any `~/.keys.sh`; commit only the scripts.

## Quickstart
```bash
# a. enumerate source → cache + create the ledger with headers
node scripts/enumerate.js | node scripts/harness.js init

# b. free county owner+mailing via headless browser (resumable, no LLM cost)
node scripts/bcpa_driver.js 400          # processes next N unwritten; per-row flush

# (cheap) review-only rows for records that already have contact
node scripts/harness.js emit-complete

# c. paid phone/email — BATCH (cheapest); keys from ~/.keys.sh; compliance opt-in required
TRACE_TYPE=normal APPEND_CONFIRM_COMPLIANT=1 node scripts/tracerfy_batch.js
#   single/instant probe or provider-agnostic path:
PROVIDER=tracerfy APPEND_CONFIRM_COMPLIANT=1 node scripts/contact_append.js 10

node scripts/harness.js summary          # final concise summary
```

## Adapting to a new project
1. **enumerate.js** — point at the project's records; emit `{id, address, city, state, zip, existing_*}`.
2. **County config** in the appraiser reader — set the search URL, input selector, and result
   parser for each county you cover (BCPA is the example). Set `BROWSE_BIN` to your headless
   browser binary.
3. **Provider** — a key in `~/.keys.sh` (e.g. `TRACERFY_API_KEY`); or add an adapter.
4. Keep the ledger columns and compliance gate intact.
