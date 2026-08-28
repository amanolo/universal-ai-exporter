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

    topLevelTurns.forEach((turnEl, index) => {
      const tagName = turnEl.tagName.toLowerCase();
      const isUser = tagName.includes('user') ||
                     turnEl.className.includes('user') ||
                     turnEl.querySelector('user-query, [data-test-id="user-query"]') !== null;

      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

      const clone = turnEl.cloneNode(true) as HTMLElement;
      normalizeLatexMath(clone);

      // Remove accessibility headings, action buttons, menus, and dropdowns
      clone.querySelectorAll('h5, h6, [class*="screen-reader"], [data-test-id*="header"], button, svg, [role="menu"], [role="listbox"], bard-mode-menu, mat-menu, [class*="model-selector"]').forEach(el => {
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

      const contentHtml = clone.innerHTML;
      const contentText = extractCleanText(clone);
      const codeBlocks = extractCodeBlocks(clone);
      const tables = extractTables(clone);

      // Skip empty or duplicate consecutive messages
      const normalizedKey = `${role}:${contentText.trim()}`;
      if ((contentText.trim() || reasoning || codeBlocks.length > 0) && !processedTexts.has(normalizedKey)) {
        processedTexts.add(normalizedKey);
        messages.push({
          id: `gemini-msg-${index}-${Date.now()}`,
          role,
          author: role === 'user' ? 'You' : 'Gemini',
          contentHtml,
          contentText,
          codeBlocks,
          reasoning: reasoning && reasoning.length > 0 ? reasoning : undefined,
          tables: tables.length > 0 ? tables : undefined
        });
      }
    });

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

      // Match Flash Extended, Flash Thinking, 3.7 Flash, 2.0 Flash, Flash, Pro, Advanced, Ultra
      const match = rawText.match(/((?:Flash\s+(?:Extended|Thinking|Pro)|(?:3\.[0-9]+|2\.[0-9]+|1\.[0-9]+)\s*Flash|Flash|Pro|Advanced|Ultra))/i);
      if (match && match[1]) {
        candidates.push(match[1].trim());
      }
    }

    if (candidates.length > 0) {
      // Prioritize the longest/most specific model descriptor (e.g. "Flash Extended" over just "Flash")
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
