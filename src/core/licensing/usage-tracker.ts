/**
 * Universal AI Exporter - Usage Tracker
 * Tracks local export counts in chrome.storage.local and determines
 * when to trigger the non-blocking supporter milestone modal (every 15 exports).
 * 100% zero-server, zero telemetry.
 */

import { LicenseManager } from './license-manager';

const STORAGE_EXPORT_COUNT = 'uaie_export_count';
const STORAGE_LAST_MILESTONE = 'uaie_last_milestone_shown';
export const MILESTONE_INTERVAL = 15;

let inMemoryCount = 0;
let lastExportTimestamp = 0;
const COPY_DEBOUNCE_MS = 2500; // Debounce rapid copy clicks within 2.5s

export class UsageTracker {
  /**
   * Retrieves the current lifetime export count
   */
  public static async getExportCount(): Promise<number> {
    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const res = await chrome.storage.local.get([STORAGE_EXPORT_COUNT]);
        const val = res[STORAGE_EXPORT_COUNT];
        if (typeof val === 'number') {
          inMemoryCount = val;
          return val;
        }
      } else if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(STORAGE_EXPORT_COUNT);
        if (val) {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed)) {
            inMemoryCount = parsed;
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Universal AI Exporter: Error reading export count from storage', e);
    }
    return inMemoryCount;
  }

  /**
   * Records a completed export action and determines if a milestone modal should appear.
   * Debounces duplicate clicks within 2.5 seconds.
   */
  public static async recordExport(isClipboardAction = false): Promise<{ count: number; shouldShowMilestone: boolean }> {
    const now = Date.now();
    if (isClipboardAction && now - lastExportTimestamp < COPY_DEBOUNCE_MS) {
      const current = await this.getExportCount();
      return { count: current, shouldShowMilestone: false };
    }
    lastExportTimestamp = now;

    const currentCount = await this.getExportCount();
    const newCount = currentCount + 1;
    inMemoryCount = newCount;

    let lastMilestoneShown = 0;

    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const res = await chrome.storage.local.get([STORAGE_LAST_MILESTONE]);
        lastMilestoneShown = res[STORAGE_LAST_MILESTONE] || 0;
        await chrome.storage.local.set({ [STORAGE_EXPORT_COUNT]: newCount });
      } else if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_LAST_MILESTONE);
        if (raw) lastMilestoneShown = parseInt(raw, 10) || 0;
        localStorage.setItem(STORAGE_EXPORT_COUNT, String(newCount));
      }
    } catch (e) {
      console.warn('Universal AI Exporter: Error persisting export count', e);
    }

    // Check if user is Pro - Pro users NEVER see milestone modals
    const licenseStatus = await LicenseManager.getStatus();
    if (licenseStatus.isPro) {
      return { count: newCount, shouldShowMilestone: false };
    }

    // Trigger milestone if on a multiple of MILESTONE_INTERVAL and not already shown for this exact count
    const isMilestoneHit = newCount > 0 && newCount % MILESTONE_INTERVAL === 0;
    const shouldShowMilestone = isMilestoneHit && newCount > lastMilestoneShown;

    return { count: newCount, shouldShowMilestone };
  }

  /**
   * Marks a milestone as acknowledged/dismissed
   */
  public static async acknowledgeMilestone(count: number): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_LAST_MILESTONE]: count });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_LAST_MILESTONE, String(count));
      }
    } catch (e) {
      console.warn('Universal AI Exporter: Error saving milestone state', e);
    }
  }

  /**
   * Resets local counters (Used strictly for testing)
   */
  public static async resetForTesting(): Promise<void> {
    inMemoryCount = 0;
    lastExportTimestamp = 0;
    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.remove([STORAGE_EXPORT_COUNT, STORAGE_LAST_MILESTONE]);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_EXPORT_COUNT);
        localStorage.removeItem(STORAGE_LAST_MILESTONE);
      }
    } catch {}
  }
}
