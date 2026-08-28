/**
 * Embedded Public Key and Cryptographic Verification for Offline Licensing
 * Uses the standard Web Crypto API (Ed25519) - 100% offline, zero server calls.
 */

import { LicensePayload, LicenseStatus } from '../types';

// Embedded Ed25519 Public Key (Raw 32 bytes in Base64)
export const EMBEDDED_PUBLIC_KEY_BASE64 = 'Eyx8jkvlhboQcI+p6n9r5WK/5f9nw+Dq3YFD4PsD9nw=';

/**
 * Base64URL to Uint8Array helper
 */
function base64UrlToUint8Array(base64url: string): Uint8Array {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verifies an Ed25519 license key completely in memory using Web Crypto API.
 * Returns valid payload if signature matches, null otherwise.
 */
export async function verifyLicenseKey(licenseKey: string): Promise<LicensePayload | null> {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return null;
  }

  const parts = licenseKey.trim().split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [prefix, payloadB64, signatureB64] = parts;
  if (!prefix.startsWith('UAIE-') && !prefix.startsWith('PDOC-')) {
    return null;
  }

  try {
    // Decode payload
    const payloadBytes = base64UrlToUint8Array(payloadB64);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadJson) as LicensePayload;

    if (!payload.email || !payload.tier || !payload.expires) {
      return null;
    }

    // Check expiration if timestamp
    if (typeof payload.expires === 'number' && Date.now() > payload.expires) {
      console.warn('Universal AI Exporter: License has expired.');
      return null;
    }

    // Import public key into Web Crypto
    const rawPublicKeyBytes = base64UrlToUint8Array(EMBEDDED_PUBLIC_KEY_BASE64);
    const signatureBytes = base64UrlToUint8Array(signatureB64);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      rawPublicKeyBytes as unknown as BufferSource,
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    // Verify signature against exact utf-8 payload string bytes
    const isValid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      cryptoKey,
      signatureBytes as unknown as BufferSource,
      payloadBytes as unknown as BufferSource
    );

    if (isValid) {
      return payload;
    }
    return null;
  } catch (err) {
    console.error('Universal AI Exporter: License verification failed', err);
    return null;
  }
}
