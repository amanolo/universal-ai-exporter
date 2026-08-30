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

    // Claude turn containers (select distinct message elements)
    let rawTurns = Array.from(document.querySelectorAll(
      '[data-testid="user-message"], div[class*="font-user-message"], div.font-claude-message, div[class*="font-claude"], [data-is-streaming]'
    ));

    // Fallback: grid items or article elements
    if (rawTurns.length === 0) {
      rawTurns = Array.from(document.querySelectorAll('main div.grid > div, main div[class*="message"]'));
    }

    // Deduplicate nested elements (ignore elements whose ancestor is already in rawTurns)
    const targetTurns = rawTurns.filter(el => {
      let parent = el.parentElement;
      while (parent) {
        if (rawTurns.includes(parent)) {
          return false;
        }
        parent = parent.parentElement;
      }
      return true;
    });

    const processedKeys = new Set<string>();

    targetTurns.forEach((turnEl, index) => {
      const isUser = turnEl.matches('[data-testid="user-message"], [class*="font-user"]') ||
                     turnEl.querySelector('[data-testid="user-message"], [class*="font-user"]') !== null ||
                     turnEl.className.includes('user');

      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

      const clone = turnEl.cloneNode(true) as HTMLElement;
      normalizeLatexMath(clone);

      // Unwrap img tags from buttons/wrappers before filtering buttons (preserve artifacts)
      clone.querySelectorAll('button, [role="button"], [role="menu"], [role="listbox"]').forEach(el => {
        if (el.matches('[data-testid="artifact-button"], [class*="artifact"]') || el.querySelector('[data-testid="artifact-button"]')) {
          return;
        }
        const img = el.querySelector('img');
        if (img) {
          el.replaceWith(img);
        } else if (!el.querySelector('pre, code')) {
          el.remove();
        }
      });

      // Remove accessibility headings, tool execution headers, and decorative noise
      clone.querySelectorAll('h2, h3, h4, h5, h6, [class*="sr-only"], [class*="screen-reader"], [data-test-id*="header"], [aria-hidden="true"], button, div, span').forEach(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (
          text.startsWith('claude responded') ||
          text.startsWith('you said') ||
          text === 'visualize' ||
          text === 'show_widget' ||
          text === 'v' ||
          text === 'visualize show_widget' ||
          el.classList.contains('sr-only') ||
          el.classList.contains('screen-reader')
        ) {
          if (!el.querySelector('p, svg, img, pre, table')) {
            el.remove();
          }
        }
      });

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

      // Extract content images (exclude tiny UI icons/avatars < 32px and deduplicate)
      const images: string[] = [];
      const seenImages = new Set<string>();

      // Scan live DOM elements FIRST (turnEl and its parent wrapper) so live canvas pixels & iframe widgets are captured
      const liveVisualRoots: Element[] = [turnEl];
      if (turnEl.parentElement) {
        const wrapper = turnEl.closest('[class*="group"], [class*="ChatMessage"]') || turnEl.parentElement;
        if (wrapper && wrapper !== turnEl) liveVisualRoots.push(wrapper);
      }

      liveVisualRoots.forEach(root => {
        // 1. Direct SVGs in live DOM
        root.querySelectorAll('svg').forEach((svgEl) => {
          let p: Element | null = svgEl.parentElement;
          while (p) {
            if (p.tagName === 'PRE' || p.tagName === 'CODE') return;
            p = p.parentElement;
          }

          const width = parseInt(svgEl.getAttribute('width') || '100', 10);
          const height = parseInt(svgEl.getAttribute('height') || '100', 10);
          const isIcon = (width > 0 && width < 32) || (height > 0 && height < 32) || /avatar|icon|logo|favicon|emoji|button/i.test(svgEl.getAttribute('class') || '');
          const svgContent = svgEl.outerHTML;
          if (!isIcon && svgContent.length > 80 && !artifacts.some(a => a.content === svgContent)) {
            const titleEl = svgEl.querySelector('title');
            const svgTitle = titleEl?.textContent?.trim() || `Visual Graphic ${artifacts.length + 1}`;
            artifacts.push({
              title: svgTitle,
              type: 'svg',
              content: svgContent
            });
          }
        });

        // 2. Sandboxed iframes hosting Claude visual widgets
        root.querySelectorAll('iframe').forEach(iframe => {
          let extractedFromIframe = false;

          // Check srcdoc attribute
          const srcdoc = iframe.getAttribute('srcdoc') || '';
          if (srcdoc) {
            const svgMatch = srcdoc.match(/<svg[\s\S]*?<\/svg>/i);
            if (svgMatch && !artifacts.some(a => a.content === svgMatch[0])) {
              artifacts.push({
                title: `Visual Graphic ${artifacts.length + 1}`,
                type: 'svg',
                content: svgMatch[0]
              });
              extractedFromIframe = true;
            }
          }

          // Check live iframe contentDocument if accessible
          try {
            const ifrDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (ifrDoc) {
              const ifrCanvas = ifrDoc.querySelector('canvas');
              if (ifrCanvas instanceof HTMLCanvasElement && ifrCanvas.width > 32 && ifrCanvas.height > 32) {
                const dataUrl = ifrCanvas.toDataURL('image/png');
                if (dataUrl && dataUrl.startsWith('data:image') && !seenImages.has(dataUrl)) {
                  seenImages.add(dataUrl);
                  images.push(dataUrl);
                  extractedFromIframe = true;
                }
              }
              const ifrSvg = ifrDoc.querySelector('svg');
              if (ifrSvg && ifrSvg.outerHTML.length > 80 && !artifacts.some(a => a.content === ifrSvg.outerHTML)) {
                artifacts.push({
                  title: `Visual Graphic ${artifacts.length + 1}`,
                  type: 'svg',
                  content: ifrSvg.outerHTML
                });
                extractedFromIframe = true;
              }
            }
          } catch {
            // sandbox iframe restriction
          }
        });

        // 3. Claude Tool Request/Response payloads containing vector SVG / widget_code
        root.querySelectorAll('code, pre').forEach(codeEl => {
          if (codeEl.tagName === 'PRE' && codeEl.querySelector('code')) return;

          const rawText = codeEl.textContent || '';
          const innerHtml = codeEl.innerHTML || '';
          const hasWidgetCode = rawText.includes('widget_code') || innerHtml.includes('widget_code');
          const hasSvg = rawText.includes('<svg') || innerHtml.includes('<svg') || codeEl.querySelector('svg') !== null;

          if (hasWidgetCode || hasSvg) {
            let svgContent = '';
            let title = '';

            try {
              const parsed = JSON.parse(rawText);
              if (parsed && typeof parsed.widget_code === 'string' && parsed.widget_code.trim()) {
                svgContent = parsed.widget_code.trim();
              }
              if (parsed && parsed.title) {
                title = parsed.title.replace(/_/g, ' ');
              }
            } catch {}

            if (!svgContent) {
              const innerSvg = codeEl.querySelector('svg');
              if (innerSvg) {
                svgContent = innerSvg.outerHTML;
              } else {
                const svgMatch = (rawText + '\n' + innerHtml).match(/<svg[\s\S]*?<\/svg>/i);
                if (svgMatch) svgContent = svgMatch[0];
              }
            }

            if (!title) {
              const titleMatch = (rawText + '\n' + innerHtml).match(/"title"\s*:\s*"([^"]+)"/i);
              if (titleMatch) title = titleMatch[1].replace(/_/g, ' ');
            }

            if (svgContent && !artifacts.some(a => a.content === svgContent)) {
              const cleanTitle = title ? title.charAt(0).toUpperCase() + title.slice(1) : `Visual Graphic ${artifacts.length + 1}`;
              artifacts.push({
                title: cleanTitle,
                type: 'svg',
                content: svgContent
              });
            }
          }
        });

        // 3. Live HTML5 Canvases (capture pixels directly from live screen)
        root.querySelectorAll('canvas').forEach(canvas => {
          try {
            const isCanvasElem = typeof HTMLCanvasElement !== 'undefined'
              ? canvas instanceof HTMLCanvasElement
              : (typeof window !== 'undefined' && typeof window.HTMLCanvasElement !== 'undefined' && canvas instanceof window.HTMLCanvasElement);

            if (isCanvasElem && (canvas as HTMLCanvasElement).width > 32 && (canvas as HTMLCanvasElement).height > 32) {
              const dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
              if (dataUrl && dataUrl.startsWith('data:image') && !seenImages.has(dataUrl)) {
                seenImages.add(dataUrl);
                images.push(dataUrl);
              }
            }
          } catch {
            // cross-origin canvas protection
          }
        });
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

      liveVisualRoots.forEach(root => {
        root.querySelectorAll('img, [data-testid*="attachment"] img, [class*="attachment"] img, [class*="thumbnail"] img').forEach(img => {
          let src = img.getAttribute('src') || img.getAttribute('data-src') || (img as HTMLImageElement).src;
          if (src) {
            const width = parseInt(img.getAttribute('width') || '100', 10);
            const height = parseInt(img.getAttribute('height') || '100', 10);
            const isIcon = (width > 0 && width < 32) || (height > 0 && height < 32) || /avatar|icon|logo|favicon|emoji/i.test(img.className || img.getAttribute('alt') || '');
            
            // If relative API path, resolve to full origin URL
            if (src.startsWith('/')) {
              src = `https://claude.ai${src}`;
            }

            // Try converting live image to Base64 in content script for reliable offline PDF rendering
            const isImgElem = typeof HTMLImageElement !== 'undefined'
              ? img instanceof HTMLImageElement
              : (typeof window !== 'undefined' && typeof window.HTMLImageElement !== 'undefined' && img instanceof window.HTMLImageElement);

            if (isImgElem && (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0) {
              try {
                const htmlImg = img as HTMLImageElement;
                const canvas = document.createElement('canvas');
                const maxW = 1200;
                const targetW = Math.min(htmlImg.naturalWidth, maxW);
                const scale = targetW / htmlImg.naturalWidth;
                canvas.width = targetW;
                canvas.height = htmlImg.naturalHeight * scale;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(htmlImg, 0, 0, canvas.width, canvas.height);
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                  if (dataUrl && dataUrl.startsWith('data:image')) {
                    src = dataUrl;
                  }
                }
              } catch {
                // Keep URL on cross-origin restriction
              }
            }

            if (!isIcon && !seenImages.has(src)) {
              seenImages.add(src);
              images.push(src);
            }
          }
        });
      });

      // Remove tool call containers, buttons, and raw tool payload JSON from the clone while preserving conversation text
      clone.querySelectorAll('[id*="mcp-app"], [id*="toolu_"], details, summary, button, div[class*="font-ui"], div[class*="min-h-"]').forEach(el => {
        el.remove();
      });

      clone.querySelectorAll('pre, code').forEach(el => {
        const t = el.textContent || '';
        if (
          t.includes('loading_messages') ||
          t.includes('widget_code') ||
          t.includes('Content rendered and shown') ||
          t.includes('This tool call rendered')
        ) {
          el.remove();
        }
      });

      clone.querySelectorAll('div, span, p').forEach(el => {
        const t = (el.textContent || '').trim().toLowerCase();
        if (
          t === 'v' ||
          t === 'visualize' ||
          t === 'show_widget' ||
          t === 'visualize show_widget' ||
          t === 'view request/response' ||
          t === 'request' ||
          t === 'response' ||
          t.startsWith('content rendered and shown') ||
          t.startsWith('[this tool call rendered')
        ) {
          if (!el.querySelector('p, table, pre, code, ul, ol') || el.children.length === 0) {
            el.remove();
          }
        }
      });

      // Remove empty container divs left over after tool stripping
      let removedAny = true;
      while (removedAny) {
        removedAny = false;
        clone.querySelectorAll('div, span, section').forEach(el => {
          if (!el.textContent?.trim() && !el.querySelector('img, svg, table, pre, code, iframe')) {
            el.remove();
            removedAny = true;
          }
        });
      }

      const contentHtml = clone.innerHTML;
      let contentText = extractCleanText(clone);
      // Clean isolated V / visualize / show_widget / request / response lines
      contentText = contentText
        .split('\n')
        .filter(l => {
          const trimmed = l.trim().toLowerCase();
          return trimmed !== 'v' &&
                 trimmed !== 'visualize' &&
                 trimmed !== 'show_widget' &&
                 trimmed !== 'visualize show_widget' &&
                 trimmed !== 'request' &&
                 trimmed !== 'response' &&
                 !trimmed.includes('loading_messages') &&
                 !trimmed.includes('widget_code') &&
                 !trimmed.includes('content rendered and shown') &&
                 !trimmed.includes('this tool call rendered');
        })
        .join('\n')
        .trim();

      const codeBlocks = extractCodeBlocks(clone);
      const tables = extractTables(clone);

      const hasContent = contentText.trim().length > 0 || !!reasoning || codeBlocks.length > 0 || artifacts.length > 0 || images.length > 0;
      const normalizedKey = `${role}:${contentText.trim()}:${images.join(',')}`;

      if (hasContent && !processedKeys.has(normalizedKey)) {
        processedKeys.add(normalizedKey);
        messages.push({
          id: `claude-msg-${index}-${Date.now()}`,
          role,
          author: role === 'user' ? 'You' : 'Claude',
          contentHtml,
          contentText,
          codeBlocks,
          reasoning: reasoning && reasoning.length > 0 ? reasoning : undefined,
          artifacts: artifacts.length > 0 ? artifacts : undefined,
          tables: tables.length > 0 ? tables : undefined,
          images: images.length > 0 ? images : undefined
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
