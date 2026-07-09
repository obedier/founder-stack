# Dock Contact Enrichment — Loop State

STATUS: running (PAUSED at pilot checkpoint for human go/no-go)

## Discovery (verified 2026-07-09)
- Sources: Dock (922) + SourcedListing (1253) = 2175 total. Mongo Atlas via server/.env.
- Existing-contact status at enumerate: complete 960, partial 207, empty 1008.
- Read-only via scripts/enrichment/enumerate.js → .enrichment/listings.json (cached, 2175).
- Ledger: dock_contact_enrichment_review.csv (append-only, dedup by dock_listing_id).
- Harness: scripts/enrichment/harness.js (init|select <N> [--need]|write|emit-complete|summary).

## Progress
- Pilot: 40 research-needed (partial) listings processed + written. Rows in CSV = 40.
- Remaining: 2135 (960 complete → cheap review-only rows via `emit-complete`; 1175 empty/partial → web research).

## Pilot findings (drives go/no-go)
- Dominant sourced source = dockskipper.com, which GATES contact behind login → most rows
  land partial_contact_found / low confidence with host NAME known but no new email/phone.
- Of 40: researched_email on 2, researched_phone on 4. 1 high-confidence (Lovell BOATique →
  Rose Ann Lovell). 4 verified_related_source (marina office lines). 4 errors. 26 low.
- Cost: ~$1.50/researched listing. Full 1175 research-needed ≈ ~$1.7k more. Low yield.

## Resume
- Continue research: `harness.js select 25 --need` → dispatch research agents → `harness.js write`.
- Cheap-emit complete rows: `harness.js emit-complete` (no web research; 960 review-only rows).
- Final: `harness.js summary`. Complete when CSV rows == 2175.

## BCPA /browse reader — VALIDATED (2026-07-09)
- WORKS. Yield: 4/5 authoritative owner + mailing address (5th needs re-query). First
  names in PierShare titles corroborate owners (Samuel→Schwartz, Joseph→More, Mayra→Quintero).
- Recipe (deterministic, NO LLM tokens per lookup):
  1. browse goto 'https://web.bcpa.net/BcpaClient/#/Record-Search' + reload; sleep 3
  2. snapshot -i → input ref (@e19 "Name, Address, Folio")
  3. fill ref "<street>, <city>"; press Enter; sleep 4
  4. text → parse "Owner Name / Site Address" + "Mailing Address" + folio
  MUST fresh-goto+reload per address (stale results otherwise).
- Gives owner NAME + MAILING ADDRESS + folio (NOT email/phone). High confidence when
  site address matches listing exactly. For email/phone: sunbiz (LLC owners) — untested.
- Miami-Dade PA (miamidade.gov/pa) equivalent reader: NOT yet built/tested.
- Scale target: ~1017 PierShare addresses (Broward via BCPA, Miami-Dade via its PA).
  Cheap per lookup but uses orchestration turns → build a browse-driver script to batch.
- CSV now 45 rows (40 DockSkipper pilot + 5 BCPA validated).

## Broward BCPA run COMPLETE + free-append findings (2026-07-09)
- BCPA batch: 250/317 owners found (79%), 168 exact-address high-confidence. CSV = 369 rows.
- 61 owners are LLC/entity (sunbiz-addressable); rest individuals/trusts.
- Contact append tool: scripts/enrichment/contact_append.js — provider-agnostic, mock-tested,
  compliance-gated (APPEND_CONFIRM_COMPLIANT=1). Ready for a paid provider (Searchbug/Tracerfy).
- FREE Tier-2 route (user choice) — BLOCKED for live scraping:
  * sunbiz.org: 403 to BOTH curl AND headless browser (anti-bot). NOT live-scrapable. Legit
    free path = FL Div. of Corporations BULK DATA DOWNLOAD (quarterly files w/ registered-agent
    name+address): https://dos.fl.gov/sunbiz/other-services/data-downloads/
  * FL voter file: free/low-cost BULK file from FL Div. of Elections (name+address+phone for many
    registrants) — a data request, not a live API.
  => Both free sources are BULK DOWNLOADS, not per-record live lookups. Wire by obtaining the file,
     loading to a local table, joining by name+address. No per-record cost, but a data-acquisition
     step. Paid skip-trace API remains the only turnkey per-record phone/email path.
