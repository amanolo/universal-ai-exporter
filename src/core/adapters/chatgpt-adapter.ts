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

    // Select top-level turn containers in ChatGPT (excluding nested children)
    let rawTurns = Array.from(document.querySelectorAll('article, [data-testid^="conversation-turn-"]'));
    if (rawTurns.length === 0) {
      rawTurns = Array.from(document.querySelectorAll('[data-message-author-role], div[data-message-id]'));
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

    const processedKeys = new Set<string>();

    topLevelTurns.forEach((turnEl, index) => {
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

      // Clone turn container to safely extract content and normalize math
      const clone = turnEl.cloneNode(true) as HTMLElement;
      normalizeLatexMath(clone);

      // Unwrap or preserve img tags before removing buttons/action elements
      clone.querySelectorAll('button, [role="button"], [role="menu"], [role="listbox"]').forEach(el => {
        const img = el.querySelector('img');
        if (img) {
          el.replaceWith(img);
        } else {
          el.remove();
        }
      });

      // Remove screen-reader headers, accessibility headings, SVGs, copy buttons, edit buttons, action bars
      clone.querySelectorAll('h4, h5, h6, [class*="sr-only"], [class*="screen-reader"], [data-test-id*="header"], svg, [aria-hidden="true"]').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (
          text === 'chatgpt said:' || text === 'you said:' ||
          text.startsWith('chatgpt said') || text.startsWith('you said') ||
          el.classList.contains('sr-only') || el.tagName === 'SVG'
        ) {
          el.remove();
        }
      });

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

      // Extract content images (exclude tiny UI icons/avatars < 32px and deduplicate)
      const images: string[] = [];
      const seenImages = new Set<string>();
      clone.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || (img as HTMLImageElement).src;
        if (src) {
          const width = parseInt(img.getAttribute('width') || '100', 10);
          const height = parseInt(img.getAttribute('height') || '100', 10);
          const isIcon = (width > 0 && width < 32) || (height > 0 && height < 32) || /avatar|icon|logo|favicon|emoji/i.test(img.className || img.alt || '');
          if (!isIcon && !seenImages.has(src)) {
            seenImages.add(src);
            images.push(src);
          }
        }
      });

      const contentHtml = clone.innerHTML;
      const contentText = extractCleanText(clone);
      const codeBlocks = extractCodeBlocks(clone);
      const tables = extractTables(clone);

      const hasContent = contentText.trim().length > 0 || !!reasoning || codeBlocks.length > 0 || images.length > 0;
      const normalizedKey = `${role}:${contentText.trim()}:${images.join(',')}`;

      if (hasContent && !processedKeys.has(normalizedKey)) {
        processedKeys.add(normalizedKey);
        messages.push({
          id: `chatgpt-msg-${index}-${Date.now()}`,
          role,
          author: role === 'user' ? 'You' : 'ChatGPT',
          contentHtml,
          contentText,
          codeBlocks,
          reasoning: reasoning && reasoning.length > 0 ? reasoning : undefined,
          tables: tables.length > 0 ? tables : undefined,
          images: images.length > 0 ? images : undefined
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
