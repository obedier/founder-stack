#!/usr/bin/env node
/**
 * Enrichment loop harness — resumable, idempotent, single-writer CSV.
 * NEVER writes the DB. Operates on the cached listings snapshot + the CSV ledger.
 *
 * Subcommands:
 *   init                 Cache listings.json (via enumerate.js output on stdin) + create CSV header.
 *   select <N> [--need]  Print next N unprocessed listings as JSON (--need = empty/partial only).
 *   write                Append result rows (JSON array on stdin) to CSV; dedup by id; flush.
 *   emit-complete        Append review-only rows for all still-unwritten 'complete' listings.
 *   summary              Print the final concise summary from the CSV.
 *
 * Paths are repo-root relative.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const LISTINGS = path.join(ROOT, '.enrichment/listings.json');
const CSV = path.join(ROOT, 'dock_contact_enrichment_review.csv');

const COLUMNS = [
  'dock_listing_id', 'source_listing_url', 'dock_name', 'marina_name', 'location',
  'city', 'state', 'country', 'listing_source', 'existing_contact_name',
  'existing_company_name', 'existing_email', 'existing_phone', 'existing_contact_url',
  'existing_contact_status', 'researched_contact_name', 'researched_company_name',
  'researched_email', 'researched_phone', 'researched_contact_url',
  'researched_contact_form_url', 'source_evidence_url_1', 'source_evidence_url_2',
  'source_evidence_url_3', 'contact_match_type', 'overwrite_risk', 'recommended_action',
  'confidence_percent', 'confidence_level', 'verification_status', 'notes', 'processed_at',
];

function csvField(v) {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function rowToLine(row) {
  return COLUMNS.map((c) => csvField(row[c])).join(',');
}

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

// Parse the CSV ledger; return Set of dock_listing_id already written (col 0, respecting quotes).
function writtenIds() {
  if (!fs.existsSync(CSV)) return new Set();
  const text = fs.readFileSync(CSV, 'utf8');
  const ids = new Set();
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // first field: quoted or bare up to first unescaped comma
    let id;
    if (line[0] === '"') {
      const m = line.match(/^"((?:[^"]|"")*)"/);
      id = m ? m[1].replace(/""/g, '"') : '';
    } else {
      id = line.split(',')[0];
    }
    if (id) ids.add(id);
  }
  return ids;
}

function loadListings() {
  return JSON.parse(fs.readFileSync(LISTINGS, 'utf8'));
}

function ensureHeader() {
  if (!fs.existsSync(CSV)) {
    fs.writeFileSync(CSV, COLUMNS.join(',') + '\n');
  }
}

function cmdInit() {
  const data = readStdin().trim();
  if (!data) throw new Error('init expects enumerate.js JSON on stdin');
  const listings = JSON.parse(data);
  fs.mkdirSync(path.dirname(LISTINGS), { recursive: true });
  fs.writeFileSync(LISTINGS, JSON.stringify(listings));
  ensureHeader();
  console.log(JSON.stringify({ cached: listings.length, csv: path.basename(CSV) }));
}

function cmdSelect(n, needOnly) {
  const listings = loadListings();
  const done = writtenIds();
  const out = [];
  for (const l of listings) {
    if (done.has(l.dock_listing_id)) continue;
    if (needOnly && l.existing_contact_status === 'complete') continue;
    out.push(l);
    if (out.length >= n) break;
  }
  console.log(JSON.stringify(out));
}

function cmdWrite() {
  const data = readStdin().trim();
  if (!data) throw new Error('write expects a JSON array of rows on stdin');
  const rows = JSON.parse(data);
  ensureHeader();
  const done = writtenIds();
  let appended = 0, skipped = 0;
  const lines = [];
  for (const r of rows) {
    if (!r.dock_listing_id) { skipped++; continue; }
    if (done.has(r.dock_listing_id)) { skipped++; continue; }
    done.add(r.dock_listing_id);
    lines.push(rowToLine(r));
    appended++;
  }
  if (lines.length) {
    const fd = fs.openSync(CSV, 'a');
    fs.writeSync(fd, lines.join('\n') + '\n');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
  }
  console.log(JSON.stringify({ appended, skipped }));
}

function cmdEmitComplete() {
  const listings = loadListings();
  const done = writtenIds();
  const now = new Date().toISOString();
  const rows = [];
  for (const l of listings) {
    if (done.has(l.dock_listing_id)) continue;
    if (l.existing_contact_status !== 'complete') continue;
    rows.push({
      ...l,
      researched_contact_name: '', researched_company_name: '', researched_email: '',
      researched_phone: '', researched_contact_url: '', researched_contact_form_url: '',
      source_evidence_url_1: '', source_evidence_url_2: '', source_evidence_url_3: '',
      contact_match_type: 'exact_listing_contact',
      overwrite_risk: 'high',
      recommended_action: 'keep_existing_contact',
      confidence_percent: 0,
      confidence_level: 'none',
      verification_status: 'existing_contact_present_review_only',
      notes: 'Existing DB contact complete; flagged review-only, no web research performed (per scope).',
      processed_at: now,
    });
  }
  // reuse write path
  ensureHeader();
  let appended = 0;
  if (rows.length) {
    const fd = fs.openSync(CSV, 'a');
    fs.writeSync(fd, rows.map(rowToLine).join('\n') + '\n');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    appended = rows.length;
  }
  console.log(JSON.stringify({ appended }));
}

function cmdSummary() {
  const listings = loadListings();
  const total = listings.length;
  const text = fs.existsSync(CSV) ? fs.readFileSync(CSV, 'utf8') : '';
  const lines = text.split(/\r?\n/).slice(1).filter(Boolean);
  const done = writtenIds();
  const acc = {
    total, written: done.size, remaining: total - done.size,
    existing_present: 0, researched_high: 0, researched_medium: 0, researched_low: 0,
    conflicts: 0, no_contact: 0, errors: 0,
  };
  // parse each row minimally by splitting (fields we need are simple enums w/o commas)
  const idx = (name) => COLUMNS.indexOf(name);
  for (const line of lines) {
    const f = parseCsvLine(line);
    const vs = f[idx('verification_status')] || '';
    const cl = f[idx('confidence_level')] || '';
    const risk = f[idx('overwrite_risk')] || '';
    if (vs === 'existing_contact_present_review_only') acc.existing_present++;
    if (vs === 'error') acc.errors++;
    if (vs === 'no_contact_found' || f[idx('contact_match_type')] === 'no_contact_found') acc.no_contact++;
    if (vs === 'conflicting_contact_review_required' || risk === 'high' && vs !== 'existing_contact_present_review_only') acc.conflicts++;
    if (vs !== 'existing_contact_present_review_only') {
      if (cl === 'high') acc.researched_high++;
      else if (cl === 'medium') acc.researched_medium++;
      else if (cl === 'low') acc.researched_low++;
    }
  }
  console.log(JSON.stringify(acc, null, 2));
}

function parseCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'init') cmdInit();
  else if (cmd === 'select') cmdSelect(parseInt(rest[0] || '25', 10), rest.includes('--need'));
  else if (cmd === 'write') cmdWrite();
  else if (cmd === 'emit-complete') cmdEmitComplete();
  else if (cmd === 'summary') cmdSummary();
  else { console.error('usage: harness.js init|select <N> [--need]|write|emit-complete|summary'); process.exit(1); }
} catch (e) {
  console.error('HARNESS_ERROR:', e.message);
  process.exit(1);
}
