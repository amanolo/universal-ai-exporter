/**
 * Universal AI Exporter - Content Script Entry Point
 * Lightweight in-page scanner that extracts conversation DOM data for the popup.
 */

import { AdapterRegistry } from '../core/adapters/adapter-registry';
import { ExtractionResult } from '../core/types';

let activeContentImages: HTMLImageElement[] = [];

function collectContentImages(): HTMLImageElement[] {
  const turns = Array.from(document.querySelectorAll('user-query, model-response, div.conversation-turn, message-content, div[class*="user-query"], div[class*="model-response"]'))
    .filter(el => !el.closest('bard-mode-menu, [role="menu"], [role="listbox"], mat-menu, header, nav'));

  const seen = new Set<HTMLImageElement>();
  const images: HTMLImageElement[] = [];

  for (const turn of turns) {
    const imgs = Array.from(turn.querySelectorAll('img')).filter(img => {
      const width = parseInt(img.getAttribute('width') || '100', 10);
      const height = parseInt(img.getAttribute('height') || '100', 10);
      const isTiny = (width > 0 && width < 32) || (height > 0 && height < 32) || (img.naturalWidth > 0 && img.naturalWidth < 32) || (img.naturalHeight > 0 && img.naturalHeight < 32);
      const isUiGlyph = /favicon|emoji|ui-icon/i.test(img.className || img.alt || '');
      return !isTiny && !isUiGlyph;
    });

    for (const img of imgs) {
      if (!seen.has(img)) {
        seen.add(img);
        images.push(img);
      }
    }
  }

  return images;
}

// Runtime message listener for popup queries
chrome.runtime.onMessage.addListener((request, _sender, sendResponse: (res: any) => void) => {
  (async () => {
    try {
      if (request.action === 'GET_CONVERSATION' || request.action === 'PING') {
        const adapter = AdapterRegistry.getAdapter();
        const conversation = await adapter.extractConversation();
        sendResponse({ success: true, conversation });
        return;
      }

      if (request.action === 'PREPARE_IMAGE_CAPTURE') {
        activeContentImages = collectContentImages();
        sendResponse({ success: true, count: activeContentImages.length });
        return;
      }

      if (request.action === 'FOCUS_IMAGE_AT_INDEX') {
        const index = typeof request.index === 'number' ? request.index : -1;
        if (index >= 0 && index < activeContentImages.length) {
          const img = activeContentImages[index];
          img.scrollIntoView({ block: 'center', behavior: 'instant' });
          await new Promise(r => setTimeout(r, 70));
          const rect = img.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          const src = img.getAttribute('src') || img.src;
          sendResponse({
            success: true,
            url: src,
            rect: {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height,
              dpr
            }
          });
          return;
        }
        sendResponse({ success: false });
        return;
      }

      sendResponse({ success: false, error: 'Unknown action' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      console.error('Universal AI Exporter: Action failed', err);
      sendResponse({ success: false, error: message });
    }
  })();

  return true; // Keep message port open for async response
});
