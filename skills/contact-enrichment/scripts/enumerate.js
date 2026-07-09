#!/usr/bin/env node
/**
 * Read-only enumeration of dock listings for contact enrichment.
 * NEVER writes the DB. Dumps a normalized listing array to stdout as JSON.
 *
 * Sources:
 *   - Dock          (real listings; contact lives on owner User via ref)
 *   - SourcedListing (scraped/relisted; contact in ownerContact + ownerDisplayName)
 *
 * Usage: node scripts/enrichment/enumerate.js  [--count]
 */
// Silence noisy model middleware logs (Dock pre/post hooks) so stdout stays pure JSON.
console.log = () => {};
console.info = () => {};
console.debug = () => {};
const out = (s) => process.stdout.write(s + '\n');

// Load server/.env manually (root has no dotenv); deps resolved via server/node_modules.
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '../../server/.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const mongoose = require('mongoose');

require('../../server/models/User'); // register User schema for Dock.owner populate
const Dock = require('../../server/models/Dock');
const SourcedListing = require('../../server/models/SourcedListing');

const COUNT_ONLY = process.argv.includes('--count');

function existingStatus({ name, email, phone }) {
  const have = [name, email, phone].filter((v) => v && String(v).trim());
  if (have.length === 0) return 'empty';
  if (email || phone) return have.length >= 2 ? 'complete' : 'partial';
  return 'partial'; // only a name
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.MONGODB_ATLAS_URI;
  if (!connectionString) throw new Error('No DATABASE_URL / MONGODB_ATLAS_URI in server/.env');
  await mongoose.connect(connectionString, { serverSelectionTimeoutMS: 15000 });

  const docks = await Dock.find({}).populate('owner', 'name email phone').lean();
  const sourced = await SourcedListing.find({}).lean();

  const listings = [];

  for (const d of docks) {
    const o = d.owner || {};
    listings.push({
      dock_listing_id: String(d._id),
      source_listing_url: d.sourceUrl || '',
      listing_source: 'dock',
      dock_name: d.name || '',
      marina_name: d.marinaName || '',
      location: d.location?.address || '',
      city: d.location?.city || '',
      state: d.location?.state || '',
      country: d.location?.country || 'USA',
      existing_contact_name: o.name || '',
      existing_company_name: '',
      existing_email: (o.email || '').toLowerCase(),
      existing_phone: o.phone || '',
      existing_contact_url: '',
      existing_contact_status: existingStatus({ name: o.name, email: o.email, phone: o.phone }),
    });
  }

  for (const s of sourced) {
    const emails = (s.ownerContact?.emails || []).map((e) => e.toLowerCase());
    const phones = s.ownerContact?.phones || [];
    const coords = s.location?.coordinates || [];
    listings.push({
      dock_listing_id: String(s._id),
      source_listing_url: s.sourceUrl || '',
      listing_source: 'sourced',
      provider: s.provider || '',
      dock_name: s.name || '',
      marina_name: s.marinaName || '',
      location: s.location?.address || '',
      zip: s.location?.zip || '',
      lng: coords[0] ?? '',
      lat: coords[1] ?? '',
      description: (s.description || '').slice(0, 800),
      city: s.location?.city || '',
      state: s.location?.state || '',
      country: s.location?.country || 'USA',
      existing_contact_name: s.ownerDisplayName || '',
      existing_company_name: '',
      existing_email: emails.join(';'),
      existing_phone: phones.join(';'),
      existing_contact_url: s.sourceUrl || '',
      existing_contact_status: existingStatus({
        name: s.ownerDisplayName,
        email: emails[0],
        phone: phones[0],
      }),
    });
  }

  await mongoose.disconnect();

  if (COUNT_ONLY) {
    const byStatus = listings.reduce((acc, l) => {
      acc[l.existing_contact_status] = (acc[l.existing_contact_status] || 0) + 1;
      return acc;
    }, {});
    out(JSON.stringify({
      total: listings.length,
      docks: docks.length,
      sourced: sourced.length,
      byExistingStatus: byStatus,
    }, null, 2));
  } else {
    out(JSON.stringify(listings));
  }
}

main().catch((err) => {
  console.error('ENUMERATE_ERROR:', err.message);
  process.exit(1);
});
