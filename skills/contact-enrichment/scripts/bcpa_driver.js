#!/usr/bin/env node
/**
 * Deterministic BCPA (Broward County Property Appraiser) owner+mailing reader.
 * Drives the /browse headless browser (NO LLM tokens). Read-only on the web; writes
 * result rows to the CSV via harness. Resumable (skips ids already in the ledger).
 *
 * Usage: node scripts/enrichment/bcpa_driver.js [LIMIT]     (default LIMIT=30)
 * Reads Broward-PierShare-unwritten from /tmp/broward_todo.json (id,url,addr,city,state,zip,name).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BROWSE = process.env.BROWSE_BIN || '/Users/osamabedier/.claude/skills/gstack/browse/dist/browse';
const ROOT = path.join(__dirname, '../..');
const TODO = '/tmp/broward_todo.json';
const CSV = path.join(ROOT, 'dock_contact_enrichment_review.csv');
const HARNESS = path.join(__dirname, 'harness.js');
const LIMIT = parseInt(process.argv[2] || '30', 10);
const SEARCH_URL = 'https://web.bcpa.net/BcpaClient/#/Record-Search';

function br(args, timeout = 30000) {
  try { return execFileSync(BROWSE, args, { timeout, encoding: 'utf8' }); }
  catch (e) { return (e.stdout || '') + (e.stderr || ''); }
}
function sleepSync(sec) { try { execFileSync('sleep', [String(sec)]); } catch {} }
function writtenIds() {
  if (!fs.existsSync(CSV)) return new Set();
  const ids = new Set();
  const lines = fs.readFileSync(CSV, 'utf8').split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]; if (!l) continue;
    const id = l[0] === '"' ? (l.match(/^"((?:[^"]|"")*)"/) || [])[1] : l.split(',')[0];
    if (id) ids.add(id);
  }
  return ids;
}
function ensureServer() {
  br(['goto', SEARCH_URL], 30000);
  br(['reload'], 20000);
  sleepSync(3);
}
function extract() {
  const js = '(function(){var t=document.body.innerText;function m(re){var x=t.match(re);return x?x[1].trim():""}' +
    'var owner=m(/Property Owner\\(s\\):\\s*\\n?\\s*([^\\n]+)/i);' +
    'var mailing=m(/Mailing Address:\\s*\\n?\\s*([^\\n]+?)(?:click here|\\n)/i);' +
    'var folio=m(/(\\d{10,})/);' +
    'var multi=/results? found|please select|matching records/i.test(t) && !owner;' +
    'return JSON.stringify({owner:owner,mailing:mailing,folio:folio,multi:multi});})()';
  const out = br(['js', js], 20000);
  const line = out.split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'));
  try { return JSON.parse(line); } catch { return { owner: '', mailing: '', folio: '', multi: false }; }
}
function lookup(streetCity) {
  ensureServer();
  const snap = br(['snapshot', '-i'], 20000);
  const refLine = snap.split(/\r?\n/).find((l) => /textbox/i.test(l) && /Name, Address, Folio/i.test(l));
  const ref = refLine && (refLine.match(/@e\d+/) || [])[0];
  if (!ref) return { owner: '', mailing: '', folio: '', multi: false, err: 'no-input' };
  br(['fill', ref, streetCity], 15000);
  sleepSync(1);
  br(['press', 'Enter'], 15000);
  sleepSync(4);
  return extract();
}

function leadingNum(addr) { const m = (addr || '').match(/^\s*(\d+)/); return m ? m[1] : ''; }
function norm(s) { return (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

function main() {
  const todo = JSON.parse(fs.readFileSync(TODO, 'utf8'));
  const done = writtenIds();
  const batch = todo.filter((t) => !done.has(t.id)).slice(0, LIMIT);
  process.stderr.write(`[bcpa] processing ${batch.length} of ${todo.length} todo (LIMIT ${LIMIT})\n`);
  const now = '2026-07-09T00:00:00Z';
  const rows = [];
  let hit = 0, miss = 0;
  for (let i = 0; i < batch.length; i++) {
    const t = batch[i];
    const streetCity = `${t.addr.split(',')[0]}, ${t.city}`;
    let r; try { r = lookup(streetCity); } catch { r = { owner: '', mailing: '', err: 'exception' }; }
    const num = leadingNum(t.addr);
    const found = !!r.owner;
    const cityMatch = found && norm(r.mailing).includes(norm(t.city));
    const numMatch = found && num && norm(r.mailing).includes(num);
    const exact = found && numMatch && cityMatch;
    const conf = found ? (exact ? 90 : 65) : 0;
    rows.push({
      dock_listing_id: t.id, source_listing_url: t.url || '', dock_name: t.name || '', marina_name: '',
      location: t.addr, city: t.city, state: t.state || 'FL', country: 'USA', listing_source: 'sourced',
      existing_contact_name: '', existing_company_name: '', existing_email: '', existing_phone: '',
      existing_contact_url: '', existing_contact_status: 'partial',
      researched_contact_name: found ? r.owner : '',
      researched_company_name: found && /\b(LLC|INC|TRUST|TR|CORP|LTD|PROPERTIES|HOLDINGS)\b/.test(r.owner.toUpperCase()) ? r.owner : '',
      researched_email: '', researched_phone: '',
      researched_contact_url: found && r.folio ? `${SEARCH_URL} (folio ${r.folio})` : (found ? SEARCH_URL : ''),
      researched_contact_form_url: '',
      source_evidence_url_1: found ? SEARCH_URL : '', source_evidence_url_2: '', source_evidence_url_3: '',
      contact_match_type: found ? 'official_property_manager_contact' : (r.multi ? 'ambiguous_contact' : 'no_contact_found'),
      overwrite_risk: 'low',
      recommended_action: found ? 'fill_missing_fields_after_review' : 'manual_research_required',
      confidence_percent: conf, confidence_level: conf >= 85 ? 'high' : conf >= 55 ? 'medium' : 'none',
      verification_status: found ? 'verified_official_source' : (r.multi ? 'ambiguous_match' : (r.err ? 'error' : 'no_contact_found')),
      notes: found
        ? `BCPA owner-of-record: ${r.owner}; mailing ${r.mailing}${r.folio ? '; folio ' + r.folio : ''}. ${exact ? 'Mailing matches listing address (number+city).' : 'Mailing did not fully match listing address — review.'} No email/phone in appraiser record.`
        : (r.multi ? 'BCPA returned multiple candidates; needs manual disambiguation.' : (r.err ? `BCPA lookup error: ${r.err}.` : 'No BCPA record matched this address.')),
      processed_at: now,
    });
    if (found) hit++; else miss++;
    // flush this row immediately so a timeout/kill never loses progress (resumable)
    try { execFileSync('node', [HARNESS, 'write'], { input: JSON.stringify([rows[rows.length - 1]]), encoding: 'utf8' }); } catch {}
    process.stderr.write(`  [${i + 1}/${batch.length}] ${found ? 'OK ' : '-- '} ${streetCity} ${found ? '=> ' + r.owner.slice(0, 40) : ''}\n`);
  }
  process.stderr.write(`[bcpa] batch done: ${hit} found, ${miss} miss/err. CSV updated.\n`);
}
main();
