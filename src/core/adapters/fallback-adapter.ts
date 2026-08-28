/**
 * Fallback Semantic Tree-Walker Adapter
 * Resilient universal fallback that scans any AI chat page using heuristic DOM traversal
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

export class FallbackAdapter implements AIPlatformAdapter {
  readonly platform: AIPlatform = 'unknown';
  readonly name = 'Universal AI Fallback';

  matches(_url: string): boolean {
    return true; // Matches any page as final fallback
  }

  async extractConversation(): Promise<ConversationData> {
    const title = extractConversationTitle('AI Conversation Export');
    const messages: ExtractedMessage[] = [];

    // Find main conversation container
    const main = document.querySelector('main, #root, #__next, body') || document.body;

    // Use TreeWalker to inspect block-level potential message nodes
    const articles = main.querySelectorAll('article, section, div[role="row"], div[role="presentation"], div[class*="message"]');

    if (articles.length >= 2) {
      articles.forEach((node, idx) => {
        const text = extractCleanText(node);
        if (text.length > 5 && text.length < 50000) {
          const isLikelyUser = idx % 2 === 0;
          const clone = node.cloneNode(true) as HTMLElement;
          normalizeLatexMath(clone);

          messages.push({
            id: `fallback-msg-${idx}`,
            role: isLikelyUser ? 'user' : 'assistant',
            author: isLikelyUser ? 'User' : 'Assistant',
            contentHtml: clone.innerHTML,
            contentText: text,
            codeBlocks: extractCodeBlocks(clone),
            tables: extractTables(clone)
          });
        }
      });
    }

    // If still empty, capture document body text
    if (messages.length === 0) {
      const clone = main.cloneNode(true) as HTMLElement;
      normalizeLatexMath(clone);
      messages.push({
        id: 'fallback-msg-all',
        role: 'assistant',
        author: 'AI Response',
        contentHtml: clone.innerHTML,
        contentText: extractCleanText(clone),
        codeBlocks: extractCodeBlocks(clone),
        tables: extractTables(clone)
      });
    }

    const totalTablesCount = messages.reduce((acc, m) => acc + (m.tables?.length || 0), 0);

    return {
      id: `export-${Date.now()}`,
      title,
      platform: this.platform,
      url: window.location.href,
      exportedAt: new Date().toISOString(),
      model: 'AI Assistant',
      messages,
      totalTablesCount
    };
  }
}
