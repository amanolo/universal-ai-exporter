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

    // Select top-level turn containers in Gemini
    let rawTurns = Array.from(document.querySelectorAll('user-query, model-response, div.conversation-turn, div[class*="user-query"], div[class*="model-response"]'));

    // If neither exists, fallback to message content
    if (rawTurns.length === 0) {
      rawTurns = Array.from(document.querySelectorAll('message-content, div.message-content'));
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

      // Remove accessibility headings like 'You said' or 'Gemini said'
      clone.querySelectorAll('h5, h6, [class*="screen-reader"], [data-test-id*="header"], button, svg').forEach(el => {
        const text = el.textContent?.trim().toLowerCase() || '';
        if (text === 'you said' || text === 'gemini said' || text.startsWith('you said') || text.startsWith('gemini said') || el.tagName === 'BUTTON' || el.tagName === 'SVG') {
          el.remove();
        }
      });

      const contentHtml = clone.innerHTML;
      const contentText = extractCleanText(clone);
      const codeBlocks = extractCodeBlocks(clone);
      const tables = extractTables(clone);

      // Skip empty or duplicate consecutive messages
      const normalizedKey = `${role}:${contentText.trim()}`;
      if (contentText.trim() && !processedTexts.has(normalizedKey)) {
        processedTexts.add(normalizedKey);
        messages.push({
          id: `gemini-msg-${index}-${Date.now()}`,
          role,
          author: role === 'user' ? 'You' : 'Gemini',
          contentHtml,
          contentText,
          codeBlocks,
          tables: tables.length > 0 ? tables : undefined
        });
      }
    });

    const totalTablesCount = messages.reduce((acc, m) => acc + (m.tables?.length || 0), 0);

    return {
      id: `gemini-${Date.now()}`,
      title,
      platform: this.platform,
      url: window.location.href,
      exportedAt: new Date().toISOString(),
      model: 'Gemini 2.5 / Advanced',
      messages,
      totalTablesCount
    };
  }
}
