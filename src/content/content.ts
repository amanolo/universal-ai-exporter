/**
 * Universal AI Exporter - Content Script Entry Point
 * Lightweight in-page scanner that extracts conversation DOM data for the popup.
 */

import { AdapterRegistry } from '../core/adapters/adapter-registry';
import { ExtractionResult } from '../core/types';

// Runtime message listener for popup queries
chrome.runtime.onMessage.addListener((request, _sender, sendResponse: (res: ExtractionResult) => void) => {
  (async () => {
    try {
      if (request.action === 'GET_CONVERSATION' || request.action === 'PING') {
        const adapter = AdapterRegistry.getAdapter();
        const conversation = await adapter.extractConversation();
        sendResponse({ success: true, conversation });
        return;
      }

      sendResponse({ success: false, error: 'Unknown action' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Extraction failed';
      console.error('Universal AI Exporter: Extraction failed', err);
      sendResponse({ success: false, error: message });
    }
  })();

  return true; // Keep message port open for async response
});
