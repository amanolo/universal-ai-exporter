/**
 * Universal AI Exporter - License Manager
 * Manages Pro status, key activation, and storage in chrome.storage.local.
 */

import { LicenseStatus } from '../types';
import { verifyLicenseKey } from './keys';

const STORAGE_KEY = 'uaie_license_state';
const LEGACY_STORAGE_KEY = 'promptdoc_license_state';

export class LicenseManager {
  private static cachedStatus: LicenseStatus | null = null;

  /**
   * Retrieves the current license status from storage
   */
  public static async getStatus(): Promise<LicenseStatus> {
    if (this.cachedStatus) {
      return this.cachedStatus;
    }

    let stored: LicenseStatus | null = null;

    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const result = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
        stored = result[STORAGE_KEY] || result[LEGACY_STORAGE_KEY] || null;
      } else if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Universal AI Exporter: Error reading license state from storage', e);
    }

    if (stored && stored.licenseKey) {
      // Re-verify in-memory to prevent local storage tampering
      const verifiedPayload = await verifyLicenseKey(stored.licenseKey);
      if (verifiedPayload && verifiedPayload.tier === 'pro') {
        this.cachedStatus = {
          isPro: true,
          tier: 'pro',
          email: verifiedPayload.email,
          expires: String(verifiedPayload.expires),
          licenseKey: stored.licenseKey,
          activatedAt: stored.activatedAt || new Date().toISOString()
        };
        return this.cachedStatus;
      }
    }

    // Default to Free Tier
    this.cachedStatus = {
      isPro: false,
      tier: 'free'
    };
    return this.cachedStatus;
  }

  /**
   * Activates a license key entered by the user
   */
  public static async activateKey(key: string): Promise<{ success: boolean; message: string; status: LicenseStatus }> {
    const trimmed = key.trim();
    if (!trimmed) {
      return {
        success: false,
        message: 'Please enter a valid license key.',
        status: { isPro: false, tier: 'free' }
      };
    }

    const payload = await verifyLicenseKey(trimmed);
    if (!payload || payload.tier !== 'pro') {
      return {
        success: false,
        message: 'Invalid or expired license key. Please verify and try again.',
        status: { isPro: false, tier: 'free' }
      };
    }

    const newStatus: LicenseStatus = {
      isPro: true,
      tier: 'pro',
      email: payload.email,
      expires: String(payload.expires),
      licenseKey: trimmed,
      activatedAt: new Date().toISOString()
    };

    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: newStatus });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newStatus));
      }
      this.cachedStatus = newStatus;
      return {
        success: true,
        message: `Pro license successfully activated for ${payload.email}!`,
        status: newStatus
      };
    } catch (e) {
      return {
        success: false,
        message: 'Failed to save license state locally.',
        status: { isPro: false, tier: 'free' }
      };
    }
  }
}
