/**
 * Universal AI Exporter - Background Service Worker
 * Coordinates extension lifecycle, keyboard shortcuts, and context menus.
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

// Listen for keyboard command triggers (e.g. Alt+Shift+E)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick_export_md') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'EXPORT_CONVERSATION',
        options: { format: 'markdown', includeFrontmatter: true }
      });
    }
  }
});
