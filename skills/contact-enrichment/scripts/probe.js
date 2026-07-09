#!/usr/bin/env node
// Read-only probe: what raw signal do sourced listings actually carry?
console.log = () => {}; console.info = () => {}; console.debug = () => {};
const out = (s) => process.stdout.write(s + '\n');
const fs = require('fs'), path = require('path');
const envPath = path.join(__dirname, '../../server/.env');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const mongoose = require('mongoose');
require('../../server/models/User');
const SourcedListing = require('../../server/models/SourcedListing');

const ADDR_RE = /\b\d{2,6}\s+(?:N|S|E|W|NE|NW|SE|SW)?\.?\s*[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,3}\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Ln|Lane|Ct|Court|Way|Ter|Terrace|Cir|Circle|Pl|Place|Hwy|Isle|Island|Canal)\b/i;
const CO_RE = /\b(LLC|L\.L\.C|Inc|Marina|Yacht Club|Marine|Properties|Management|Holdings|Realty|Dockage|Group|Corp)\b/i;

(async () => {
  const s = process.env.DATABASE_URL || process.env.MONGODB_ATLAS_URI;
  await mongoose.connect(s, { serverSelectionTimeoutMS: 15000 });
  const rows = await SourcedListing.find({}).select('provider name description location ownerDisplayName ownerContact sourceUrl').lean();
  let coords = 0, addr = 0, zip = 0, descAddr = 0, coName = 0, hasEmailPhone = 0, byProvider = {};
  for (const r of rows) {
    byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
    if (r.location?.coordinates?.length === 2) coords++;
    if (r.location?.address) addr++;
    if (r.location?.zip) zip++;
    if (r.description && ADDR_RE.test(r.description)) descAddr++;
    if (CO_RE.test(r.name || '') || CO_RE.test(r.ownerDisplayName || '')) coName++;
    if ((r.ownerContact?.emails||[]).length || (r.ownerContact?.phones||[]).length) hasEmailPhone++;
  }
  // sample 3 with description address
  const samples = rows.filter(r => r.description && ADDR_RE.test(r.description)).slice(0,3)
    .map(r => ({ name: r.name, city: r.location?.city, addr: (r.description.match(ADDR_RE)||[])[0], zip: r.location?.zip }));
  out(JSON.stringify({
    total: rows.length, byProvider,
    withCoords: coords, withAddress: addr, withZip: zip,
    descHasStreetAddr: descAddr, companyLikeName: coName, alreadyHasEmailOrPhone: hasEmailPhone,
    sampleDescAddrs: samples,
  }, null, 2));
  await mongoose.disconnect();
})().catch(e => { process.stderr.write('PROBE_ERROR: ' + e.message + '\n'); process.exit(1); });
