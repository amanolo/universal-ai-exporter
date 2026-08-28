/**
 * Claude Platform Adapter
 * Extracts multi-turn conversations and isolates Claude Artifacts (code, HTML, SVG, React)
 */

import { AIPlatform, ClaudeArtifact, ConversationData, ExtractedMessage } from '../types';
import { AIPlatformAdapter } from './adapter-interface';
import {
  extractCleanText,
  extractCodeBlocks,
  extractConversationTitle,
  extractTables,
  normalizeLatexMath
} from '../utils/dom-traversal';

export class ClaudeAdapter implements AIPlatformAdapter {
  readonly platform: AIPlatform = 'claude';
  readonly name = 'Claude';

  matches(url: string): boolean {
    return /claude\.ai/i.test(url);
  }

  async extractConversation(): Promise<ConversationData> {
    const title = extractConversationTitle('Claude Conversation');
    const messages: ExtractedMessage[] = [];

    // Claude turn containers
    const turnElements = document.querySelectorAll(
      '[data-testid="user-message"], [data-is-streaming], div.font-claude-message, div[class*="font-user-message"], div[class*="ChatMessage_container"], div[class*="group/quip"]'
    );

    // Fallback: grid items or article elements
    const targetTurns = turnElements.length > 0
      ? turnElements
      : document.querySelectorAll('main div.grid > div, main div[class*="message"]');

    targetTurns.forEach((turnEl, index) => {
      const isUser = turnEl.matches('[data-testid="user-message"], [class*="font-user"]') ||
                     turnEl.querySelector('[data-testid="user-message"], [class*="font-user"]') !== null;

      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

      const clone = turnEl.cloneNode(true) as HTMLElement;
      normalizeLatexMath(clone);

      // Extract Claude Artifacts if present
      const artifacts: ClaudeArtifact[] = [];
      const artifactElements = clone.querySelectorAll('[data-testid="artifact-button"], div[class*="artifact"], [data-artifact-id]');

      artifactElements.forEach(artEl => {
        const artTitle = artEl.querySelector('div, span, p')?.textContent?.trim() || 'Claude Artifact';
        const codePre = artEl.querySelector('pre, code');
        const content = codePre?.textContent?.trim() || artEl.textContent?.trim() || '';

        let type: ClaudeArtifact['type'] = 'code';
        if (/svg/i.test(artTitle) || /<svg/i.test(content)) type = 'svg';
        else if (/html/i.test(artTitle) || /<!doctype html>/i.test(content)) type = 'html';
        else if (/jsx|tsx|react/i.test(artTitle)) type = 'react';
        else if (/md|markdown/i.test(artTitle)) type = 'markdown';

        if (content) {
          artifacts.push({
            title: artTitle,
            type,
            content
          });
        }
      });

      // Extract Claude 3.7 Thinking / Extended Thought traces
      let reasoning: string | undefined;
      const thinkContainer = clone.querySelector(
        'div[class*="thinking"], div[class*="thought"], [data-testid*="thought"], details[class*="thought"], button[aria-label*="thought"]'
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

      if (contentText.trim() || reasoning || codeBlocks.length > 0 || artifacts.length > 0) {
        messages.push({
          id: `claude-msg-${index}-${Date.now()}`,
          role,
          author: role === 'user' ? 'You' : 'Claude',
          contentHtml,
          contentText,
          codeBlocks,
          reasoning: reasoning && reasoning.length > 0 ? reasoning : undefined,
          artifacts: artifacts.length > 0 ? artifacts : undefined,
          tables: tables.length > 0 ? tables : undefined
        });
      }
    });

    const modelBadge = document.querySelector('button[aria-haspopup="menu"] span, div[class*="model-selector"]');
    const model = modelBadge?.textContent?.trim() || 'Claude 3.5 Sonnet';

    const totalTablesCount = messages.reduce((acc, m) => acc + (m.tables?.length || 0), 0);

    return {
      id: `claude-${Date.now()}`,
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
