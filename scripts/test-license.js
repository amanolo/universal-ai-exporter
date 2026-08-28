import { signLicense } from './generate-license.js';
import crypto from 'node:crypto';

// Test verification logic in Node
async function testVerification() {
  console.log('🧪 Testing Ed25519 Cryptographic License Verification...');

  const email = 'alex.researcher@mit.edu';
  const { licenseKey, payload, keys } = signLicense(email, 'pro', 'lifetime');

  console.log('1. Generated Key:', licenseKey);

  const parts = licenseKey.split('.');
  if (parts.length !== 3) throw new Error('Invalid format');

  const [prefix, payloadB64, signatureB64] = parts;
  const decodedPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

  if (decodedPayload.email !== email) throw new Error('Email mismatch');

  const payloadBuffer = Buffer.from(payloadB64, 'base64url');
  const signatureBuffer = Buffer.from(signatureB64, 'base64url');
  const spkiBuffer = Buffer.from(keys.spkiBase64, 'base64');

  // Verify using Node Web Crypto
  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    spkiBuffer,
    { name: 'Ed25519' },
    false,
    ['verify']
  );

  const start = performance.now();
  const isValid = await crypto.subtle.verify(
    { name: 'Ed25519' },
    cryptoKey,
    signatureBuffer,
    Buffer.from(JSON.stringify(decodedPayload), 'utf8')
  );
  const duration = performance.now() - start;

  if (!isValid) throw new Error('Signature validation failed!');

  console.log(`✅ Web Crypto Verification Succeeded in ${duration.toFixed(3)}ms!`);
  console.log('✅ Zero remote server calls required. 100% Offline.');
}

testVerification().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
