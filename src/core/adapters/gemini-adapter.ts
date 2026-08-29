/**
 * Google Gemini Platform Adapter
 * Parses responses, tables, and formatted source code from gemini.google.com
 */

import { AIPlatform, ConversationData, ExtractedMessage } from '../types';
import { AIPlatformAdapter } from './adapter-interface';
import {
  extractCleanText,
  extractCodeBlocks,
  extractConversationTitle,
  extractTables,
  normalizeLatexMath
} from '../utils/dom-traversal';

export class GeminiAdapter implements AIPlatformAdapter {
  readonly platform: AIPlatform = 'gemini';
  readonly name = 'Google Gemini';

  matches(url: string): boolean {
    return /gemini\.google\.com/i.test(url);
  }

  async extractConversation(): Promise<ConversationData> {
    const title = extractConversationTitle('Gemini Conversation');
    const messages: ExtractedMessage[] = [];

    // Select top-level turn containers in Gemini (excluding floating menus and navigation)
    let rawTurns = Array.from(document.querySelectorAll('user-query, model-response, div.conversation-turn, div[class*="user-query"], div[class*="model-response"]'))
      .filter(el => !el.closest('bard-mode-menu, [role="menu"], [role="listbox"], mat-menu, [class*="model-selector"], header, nav'));

    // If neither exists, fallback to message content
    if (rawTurns.length === 0) {
      rawTurns = Array.from(document.querySelectorAll('message-content, div.message-content'))
        .filter(el => !el.closest('bard-mode-menu, [role="menu"], [role="listbox"], mat-menu, [class*="model-selector"], header, nav'));
    }

    // Deduplicate nested elements (ignore elements whose ancestor is already in rawTurns)
    const topLevelTurns = rawTurns.filter(el => {
      let parent = el.parentElement;
      while (parent) {
        if (rawTurns.includes(parent)) {
          return false; // Child element, ignore
        }
        parent = parent.parentElement;
      }
      return true;
    });

    const processedTexts = new Set<string>();

    for (let index = 0; index < topLevelTurns.length; index++) {
      const turnEl = topLevelTurns[index];
      const tagName = turnEl.tagName.toLowerCase();
      const isUser = tagName.includes('user') ||
                     turnEl.className.includes('user') ||
                     turnEl.querySelector('user-query, [data-test-id="user-query"]') !== null;

      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

      const clone = turnEl.cloneNode(true) as HTMLElement;
      normalizeLatexMath(clone);

      // Unwrap or preserve img tags before removing buttons/action elements
      clone.querySelectorAll('button, [role="button"], [role="menu"], [role="listbox"], bard-mode-menu, mat-menu, [class*="model-selector"]').forEach(el => {
        const img = el.querySelector('img');
        if (img) {
          el.replaceWith(img);
        } else {
          el.remove();
        }
      });

      // Remove accessibility headings, decorative SVGs, screen-reader headers
      clone.querySelectorAll('h5, h6, [class*="screen-reader"], [data-test-id*="header"], svg').forEach(el => {
        el.remove();
      });

      // Extract Gemini Reasoning / Thought Box (e.g. Gemini 2.0 Flash Thinking)
      let reasoning: string | undefined;
      const thinkContainer = clone.querySelector(
        'thought-box, [data-test-id="thought-box"], expandable-thought, details.thought-container'
      );

      if (thinkContainer) {
        const thinkText = extractCleanText(thinkContainer);
        if (thinkText.length > 0) {
          reasoning = thinkText;
          thinkContainer.remove();
        }
      }

      // Extract content images (exclude tiny UI icons/avatars < 32px and isolate strictly to current turn)
      const images: string[] = [];
      const imageRects: { x: number; y: number; width: number; height: number; dpr: number }[] = [];
      const seenImages = new Set<string>();

      const scanRoots: Element[] = [turnEl];
      if (isUser && turnEl.parentElement) {
        const userContainer = turnEl.closest('user-query, [data-test-id*="user-query"], [class*="user-query"]') || null;
        if (userContainer && userContainer !== turnEl) {
          scanRoots.push(userContainer);
        }
      }

      for (const root of scanRoots) {
        const imgElements = Array.from(root.querySelectorAll('img'));
        for (const img of imgElements) {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || (img as HTMLImageElement).src;
          if (!src) continue;

          const width = parseInt(img.getAttribute('width') || '100', 10);
          const height = parseInt(img.getAttribute('height') || '100', 10);
          const isTiny = (width > 0 && width < 32) || (height > 0 && height < 32);
          const isUiGlyph = /favicon|emoji|ui-icon/i.test(img.className || '');
          if (isTiny || isUiGlyph) continue;

          if (!seenImages.has(src)) {
            seenImages.add(src);
            images.push(src);

            try {
              const rect = img.getBoundingClientRect();
              if (rect.width > 20 && rect.height > 20) {
                const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
                imageRects.push({
                  x: rect.left,
                  y: rect.top,
                  width: rect.width,
                  height: rect.height,
                  dpr
                });
              }
            } catch {}
          }
        }
      }

      const contentHtml = clone.innerHTML;
      const contentText = extractCleanText(clone);
      const codeBlocks = extractCodeBlocks(clone);
      const tables = extractTables(clone);

      // Skip truly empty messages, but preserve image-only, code-only, or reasoning-only turns
      const hasContent = contentText.trim().length > 0 || !!reasoning || codeBlocks.length > 0 || images.length > 0;
      const normalizedKey = `${role}:${contentText.trim()}:${images.join(',')}`;
      if (hasContent && !processedTexts.has(normalizedKey)) {
        processedTexts.add(normalizedKey);
        messages.push({
          id: `gemini-msg-${index}-${Date.now()}`,
          role,
          author: role === 'user' ? 'You' : 'Gemini',
          contentHtml,
          contentText,
          codeBlocks,
          reasoning: reasoning && reasoning.length > 0 ? reasoning : undefined,
          tables: tables.length > 0 ? tables : undefined,
          images: images.length > 0 ? images : undefined,
          imageRects: imageRects.length > 0 ? imageRects : undefined
        });
      }
    }

    const totalTablesCount = messages.reduce((acc, m) => acc + (m.tables?.length || 0), 0);

    // Detect active Gemini model dynamically from page DOM
    let model = 'Gemini';
    const candidates: string[] = [];

    // Collect all candidate buttons and elements near composer and page
    const allElements = Array.from(document.querySelectorAll(
      'div[class*="input"] button, div[class*="prompt"] button, div[class*="bottom"] button, div[class*="composer"] button, bard-mode-menu button, button, [role="button"], mat-select, [data-test-id*="mode"], [data-test-id*="model"], [class*="model"], [class*="mode"]'
    ));

    for (const el of allElements) {
      const rawText = (el.textContent || '').replace(/\u00A0/g, ' ').trim().replace(/\s+/g, ' ');
      if (!rawText || rawText.length > 40) continue;
      if (/send|upload|mic|voice|attach|search|menu|upgrade|pricing|star|trial/i.test(rawText)) continue;

      // Match 3.5 Flash-Lite, 3.7 Flash, 3.1 Pro, Flash Extended, Extended thinking, 2.0 Flash Thinking, etc.
      const match = rawText.match(/((?:(?:[0-9]+\.[0-9]+|[0-9]+)\s+)?(?:Flash(?:\s+(?:Extended|Thinking|Pro)|-Lite)?|Pro|Advanced|Ultra)(?:\s+(?:Extended|Thinking))?)/i);
      if (match && match[1]) {
        candidates.push(match[1].trim());
      }
    }

    if (candidates.length > 0) {
      // Prioritize the longest/most specific model descriptor (e.g. "3.7 Flash Extended" over "Flash")
      candidates.sort((a, b) => b.length - a.length);
      const best = candidates[0];
      model = best.toLowerCase().startsWith('gemini') ? best : `Gemini ${best}`;
    }

    return {
      id: `gemini-${Date.now()}`,
      title,
      platform: this.platform,
      url: window.location.href,
      exportedAt: new Date().toISOString(),
      model,
      messages,
      totalTablesCount
    };
  }
}
