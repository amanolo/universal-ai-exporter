/**
 * Perplexity Platform Adapter
 * Extracts research summaries and generates clean Academic Bibliographies from web sources
 */

import { AIPlatform, ConversationData, ExtractedMessage, WebCitation } from '../types';
import { AIPlatformAdapter } from './adapter-interface';
import {
  extractCleanText,
  extractCodeBlocks,
  extractConversationTitle,
  extractTables,
  normalizeLatexMath
} from '../utils/dom-traversal';

export class PerplexityAdapter implements AIPlatformAdapter {
  readonly platform: AIPlatform = 'perplexity';
  readonly name = 'Perplexity';

  matches(url: string): boolean {
    return /perplexity\.ai/i.test(url);
  }

  async extractConversation(): Promise<ConversationData> {
    const title = extractConversationTitle('Perplexity Research Thread');
    const messages: ExtractedMessage[] = [];

    // Extract all global source citation cards if present
    const globalCitations: WebCitation[] = [];
    const sourceCardElements = document.querySelectorAll('a[href^="http"]:not([href*="perplexity.ai"]), div[class*="source"], [data-testid^="source-"]');

    let citationIndex = 1;
    const seenUrls = new Set<string>();

    sourceCardElements.forEach(card => {
      const linkEl = (card.tagName === 'A' ? card : card.querySelector('a')) as HTMLAnchorElement | null;
      if (!linkEl || !linkEl.href) return;

      const url = linkEl.href;
      if (seenUrls.has(url) || url.includes('perplexity.ai/search')) return;
      seenUrls.add(url);

      let cardTitle = card.querySelector('div[class*="title"], span[class*="title"], h4, div.font-medium')?.textContent?.trim() || '';
      if (!cardTitle) cardTitle = linkEl.textContent?.trim() || new URL(url).hostname;

      let snippet = card.querySelector('div[class*="snippet"], p, div.text-xs')?.textContent?.trim();
      let siteName = new URL(url).hostname.replace(/^www\./, '');

      globalCitations.push({
        index: citationIndex++,
        title: cardTitle,
        url,
        snippet,
        siteName
      });
    });

    // Extract query and answer threads
    const queryContainers = document.querySelectorAll('div[class*="Query"], div[class*="query"], h1, div[dir="auto"]');
    const answerContainers = document.querySelectorAll('div[class*="prose"], div[class*="answer"], div[class*="Answer"]');

    // If query/answer containers are distinct
    if (answerContainers.length > 0) {
      answerContainers.forEach((ansEl, idx) => {
        // Find corresponding user query if exists
        const queryEl = queryContainers[idx];
        if (queryEl && idx === 0) {
          const queryText = extractCleanText(queryEl);
          if (queryText) {
            messages.push({
              id: `pplx-user-${idx}`,
              role: 'user',
              author: 'You',
              contentHtml: queryEl.innerHTML,
              contentText: queryText,
              codeBlocks: []
            });
          }
        }

        const clone = ansEl.cloneNode(true) as HTMLElement;
        normalizeLatexMath(clone);

        const contentHtml = clone.innerHTML;
        const contentText = extractCleanText(clone);
        const codeBlocks = extractCodeBlocks(clone);
        const tables = extractTables(clone);

        messages.push({
          id: `pplx-ans-${idx}`,
          role: 'assistant',
          author: 'Perplexity',
          contentHtml,
          contentText,
          codeBlocks,
          citations: globalCitations.length > 0 ? globalCitations : undefined,
          tables: tables.length > 0 ? tables : undefined
        });
      });
    } else {
      // Fallback to main content
      const mainEl = document.querySelector('main') || document.body;
      const clone = mainEl.cloneNode(true) as HTMLElement;
      normalizeLatexMath(clone);

      messages.push({
        id: `pplx-main-${Date.now()}`,
        role: 'assistant',
        author: 'Perplexity',
        contentHtml: clone.innerHTML,
        contentText: extractCleanText(clone),
        codeBlocks: extractCodeBlocks(clone),
        citations: globalCitations.length > 0 ? globalCitations : undefined,
        tables: extractTables(clone)
      });
    }

    const totalTablesCount = messages.reduce((acc, m) => acc + (m.tables?.length || 0), 0);

    return {
      id: `perplexity-${Date.now()}`,
      title,
      platform: this.platform,
      url: window.location.href,
      exportedAt: new Date().toISOString(),
      model: 'Perplexity Pro / Default',
      messages,
      totalTablesCount
    };
  }
}
