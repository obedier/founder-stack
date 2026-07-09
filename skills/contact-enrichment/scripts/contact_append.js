#!/usr/bin/env node
/**
 * Contact append tool — turns BCPA owner name + mailing/property address into
 * phone/email via a pluggable skip-trace/append provider.
 *
 * READ-ONLY on the DB. Writes to a SEPARATE review file (dock_contact_append_review.csv)
 * — it never touches the main enrichment CSV (which a background job may be writing) and
 * never updates the database. A later human-reviewed step merges/acts on it.
 *
 * COMPLIANCE (read before live use):
 *  - Appended phone/email are PERSONAL data on private individuals. Any calling/texting is
 *    subject to TCPA + the DNC registry; email is subject to CAN-SPAM. Scrub against DNC and
 *    honor opt-outs BEFORE any outreach. Respect each provider's Terms of Service.
 *  - This project's policy: contact data is for REVIEW/routing only — no spam, no bulk cold
 *    outreach. Honor takedown/claim requests (isActive/claimStatus on the source listing).
 *  - Live paid providers only run when APPEND_CONFIRM_COMPLIANT=1 is set (explicit opt-in).
 *
 * Usage:
 *   PROVIDER=mock node scripts/enrichment/contact_append.js [LIMIT]          # test plumbing, free
 *   PROVIDER=searchbug SEARCHBUG_USER=.. SEARCHBUG_KEY=.. APPEND_CONFIRM_COMPLIANT=1 \
 *     node scripts/enrichment/contact_append.js 50
 *
 * Input:  rows in dock_contact_enrichment_review.csv that have a researched_contact_name
 *         (a BCPA owner) but no researched_phone/email yet.
 * Output: dock_contact_append_review.csv (id, owner, parsed name, address, phones, emails,
 *         provider, append_confidence, cost_estimate, dnc_flag, notes, processed_at).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '../..');
const IN_CSV = path.join(ROOT, 'dock_contact_enrichment_review.csv');
const OUT_CSV = path.join(ROOT, 'dock_contact_append_review.csv');
const CACHE = path.join(ROOT, '.enrichment/append_cache.json');
const LIMIT = parseInt(process.argv[2] || '25', 10);
const PROVIDER = (process.env.PROVIDER || 'mock').toLowerCase();

const OUT_COLS = ['dock_listing_id', 'owner_raw', 'first_name', 'last_name', 'address',
  'city', 'state', 'zip', 'phones', 'emails', 'provider', 'append_confidence',
  'cost_estimate_usd', 'dnc_flag', 'notes', 'processed_at'];

// ---------- CSV helpers ----------
function parseCsv(text) {
  const rows = []; let i = 0, field = '', row = [], inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = ''; i++; continue;
    }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function csvField(v) { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

// ---------- name/address parsing ----------
// BCPA owner strings look like: "SCHWARTZ, SAMUEL H/E & SCHWARTZ, KIMBERLY" or
// "QUINTERO, MAYRA CATALINA (MAYRA C QUINTERO LIV TR)". Extract first owner's first+last.
const NOISE = /\b(H\/E|W\/E|LE|EST|ESTATE|REV|LIV|TR|TRUST|TRUSTEE|LLC|INC|CORP|LTD|JR|SR|II|III|IV)\b/gi;
function parseOwner(raw) {
  if (!raw) return { first: '', last: '', entity: false };
  const entity = /\b(LLC|INC|CORP|LTD|TRUST|TR|PROPERTIES|HOLDINGS|MANAGEMENT)\b/i.test(raw);
  let head = raw.split('&')[0].split('(')[0].trim();          // first owner only
  if (head.includes(',')) {
    const [last, rest] = head.split(',');
    const first = (rest || '').replace(NOISE, '').trim().split(/\s+/)[0] || '';
    return { first, last: last.replace(NOISE, '').trim(), entity };
  }
  const parts = head.replace(NOISE, '').trim().split(/\s+/);
  return { first: parts[0] || '', last: parts[parts.length - 1] || '', entity };
}

// ---------- providers ----------
// Read a secret from env, or fall back to ~/.keys.sh (line: `export NAME=value`, case-insensitive
// on the export keyword). Keeps secrets out of the shell/CLI and out of the repo.
function loadKey(name) {
  if (process.env[name]) return process.env[name];
  try {
    const txt = fs.readFileSync(path.join(require('os').homedir(), '.keys.sh'), 'utf8');
    const re = new RegExp('^\\s*export\\s+' + name + '\\s*=\\s*(.+)\\s*$', 'im');
    const m = txt.match(re);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
  return '';
}
function loadCache() { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } }
function saveCache(c) { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(c)); }
function keyOf(p) { return `${p.first}|${p.last}|${p.address}|${p.zip}`.toUpperCase(); }

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = ''; res.on('data', (x) => (d += x));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ _raw: d, _status: res.statusCode }); } });
    }).on('error', reject);
  });
}
function httpPostJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const data = JSON.stringify(body);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } },
      (res) => { let d = ''; res.on('data', (x) => (d += x)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ _raw: d, _status: res.statusCode }); } }); });
    req.on('error', reject); req.write(data); req.end();
  });
}

const providers = {
  // Deterministic fake — proves the pipeline end-to-end with no key and no cost.
  async mock(p) {
    if (!p.first && !p.last) return { phones: [], emails: [], confidence: 0, cost: 0, note: 'no name to trace' };
    const slug = `${p.first}.${p.last}`.toLowerCase().replace(/[^a-z.]/g, '');
    return { phones: ['(954) 555-01' + String((p.address.length % 90) + 10)], emails: [`${slug}@example-mock.com`],
      confidence: 70, cost: 0, note: 'MOCK data — not real; pipeline test only' };
  },
  // Tracerfy — POST address-based lookup; returns persons[] with phones/emails (+DNC flag).
  // 5 credits ($0.10) per match; misses free. Endpoint/contract per tracerfy.com/skip-tracing-api.
  async tracerfy(p) {
    const key = loadKey('TRACERFY_API_KEY');
    if (!key) throw new Error('Set TRACERFY_API_KEY (env or ~/.keys.sh)');
    const r = await httpPostJson('https://tracerfy.com/v1/api/trace/lookup/',
      { address: p.address, city: p.city, state: p.state, zip: p.zip }, { Authorization: `Bearer ${key}` });
    const persons = r.persons || [];
    const phones = [], emails = []; let dncAny = false;
    for (const per of persons) {
      for (const ph of (per.phones || [])) { if (ph.number) { phones.push(ph.number); if (ph.dnc) dncAny = true; } }
      for (const em of (per.emails || [])) { if (em.email) emails.push(String(em.email).toLowerCase()); }
    }
    const uniq = (a) => [...new Set(a)];
    const P = uniq(phones), E = uniq(emails); const matched = P.length || E.length;
    return { phones: P, emails: E, confidence: matched ? 80 : 0, cost: matched ? 0.10 : 0, dnc: dncAny,
      note: r._status ? `HTTP ${r._status}: ${String(r._raw || '').slice(0, 120)}` : (matched ? `tracerfy: ${persons.length} person(s)` : 'tracerfy: no match') };
  },
  // Searchbug api_nape (budget tier). VERIFY exact endpoint/params against your Searchbug
  // dashboard — field names below follow their documented pattern but must be confirmed.
  async searchbug(p) {
    const user = process.env.SEARCHBUG_USER, key = process.env.SEARCHBUG_KEY;
    if (!user || !key) throw new Error('Set SEARCHBUG_USER and SEARCHBUG_KEY');
    const qs = new URLSearchParams({
      TYPE: 'api_nape', CO_CODE: user, PASS: key, FORMAT: 'json',
      FNAME: p.first, LNAME: p.last, ADDR: p.address, CITY: p.city, STATE: p.state, ZIP: p.zip,
    });
    const r = await httpGetJson(`https://api.searchbug.com/api/search.aspx?${qs}`);
    const phones = [].concat(r.Phone || r.phones || []).filter(Boolean);
    const emails = [].concat(r.Email || r.emails || []).map((e) => String(e).toLowerCase()).filter(Boolean);
    return { phones, emails, confidence: (phones.length || emails.length) ? 75 : 0,
      cost: (phones.length || emails.length) ? 0.20 : 0, note: r._status ? `HTTP ${r._status}` : 'searchbug api_nape' };
  },
};

// ---------- main ----------
async function main() {
  if (!providers[PROVIDER]) { console.error(`Unknown PROVIDER '${PROVIDER}'. Options: ${Object.keys(providers).join(', ')}`); process.exit(1); }
  if (PROVIDER !== 'mock' && process.env.APPEND_CONFIRM_COMPLIANT !== '1') {
    console.error('Refusing live paid append without APPEND_CONFIRM_COMPLIANT=1 (TCPA/CAN-SPAM/DNC + ToS acknowledgement). Use PROVIDER=mock to test plumbing.');
    process.exit(2);
  }
  const rows = parseCsv(fs.readFileSync(IN_CSV, 'utf8'));
  const H = rows[0]; const idx = (n) => H.indexOf(n);
  const alreadyOut = new Set(fs.existsSync(OUT_CSV)
    ? parseCsv(fs.readFileSync(OUT_CSV, 'utf8')).slice(1).map((r) => r[0]) : []);
  if (!fs.existsSync(OUT_CSV)) fs.writeFileSync(OUT_CSV, OUT_COLS.join(',') + '\n');

  const usable = rows.slice(1).filter((r) => r.length > 1);
  let candidates;
  if (process.env.CANDIDATES) {                                // explicit id list (targeted test)
    const ids = JSON.parse(fs.readFileSync(process.env.CANDIDATES, 'utf8')).map((x) => x.id || x.dock_listing_id);
    const byId = new Map(usable.map((r) => [r[idx('dock_listing_id')], r]));
    candidates = ids.map((id) => byId.get(id)).filter(Boolean)
      .filter((r) => !alreadyOut.has(r[idx('dock_listing_id')])).slice(0, LIMIT);
  } else {
    candidates = usable.filter((r) => r[idx('researched_contact_name')]        // has a BCPA owner
      && /\d+\s+\w/.test(r[idx('location')] || '')                             // real street address
      && !r[idx('researched_phone')] && !r[idx('researched_email')]
      && !alreadyOut.has(r[idx('dock_listing_id')]))
      .slice(0, LIMIT);
  }

  const cache = loadCache();
  let hit = 0, spend = 0;
  const now = '2026-07-09T00:00:00Z';
  console.error(`[append] provider=${PROVIDER} candidates=${candidates.length}`);
  for (const r of candidates) {
    const owner = parseOwner(r[idx('researched_contact_name')]);
    const full = r[idx('location')] || '';
    const street = full.split(',')[0].trim();                  // clean street line (providers want this)
    const zipM = full.match(/\b(\d{5})(?:-\d{4})?\b/);         // zip is embedded in the full address
    const p = { ...owner, address: street, city: r[idx('city')], state: r[idx('state')], zip: (idx('zip') >= 0 && r[idx('zip')]) || (zipM ? zipM[1] : '') };
    let res;
    const k = keyOf(p);
    if (cache[k]) res = cache[k];
    else { try { res = await providers[PROVIDER](p); } catch (e) { res = { phones: [], emails: [], confidence: 0, cost: 0, note: 'error: ' + e.message }; } cache[k] = res; }
    spend += res.cost || 0;
    if ((res.phones || []).length || (res.emails || []).length) hit++;
    const out = {
      dock_listing_id: r[idx('dock_listing_id')], owner_raw: r[idx('researched_contact_name')],
      first_name: owner.first, last_name: owner.last, address: p.address, city: p.city, state: p.state, zip: p.zip,
      phones: (res.phones || []).join(';'), emails: (res.emails || []).join(';'),
      provider: PROVIDER, append_confidence: res.confidence || 0, cost_estimate_usd: (res.cost || 0).toFixed(2),
      dnc_flag: res.dnc ? 'DNC_LISTED' : ((res.phones || []).length ? 'provider-checked' : 'UNSCRUBBED'),
      notes: res.note || '', processed_at: now,
    };
    fs.appendFileSync(OUT_CSV, OUT_COLS.map((c) => csvField(out[c])).join(',') + '\n');
    console.error(`  ${out.dock_listing_id} ${owner.first} ${owner.last} => ${out.phones || '-'} ${out.emails || '-'}`);
  }
  saveCache(cache);
  console.error(`[append] done: ${hit}/${candidates.length} matched; est cost $${spend.toFixed(2)} (provider=${PROVIDER}). Output: ${path.basename(OUT_CSV)}`);
}
main().catch((e) => { console.error('APPEND_ERROR:', e.message); process.exit(1); });
