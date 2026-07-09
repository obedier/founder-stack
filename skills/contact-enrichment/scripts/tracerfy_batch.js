#!/usr/bin/env node
/**
 * Tracerfy BATCH skip trace (cheap path: normal = 1 credit/$0.02 per lead vs instant's 5).
 * Submits all pending BCPA-owner addresses as one async queue, polls, downloads the
 * row-aligned CSV, and merges phones/emails into dock_contact_append_review.csv.
 *
 * READ-ONLY on the DB. Compliance: batch-normal returns contacts AT the address (no owner
 * ID, no DNC flags). Scrub phones via /v1/api/dnc/scrub-from-queue/ BEFORE any outreach
 * (TCPA/CAN-SPAM/DNC). Requires APPEND_CONFIRM_COMPLIANT=1.
 *
 * Usage: TRACE_TYPE=normal APPEND_CONFIRM_COMPLIANT=1 node scripts/enrichment/tracerfy_batch.js [MAX]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const ROOT = path.join(__dirname, '../..');
const IN_CSV = path.join(ROOT, 'dock_contact_enrichment_review.csv');
const OUT_CSV = path.join(ROOT, 'dock_contact_append_review.csv');
const TRACE_TYPE = (process.env.TRACE_TYPE || 'normal').toLowerCase();
const CRED = TRACE_TYPE === 'advanced' ? 2 : 1;
const MAX = parseInt(process.argv[2] || '5000', 10);
const BROWARD = /Fort Lauderdale|Pompano|Hallandale|Dania|Lighthouse Point|Deerfield|Wilton Manors|Oakland Park|Hollywood|Davie|Plantation|Sunrise|Coral Springs|Coconut Creek|Lauderdale|Sea Ranch|Hillsboro|Parkland|Tamarac|Margate/i;

const OUT_COLS = ['dock_listing_id', 'owner_raw', 'first_name', 'last_name', 'address', 'city',
  'state', 'zip', 'phones', 'emails', 'provider', 'append_confidence', 'cost_estimate_usd',
  'dnc_flag', 'notes', 'processed_at'];

function loadKey() {
  if (process.env.TRACERFY_API_KEY) return process.env.TRACERFY_API_KEY;
  const txt = fs.readFileSync(path.join(os.homedir(), '.keys.sh'), 'utf8');
  const m = txt.match(/^\s*export\s+TRACERFY_API_KEY\s*=\s*(.+)\s*$/im);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
function parseCsv(text) {
  const rows = []; let i = 0, f = '', row = [], q = false;
  while (i < text.length) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i += 2; continue; } if (c === '"') { q = false; i++; continue; } f += c; i++; continue; }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(f); f = ''; i++; continue; }
    if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
    f += c; i++;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function csvField(v) { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function req(method, url, key, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const data = body ? JSON.stringify(body) : null;
    const headers = { Authorization: `Bearer ${key}` };
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, (res) => {
      let d = ''; res.on('data', (x) => (d += x)); res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, raw: d }); } });
    }); r.on('error', reject); if (data) r.write(data); r.end();
  });
}
function getText(url) { return new Promise((resolve, reject) => { https.get(url, (res) => { let d = ''; res.on('data', (x) => (d += x)); res.on('end', () => resolve(d)); }).on('error', reject); }); }
// Batch endpoint requires multipart/form-data (rejects application/json with 415).
function postMultipart(url, key, fields) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const boundary = '----tracerfy' + Date.now() + Math.floor(process.hrtime()[1]);
    let body = '';
    for (const [k, v] of Object.entries(fields)) body += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
    body += `--${boundary}--\r\n`;
    const buf = Buffer.from(body, 'utf8');
    const r = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': buf.length } },
      (res) => { let d = ''; res.on('data', (x) => (d += x)); res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, raw: d }); } }); });
    r.on('error', reject); r.write(buf); r.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const NOISE = /\b(H\/E|W\/E|LE|EST|ESTATE|REV|LIV|TR|TRUST|TRUSTEE|LLC|INC|CORP|LTD|JR|SR|II|III|IV)\b/gi;
function parseOwner(raw) {
  if (!raw) return { first: '', last: '' };
  const head = raw.split('&')[0].split('(')[0].trim();
  if (head.includes(',')) { const [last, rest] = head.split(','); return { first: (rest || '').replace(NOISE, '').trim().split(/\s+/)[0] || '', last: last.replace(NOISE, '').trim() }; }
  const p = head.replace(NOISE, '').trim().split(/\s+/); return { first: p[0] || '', last: p[p.length - 1] || '' };
}

async function main() {
  if (process.env.APPEND_CONFIRM_COMPLIANT !== '1') { console.error('Refusing paid run without APPEND_CONFIRM_COMPLIANT=1.'); process.exit(2); }
  const key = loadKey(); if (!key) { console.error('No TRACERFY_API_KEY.'); process.exit(1); }

  const rows = parseCsv(fs.readFileSync(IN_CSV, 'utf8'));
  const H = rows[0]; const idx = (n) => H.indexOf(n);
  const doneIds = new Set(fs.existsSync(OUT_CSV) ? parseCsv(fs.readFileSync(OUT_CSV, 'utf8')).slice(1).map((r) => r[0]) : []);
  if (!fs.existsSync(OUT_CSV)) fs.writeFileSync(OUT_CSV, OUT_COLS.join(',') + '\n');

  const cands = rows.slice(1).filter((r) => r.length > 1
    && r[idx('researched_contact_name')] && /\d+\s+\w/.test(r[idx('location')] || '')
    && BROWARD.test(r[idx('city')] || '') && !doneIds.has(r[idx('dock_listing_id')]))
    .slice(0, MAX)
    .map((r) => {
      const full = r[idx('location')] || ''; const zipM = full.match(/\b(\d{5})(?:-\d{4})?\b/);
      const o = parseOwner(r[idx('researched_contact_name')]);
      return { id: r[idx('dock_listing_id')], owner: r[idx('researched_contact_name')], first: o.first, last: o.last,
        address: full.split(',')[0].trim(), city: r[idx('city')], state: r[idx('state')] || 'FL', zip: zipM ? zipM[1] : '' };
    });
  if (!cands.length) { console.error('[batch] nothing to do.'); return; }
  console.error(`[batch] submitting ${cands.length} addrs, trace_type=${TRACE_TYPE} (${CRED}cr/$${(CRED * 0.02).toFixed(2)} each, ~$${(cands.length * CRED * 0.02).toFixed(2)} max)`);

  const records = cands.map((c) => ({ id: c.id, address: c.address, city: c.city, state: c.state, zip: c.zip,
    first_name: c.first, last_name: c.last, mail_address: c.address, mail_city: c.city, mail_state: c.state }));
  const sub = await postMultipart('https://tracerfy.com/v1/api/trace/', key, {
    json_data: JSON.stringify(records), address_column: 'address', city_column: 'city',
    state_column: 'state', zip_column: 'zip', first_name_column: 'first_name', last_name_column: 'last_name',
    mail_address_column: 'mail_address', mail_city_column: 'mail_city', mail_state_column: 'mail_state', trace_type: TRACE_TYPE,
  });
  if (sub.status !== 200 || !(sub.json && sub.json.queue_id)) { console.error('[batch] submit failed:', sub.status, JSON.stringify(sub.json || sub.raw).slice(0, 300)); process.exit(1); }
  const qid = sub.json.queue_id;
  console.error(`[batch] queue ${qid}; est wait ${sub.json.estimated_wait_seconds}s. Polling...`);

  let downloadUrl = null;
  for (let attempt = 0; attempt < 40 && !downloadUrl; attempt++) {
    await sleep(22000); // /queues/ throttle = 1 per 20s
    const q = await req('GET', 'https://tracerfy.com/v1/api/queues/', key);
    const mine = Array.isArray(q.json) ? q.json.find((x) => x.id === qid) : null;
    if (mine && !mine.pending && mine.download_url) { downloadUrl = mine.download_url; break; }
    console.error(`  poll ${attempt + 1}: ${mine ? (mine.pending ? 'pending' : 'ready-no-url') : 'not-listed'}`);
  }
  if (!downloadUrl) { console.error(`[batch] timed out waiting for queue ${qid}. Re-run to resume once ready.`); process.exit(1); }

  const csv = await getText(downloadUrl);
  const res = parseCsv(csv); const RH = res[0].map((h) => h.trim());
  const ri = (n) => RH.findIndex((h) => h.toLowerCase() === n.toLowerCase());
  const idCol = ri('id');
  const phoneCols = RH.map((h, i) => (/phone|mobile|landline/i.test(h) ? i : -1)).filter((i) => i >= 0);
  const emailCols = RH.map((h, i) => (/email/i.test(h) ? i : -1)).filter((i) => i >= 0);
  // fallback map by normalized address+city
  const byAddr = new Map(cands.map((c) => [norm(c.address) + norm(c.city), c]));
  const resById = new Map();
  for (const row of res.slice(1)) {
    if (!row.length) continue;
    let cand = idCol >= 0 ? cands.find((c) => c.id === row[idCol]) : null;
    if (!cand) { const aC = ri('address'), cC = ri('city'); if (aC >= 0) cand = byAddr.get(norm(row[aC]) + norm(cC >= 0 ? row[cC] : '')); }
    if (!cand) continue;
    const phones = [...new Set(phoneCols.map((i) => (row[i] || '').trim()).filter(Boolean))];
    const emails = [...new Set(emailCols.map((i) => (row[i] || '').trim().toLowerCase()).filter(Boolean))];
    resById.set(cand.id, { phones, emails, fn: ri('first_name') >= 0 ? row[ri('first_name')] : '', ln: ri('last_name') >= 0 ? row[ri('last_name')] : '' });
  }

  const now = new Date().toISOString();
  let hit = 0;
  for (const c of cands) {
    const r = resById.get(c.id) || { phones: [], emails: [] };
    const matched = r.phones.length || r.emails.length; if (matched) hit++;
    const nameEcho = `${r.fn || ''} ${r.ln || ''}`.trim();
    const out = {
      dock_listing_id: c.id, owner_raw: c.owner, first_name: r.fn || '', last_name: r.ln || '',
      address: c.address, city: c.city, state: c.state, zip: c.zip,
      phones: r.phones.join(';'), emails: r.emails.join(';'),
      provider: `tracerfy-batch-${TRACE_TYPE}`, append_confidence: matched ? 70 : 0,
      cost_estimate_usd: (matched ? CRED * 0.02 : 0).toFixed(2), dnc_flag: 'UNSCRUBBED',
      notes: matched
        ? `Batch ${TRACE_TYPE} trace: ${r.phones.length} phone(s), ${r.emails.length} email(s) at address.${nameEcho ? ` Returned ${nameEcho}; verify vs BCPA owner "${c.owner}".` : ''} Run DNC scrub before outreach.`
        : 'No contact found at address (batch trace miss; free).',
      processed_at: now,
    };
    fs.appendFileSync(OUT_CSV, OUT_COLS.map((k) => csvField(out[k])).join(',') + '\n');
  }
  console.error(`[batch] done: ${hit}/${cands.length} matched; est spend $${(hit * CRED * 0.02).toFixed(2)} (queue ${qid}). Output: ${path.basename(OUT_CSV)}`);
}
main().catch((e) => { console.error('BATCH_ERROR:', e.message); process.exit(1); });
