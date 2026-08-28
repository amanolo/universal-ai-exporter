import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLicenseKey } from '../src/core/licensing/keys';
import { LicenseManager } from '../src/core/licensing/license-manager';
import { signLicense } from '../scripts/generate-license';

test('Security 1: Cryptographic Ed25519 Signature Verification', async () => {
  const email = 'dr.watson@oxford.ac.uk';
  const { licenseKey, payload } = signLicense(email, 'pro', 'lifetime');

  assert.ok(licenseKey.startsWith('UAIE-PRO.'));

  const verified = await verifyLicenseKey(licenseKey);
  assert.notEqual(verified, null, 'Valid cryptographic license must verify successfully');
  assert.equal(verified?.email, email);
  assert.equal(verified?.tier, 'pro');
  assert.equal(verified?.expires, 'lifetime');
});

test('Security 2: Tamper Resistance (Altered Payload & Forged Signatures)', async () => {
  const { licenseKey } = signLicense('honest.user@company.com', 'pro', 'lifetime');
  const [prefix, payloadB64, sigB64] = licenseKey.split('.');

  // 1. Alter email in payload
  const tamperedPayload = { email: 'pirate@blackhat.com', tier: 'pro', issuedAt: Date.now(), expires: 'lifetime' };
  const tamperedB64 = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
  const tamperedKey = `${prefix}.${tamperedB64}.${sigB64}`;

  const result1 = await verifyLicenseKey(tamperedKey);
  assert.equal(result1, null, 'Tampered payload must be rejected by Ed25519 signature check');

  // 2. Corrupt signature byte
  const corruptedSig = sigB64.slice(0, -4) + 'AAAA';
  const corruptedKey = `${prefix}.${payloadB64}.${corruptedSig}`;

  const result2 = await verifyLicenseKey(corruptedKey);
  assert.equal(result2, null, 'Corrupted signature must be rejected');
});

test('Security 3: Expiration Date Enforcement', async () => {
  const pastTimestamp = Date.now() - 3600000; // 1 hour ago
  const { licenseKey } = signLicense('expired.user@corp.com', 'pro', pastTimestamp);

  const result = await verifyLicenseKey(licenseKey);
  assert.equal(result, null, 'Expired timestamp must be rejected as invalid');
});

test('Security 4: Malformed Key Fuzzing & Crash Resistance', async () => {
  const fuzzedInputs = [
    '',
    '   ',
    'UAIE-PRO',
    'UAIE-PRO.abc',
    'UAIE-PRO.invalid_base64!@#$.invalid_sig!@#$',
    'random_string_without_dots',
    '..',
    'UAIE-PRO..',
    'PDOC-PRO.e30.e30',
    null,
    undefined
  ];

  for (const input of fuzzedInputs) {
    // @ts-ignore
    const result = await verifyLicenseKey(input);
    assert.equal(result, null, `Malformed input "${input}" must safely return null without throwing`);
  }
});

test('Security 5: LicenseManager Activation Flow & In-Memory State', async () => {
  // Free state default
  const initialStatus = await LicenseManager.getStatus();
  assert.equal(initialStatus.isPro, false);
  assert.equal(initialStatus.tier, 'free');

  // Invalid key activation
  const badActivation = await LicenseManager.activateKey('UAIE-PRO.fake.fake');
  assert.equal(badActivation.success, false);
  assert.equal(badActivation.status.isPro, false);

  // Valid key activation
  const { licenseKey, payload } = signLicense('valid.licensee@stanford.edu', 'pro', 'lifetime');
  const goodActivation = await LicenseManager.activateKey(licenseKey);
  assert.equal(goodActivation.success, true);
  assert.equal(goodActivation.status.isPro, true);
  assert.equal(goodActivation.status.email, payload.email);

  const updatedStatus = await LicenseManager.getStatus();
  assert.equal(updatedStatus.isPro, true);
  assert.equal(updatedStatus.email, payload.email);
});

test('Security 6: Verification Performance Benchmark (< 1.5ms per verify)', async () => {
  const { licenseKey } = signLicense('perf.tester@mit.edu', 'pro', 'lifetime');

  const start = performance.now();
  const iterations = 10;
  for (let i = 0; i < iterations; i++) {
    await verifyLicenseKey(licenseKey);
  }
  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;

  assert.ok(avgMs < 2.0, `Ed25519 verification average (${avgMs.toFixed(3)}ms) must be under 2.0ms`);
});
