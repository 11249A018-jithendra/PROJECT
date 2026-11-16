#!/usr/bin/env node
// One-time: copies photos from backend/uploads/ into Supabase Storage so they
// survive deployment. Safe to re-run (files already there are skipped).
//   cd backend && node scripts/migrate-uploads.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { saveFile, ensureBucket } = require('../utils/fileStore');

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const dir = path.join(__dirname, '..', 'uploads');

(async () => {
  await ensureBucket();
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => TYPES[path.extname(f).toLowerCase()]) : [];
  let copied = 0;
  let skipped = 0;
  for (const name of files) {
    try {
      await saveFile(name, fs.readFileSync(path.join(dir, name)), TYPES[path.extname(name).toLowerCase()]);
      copied++;
    } catch (err) {
      if (/exists|duplicate/i.test(err.message)) skipped++;
      else console.error(`✖ ${name}: ${err.message}`);
    }
  }
  console.log(`✔ Copied ${copied} photo(s) to Supabase Storage${skipped ? `, ${skipped} were already there` : ''}.`);
  process.exit(0);
})().catch((err) => {
  console.error('✖', err.message);
  process.exit(1);
});
