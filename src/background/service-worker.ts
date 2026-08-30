/**
 * Universal AI Exporter - Background Service Worker
 * Manages extension install and update lifecycle.
 */

// Installation & Update Lifecycle
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Universal AI Exporter installed successfully.');
    // Set default initial state
    await chrome.storage.local.set({
      uaie_installed_at: new Date().toISOString(),
      uaie_version: '1.0.0'
    });
  }
});


