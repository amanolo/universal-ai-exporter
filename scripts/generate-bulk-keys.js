import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOrCreateMasterKeys, signLicense } from './generate-license.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KEYS_DIR = path.join(__dirname, '../.keys');

/**
 * Generates bulk Ed25519 lifetime license keys for Lemon Squeezy product uploads
 */
export function generateBulkKeys(count = 1000, tier = 'pro') {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  // Ensure keys exist
  getOrCreateMasterKeys();

  const keys = [];
  const timestamp = Date.now();

  console.log(`\n🔑 Generating ${count} unique Ed25519 Lifetime License Keys for Lemon Squeezy...`);

  for (let i = 1; i <= count; i++) {
    const randomHex = crypto.randomBytes(4).toString('hex');
    const dummyEmail = `buyer_${i}_${randomHex}@license.uaie`;
    const { licenseKey } = signLicense(dummyEmail, tier, 'lifetime');
    keys.push(licenseKey);
  }

  const csvContent = 'license_key\n' + keys.join('\n');
  const txtContent = keys.join('\n');

  const csvFile = path.join(KEYS_DIR, `lemon_squeezy_keys_${count}.csv`);
  const txtFile = path.join(KEYS_DIR, `lemon_squeezy_keys_${count}.txt`);

  fs.writeFileSync(csvFile, csvContent, { mode: 0o600 });
  fs.writeFileSync(txtFile, txtContent, { mode: 0o600 });

  console.log(`✅ Successfully generated ${keys.length} keys!`);
  console.log(`📄 CSV Export: ${csvFile}`);
  console.log(`📄 TXT Export: ${txtFile}`);
  console.log('💡 Upload the CSV file directly to your Lemon Squeezy Product "License Keys" settings.\n');

  return { count: keys.length, csvFile, txtFile };
}

if (process.argv[1] === __filename) {
  const count = parseInt(process.argv[2], 10) || 1000;
  const tier = process.argv[3] || 'pro';
  generateBulkKeys(count, tier);
}
