/**
 * DeepSeek Platform Adapter
 * Detects and exports the <think> reasoning process alongside the final response
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

export class DeepSeekAdapter implements AIPlatformAdapter {
  readonly platform: AIPlatform = 'deepseek';
  readonly name = 'DeepSeek';

  matches(url: string): boolean {
    return /deepseek\.com/i.test(url);
  }

  async extractConversation(): Promise<ConversationData> {
    const title = extractConversationTitle('DeepSeek Conversation');
    const messages: ExtractedMessage[] = [];

    // DeepSeek turn elements
    const turnElements = document.querySelectorAll(
      'div[class*="chat-message"], div[class*="message-wrapper"], div[class*="ds-message"], div[class*="session-message"], div[class*="bubble"]'
    );

    const targetTurns = turnElements.length > 0
      ? turnElements
      : document.querySelectorAll('main div[role="presentation"], main div.flex.flex-col > div');

    targetTurns.forEach((turnEl, index) => {
      // Determine user vs assistant
      const isUser = turnEl.querySelector('div[class*="user"], [data-role="user"]') !== null ||
                     turnEl.className.includes('user') ||
                     turnEl.className.includes('right');

      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

      const clone = turnEl.cloneNode(true) as HTMLElement;
      normalizeLatexMath(clone);

      // Extract DeepSeek Reasoning (<think> / ds-think block)
      let reasoning: string | undefined;
      const thinkContainer = clone.querySelector(
        'div[class*="think"], div[class*="reasoning"], div[class*="ds-think"], details, div[class*="thought"]'
      );

      if (thinkContainer) {
        reasoning = extractCleanText(thinkContainer);
        // Remove think container from main response clone so it is cleanly separated
        thinkContainer.remove();
      }

      // Extract content images (exclude tiny UI icons/avatars < 32px)
      const images: string[] = [];
      clone.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || (img as HTMLImageElement).src;
        if (src) {
          const width = parseInt(img.getAttribute('width') || '100', 10);
          const height = parseInt(img.getAttribute('height') || '100', 10);
          const isIcon = (width > 0 && width < 32) || (height > 0 && height < 32) || /avatar|icon|logo|favicon|emoji/i.test(img.className || img.alt || '');
          if (!isIcon) {
            images.push(src);
          }
        }
      });

      const contentHtml = clone.innerHTML;
      const contentText = extractCleanText(clone);
      const codeBlocks = extractCodeBlocks(clone);
      const tables = extractTables(clone);

      if (contentText.trim() || reasoning || codeBlocks.length > 0 || images.length > 0) {
        messages.push({
          id: `deepseek-msg-${index}-${Date.now()}`,
          role,
          author: role === 'user' ? 'You' : 'DeepSeek',
          contentHtml,
          contentText,
          codeBlocks,
          reasoning: reasoning && reasoning.length > 0 ? reasoning : undefined,
          tables: tables.length > 0 ? tables : undefined,
          images: images.length > 0 ? images : undefined
        });
      }
    });

    const totalTablesCount = messages.reduce((acc, m) => acc + (m.tables?.length || 0), 0);

    return {
      id: `deepseek-${Date.now()}`,
      title,
      platform: this.platform,
      url: window.location.href,
      exportedAt: new Date().toISOString(),
      model: 'DeepSeek-R1 / V3',
      messages,
      totalTablesCount
    };
  }
}
