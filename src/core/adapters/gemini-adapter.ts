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

    // Gemini turns: user-query-container, model-response, message-content
    const turnElements = document.querySelectorAll(
      'user-query, model-response, message-content, div[class*="user-query"], div[class*="model-response"], div[class*="conversation-turn"]'
    );

    const targetTurns = turnElements.length > 0
      ? turnElements
      : document.querySelectorAll('main div.chat-history > div, main div[role="region"]');

    targetTurns.forEach((turnEl, index) => {
      const tagName = turnEl.tagName.toLowerCase();
      const isUser = tagName.includes('user') ||
                     turnEl.className.includes('user') ||
                     turnEl.querySelector('user-query, [data-test-id="user-query"]') !== null;

      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

      const clone = turnEl.cloneNode(true) as HTMLElement;
      normalizeLatexMath(clone);

      const contentHtml = clone.innerHTML;
      const contentText = extractCleanText(clone);
      const codeBlocks = extractCodeBlocks(clone);
      const tables = extractTables(clone);

      if (contentText.trim() || codeBlocks.length > 0) {
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
