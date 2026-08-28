import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File storing master private key for developer/admin
const KEYS_FILE = path.join(__dirname, '../.keys/ed25519_master.json');

/**
 * Ensures the master keypair exists. If not, generates one.
 */
export function getOrCreateMasterKeys() {
  const keysDir = path.dirname(KEYS_FILE);
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  if (fs.existsSync(KEYS_FILE)) {
    const raw = fs.readFileSync(KEYS_FILE, 'utf8');
    return JSON.parse(raw);
  }

  // Generate new Ed25519 keypair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Extract raw public key bytes (SPKI header for Ed25519 is 12 bytes prefix: 302a300506032b6570032100)
  const spkiDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
  const rawPublicKeyBase64 = spkiDer.subarray(12).toString('base64');
  const spkiBase64 = spkiDer.toString('base64');

  const keys = {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    rawPublicKeyBase64,
    spkiBase64
  };

  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 });
  console.log('✅ Generated new Ed25519 master signing keypair.');
  return keys;
}

/**
 * Signs a license payload using Ed25519 private key
 */
export function signLicense(email, tier = 'pro', expires = 'lifetime') {
  const keys = getOrCreateMasterKeys();

  const payload = {
    email: email.trim().toLowerCase(),
    tier,
    issuedAt: Date.now(),
    expires
  };

  const payloadString = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadString, 'utf8').toString('base64url');

  const privateKey = crypto.createPrivateKey(keys.privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(payloadString, 'utf8'), privateKey);
  const signatureBase64 = signature.toString('base64url');

  // Format: PDOC-PRO.<payloadBase64>.<signatureBase64>
  const licenseKey = `UAIE-${tier.toUpperCase()}.${payloadBase64}.${signatureBase64}`;
  return { licenseKey, payload, keys };
}

// CLI execution
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  const email = args[0] || 'customer@example.com';
  const tier = args[1] || 'pro';
  const expires = args[2] || 'lifetime';

  const { licenseKey, payload, keys } = signLicense(email, tier, expires);

  console.log('\n======================================================');
  console.log('🔑 UNIVERSAL AI EXPORTER - LICENSE KEYGEN');
  console.log('======================================================');
  console.log(`Email:     ${payload.email}`);
  console.log(`Tier:      ${payload.tier}`);
  console.log(`Expires:   ${payload.expires}`);
  console.log(`Issued At: ${new Date(payload.issuedAt).toISOString()}`);
  console.log('------------------------------------------------------');
  console.log(`LICENSE KEY:\n\n${licenseKey}\n`);
  console.log('------------------------------------------------------');
  console.log(`Embedded Raw Public Key (Base64):\n${keys.rawPublicKeyBase64}`);
  console.log(`Embedded SPKI Public Key (Base64):\n${keys.spkiBase64}`);
  console.log('======================================================\n');
}
