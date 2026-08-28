/**
 * ChatGPT Platform Adapter
 * Extracts prompts, assistant responses, code blocks, and KaTeX math from chatgpt.com
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

export class ChatGPTAdapter implements AIPlatformAdapter {
  readonly platform: AIPlatform = 'chatgpt';
  readonly name = 'ChatGPT';

  matches(url: string): boolean {
    return /chatgpt\.com|chat\.openai\.com/i.test(url);
  }

  async extractConversation(): Promise<ConversationData> {
    const title = extractConversationTitle('ChatGPT Conversation');
    const messages: ExtractedMessage[] = [];

    // Target turns by article or message container
    const turnElements = document.querySelectorAll('article, [data-testid^="conversation-turn-"], [data-message-author-role]');

    // Track processed nodes to avoid duplicate nesting
    const processedContainers = new Set<Element>();

    turnElements.forEach((turnEl, index) => {
      // Find author role
      let role: 'user' | 'assistant' = 'assistant';
      const roleAttr = turnEl.getAttribute('data-message-author-role');

      if (roleAttr === 'user') {
        role = 'user';
      } else if (roleAttr === 'assistant') {
        role = 'assistant';
      } else {
        // Semantic inspection
        const isUser = turnEl.querySelector('[data-message-author-role="user"]') ||
                       turnEl.querySelector('.font-semibold:not([class*="assistant"])') ||
                       turnEl.querySelector('[data-testid="user-message"]');
        role = isUser ? 'user' : 'assistant';
      }

      // Find content container
      const contentEl = turnEl.querySelector('[data-message-id]') ||
                        turnEl.querySelector('.markdown, .prose, div[class*="markdown"]') ||
                        turnEl;

      if (processedContainers.has(contentEl)) return;
      processedContainers.add(contentEl);

      // Clone content to safely normalize math
      const clone = contentEl.cloneNode(true) as HTMLElement;
      normalizeLatexMath(clone);

      // Extract ChatGPT Reasoning / Thinking Process (OpenAI o1 / o3-mini models)
      let reasoning: string | undefined;
      const thinkContainer = clone.querySelector(
        'div[class*="thought"], div[class*="reasoning"], [data-testid*="thought"], details[class*="thought"], div[class*="collapse"]'
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

      if (contentText.trim() || reasoning || codeBlocks.length > 0) {
        messages.push({
          id: `chatgpt-msg-${index}-${Date.now()}`,
          role,
          author: role === 'user' ? 'You' : 'ChatGPT',
          contentHtml,
          contentText,
          codeBlocks,
          reasoning: reasoning && reasoning.length > 0 ? reasoning : undefined,
          tables: tables.length > 0 ? tables : undefined
        });
      }
    });

    // Detect model if present
    const modelBadge = document.querySelector('button[data-testid="model-switcher-dropdown-button"], [aria-label*="Model"], div[class*="model"]');
    const model = modelBadge?.textContent?.trim() || 'ChatGPT';

    const totalTablesCount = messages.reduce((acc, m) => acc + (m.tables?.length || 0), 0);

    return {
      id: `chatgpt-${Date.now()}`,
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
