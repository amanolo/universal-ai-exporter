/**
 * Obsidian & Notion Markdown Export Engine
 * Generates structured Markdown with YAML Frontmatter, LaTeX math, code blocks,
 * DeepSeek reasoning callouts, Claude artifacts, and Perplexity bibliographies.
 */

import TurndownService from 'turndown';
import { ConversationData, ExportOptions, ExtractedMessage } from '../types';

/**
 * Auto-heals unclosed markdown code fences (```) if exported during active AI streaming
 */
export function healCodeFences(text: string): string {
  const matches = text.match(/(?:^|\n)\s*(?:>\s*)*```/g);
  const count = matches ? matches.length : 0;
  if (count % 2 !== 0) {
    return text.trimEnd() + '\n```\n';
  }
  return text;
}

/**
 * Normalizes task list checklists into standard GFM / Obsidian format (- [ ] and - [x])
 * Safely un-escapes Turndown brackets in bullet and numbered lists without affecting code or math.
 */
export function normalizeChecklists(text: string): string {
  return text
    // Handles: - \[ \], - \[\ \], * \[ \], 1. \[ \] -> - [ ]
    .replace(/^(\s*(?:[-*+]|\d+\.))\s*\\?\[\s*\\?\]\s*/gm, '$1 [ ] ')
    // Handles: - \[x\], - \[X\], - \[\ x\ \], * \[x\] -> - [x]
    .replace(/^(\s*(?:[-*+]|\d+\.))\s*\\?\[\s*[xX✓v]\s*\\?\]\s*/gm, '$1 [x] ')
    // Handles: - ☐ -> - [ ], - ☑ / - ☒ -> - [x]
    .replace(/^(\s*(?:[-*+]|\d+\.))\s*☐\s*/gm, '$1 [ ] ')
    .replace(/^(\s*(?:[-*+]|\d+\.))\s*[☑☒✔]\s*/gm, '$1 [x] ');
}

/**
 * Un-escapes accidentally escaped characters inside web URLs (e.g. \_ in URLs)
 * so links like https://example.com/a\_b\_c remain 100% valid and clickable
 */
export function cleanMarkdownUrls(text: string): string {
  return text.replace(/(https?:\/\/[^\s\)\>\]]+)/g, (match) => {
    return match.replace(/\\([_~*\[\]\(\)])/g, '$1');
  });
}

export class MarkdownExporter {
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*'
    });

    this.configureTurndownRules();
  }

  private configureTurndownRules(): void {
    // Keep fenced code blocks with language tags
    this.turndown.addRule('fencedCodeBlock', {
      filter: (node: HTMLElement) => {
        return node.nodeName === 'PRE';
      },
      replacement: (_content: string, node: HTMLElement) => {
        const codeEl = node.querySelector('code');
        const text = codeEl ? codeEl.textContent : node.textContent;
        const className = (codeEl ? codeEl.className : node.className) || '';
        const langMatch = className.match(/(?:language|lang)-([a-zA-Z0-9_+-]+)/i);
        const lang = langMatch ? langMatch[1] : (node.getAttribute('data-language') || '');
        return `\n\n\`\`\`${lang}\n${text?.trim() || ''}\n\`\`\`\n\n`;
      }
    });

    // Custom rule for images: keep valid web URLs with clean concise alt text; filter out dead blob: memory links and tiny icons
    this.turndown.addRule('images', {
      filter: 'img',
      replacement: (_content: string, node: HTMLElement) => {
        const src = node.getAttribute('data-original-src') || node.getAttribute('src') || node.getAttribute('data-src') || (node as HTMLImageElement).src || '';
        if (!src) return '';

        // Ignore dead browser-memory blob: links, raw data: base64 streams, and internal session endpoints in Markdown
        if (src.startsWith('blob:') || src.startsWith('data:') || src.startsWith('/api/') || (src.startsWith('/') && !src.startsWith('//')) || src.includes('/api/')) return '';

        // Ignore tiny UI icons and avatars (dimensions < 32px or explicit emoji/favicons)
        const width = parseInt(node.getAttribute('width') || '100', 10);
        const height = parseInt(node.getAttribute('height') || '100', 10);
        const isTiny = (width > 0 && width < 32) || (height > 0 && height < 32);
        const isUiGlyph = /favicon|emoji|ui-icon/i.test(node.className || '');
        if (isTiny || isUiGlyph) return '';

        // Clean up alt text (truncate long 500-word prompt walls to clean 60 chars)
        let alt = (node.getAttribute('alt') || 'Image').trim();
        if (alt.length > 60) {
          alt = alt.slice(0, 57).trim() + '...';
        }
        return `\n\n![${alt.replace(/[\[\]]/g, '')}](${src})\n\n`;
      }
    });

    // Custom rule for tables
    this.turndown.addRule('tables', {
      filter: ['table'],
      replacement: (_content: string, node: HTMLElement) => {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        const tableMarkdown: string[] = [];
        let headerParsed = false;

        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll('th, td'));
          const cellTexts = cells.map(c => (c.textContent || '').trim().replace(/\|/g, '\\|'));
          const line = `| ${cellTexts.join(' | ')} |`;
          tableMarkdown.push(line);

          if (rowIndex === 0 || (!headerParsed && row.querySelector('th'))) {
            const separator = `| ${cells.map(() => '---').join(' | ')} |`;
            tableMarkdown.push(separator);
            headerParsed = true;
          }
        });

        return `\n\n${tableMarkdown.join('\n')}\n\n`;
      }
    });
  }

  /**
   * Generates YAML Frontmatter for Obsidian / Notion
   */
  private generateFrontmatter(conversation: ConversationData): string {
    const dateFormatted = new Date(conversation.exportedAt).toISOString().replace('T', ' ').slice(0, 19);
    const tags = ['ai-export', conversation.platform];

    return [
      '---',
      `title: "${conversation.title.replace(/"/g, '\\"')}"`,
      `platform: ${conversation.platform}`,
      `model: "${(conversation.model || 'Unknown').replace(/"/g, '\\"')}"`,
      `date: ${dateFormatted}`,
      `source_url: "${conversation.url}"`,
      'tags:',
      ...tags.map(t => `  - ${t}`),
      '---\n\n'
    ].join('\n');
  }

  /**
   * Formats a single extracted message into Markdown
   */
  private formatMessage(msg: ExtractedMessage, options: ExportOptions): string {
    const isUser = msg.role === 'user';
    const header = isUser ? `### 👤 **${msg.author}**` : `### 🤖 **${msg.author}**`;
    const parts: string[] = [header, ''];

    // 1. DeepSeek Reasoning Trace (<think>)
    if (msg.reasoning && (options.includeReasoning !== false)) {
      parts.push('> [!note]- 🧠 **Reasoning Process**');
      const reasoningLines = msg.reasoning.split('\n');
      reasoningLines.forEach(line => {
        parts.push(`> ${line}`);
      });
      parts.push('');
    }

    // 2. Main Response Content
    let markdownContent = '';
    if (msg.contentHtml) {
      try {
        let htmlToProcess = msg.contentHtml;
        // Preprocess checkbox inputs into standard text markers to preserve nested lists
        htmlToProcess = htmlToProcess
          .replace(/<input[^>]*type=["']checkbox["'][^>]*checked[^>]*>/gi, '[x] ')
          .replace(/<input[^>]*checked[^>]*type=["']checkbox["'][^>]*>/gi, '[x] ')
          .replace(/<input[^>]*type=["']checkbox["'][^>]*>/gi, '[ ] ');
        markdownContent = this.turndown.turndown(htmlToProcess);
      } catch (e) {
        markdownContent = msg.contentText;
      }
    } else {
      markdownContent = msg.contentText;
    }

    // Normalize checklists and clean unescaped URLs first
    markdownContent = cleanMarkdownUrls(normalizeChecklists(markdownContent));

    // Ensure extracted web images are present if includeImages is true (default), or strip them if false
    if (options.includeImages !== false) {
      if (msg.images && msg.images.length > 0) {
        const seenUrls = new Set<string>();
        // Match all already-rendered Markdown image URLs
        const existingImgMatches = Array.from(markdownContent.matchAll(/!\[.*?\]\((.*?)\)/g));
        existingImgMatches.forEach(m => {
          if (m[1]) seenUrls.add(m[1].trim());
        });

        msg.images.forEach(imgUrl => {
          // Only append valid external HTTP/HTTPS URLs (ignore local blobs, relative APIs, or base64 streams in raw markdown)
          const isInternalLink = imgUrl.startsWith('blob:') || imgUrl.startsWith('/api/') || imgUrl.startsWith('data:') || (imgUrl.startsWith('/') && !imgUrl.startsWith('//'));
          if (!isInternalLink && (imgUrl.startsWith('http://') || imgUrl.startsWith('https://'))) {
            const isAlreadyRendered = Array.from(seenUrls).some(u =>
              u === imgUrl ||
              (u.length > 15 && imgUrl.includes(u)) ||
              (imgUrl.length > 15 && u.includes(imgUrl))
            );
            if (!isAlreadyRendered) {
              seenUrls.add(imgUrl);
              markdownContent += `\n\n![User Attachment](${imgUrl})\n\n`;
            }
          }
        });
      }
    } else {
      markdownContent = markdownContent.replace(/!\[.*?\]\([^\)]*\)\n*/g, '');
    }

    // Clean residual single-character tool noise (like 'V' or 'visualize')
    markdownContent = markdownContent
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed !== 'V' && trimmed !== 'v' && trimmed.toLowerCase() !== 'visualize' && trimmed.toLowerCase() !== 'show_widget' && trimmed.toLowerCase() !== 'visualize show_widget';
      })
      .join('\n');

    // If message only contained a visual with no text, render image link if available or clean label
    if (!markdownContent.trim() && msg.images && msg.images.length > 0 && options.includeImages !== false) {
      const validWebImages = msg.images.filter(img => img.startsWith('http://') || img.startsWith('https://'));
      if (validWebImages.length > 0) {
        markdownContent = validWebImages.map(img => `![Generated Image](${img})`).join('\n\n');
      } else {
        markdownContent = '*[AI Generated Visual]*';
      }
    }

    // Auto-heal unclosed code fences within message content if exported mid-stream
    parts.push(healCodeFences(markdownContent.trim()));
    parts.push('');

    // 3. AI Generated Visual Graphics Placeholder in Markdown (e.g. Claude visual widgets)
    const svgArtifacts = msg.artifacts ? msg.artifacts.filter(art => art.type === 'svg') : [];
    if (svgArtifacts.length > 0 && options.includeImages !== false) {
      svgArtifacts.forEach(art => {
        const hasTitle = art.title && !art.title.startsWith('Visual Graphic');
        parts.push(`*[AI Generated Graphic${hasTitle ? `: ${art.title}` : ''}]*\n`);
      });
    }

    // 4. Claude Code Artifacts (Code, React, Markdown files; visual SVGs are preserved for PDF rendering)
    const codeArtifacts = msg.artifacts ? msg.artifacts.filter(art => art.type !== 'svg') : [];
    if (codeArtifacts.length > 0 && (options.includeArtifacts !== false)) {
      parts.push('#### 📦 **Claude Artifacts**\n');
      codeArtifacts.forEach((art, idx) => {
        parts.push(`##### Artifact ${idx + 1}: *${art.title}* (${art.type})`);
        parts.push(`\`\`\`${art.language || art.type}\n${art.content}\n\`\`\`\n`);
      });
    }

    // 4. Perplexity Citations
    if (msg.citations && msg.citations.length > 0 && (options.includeCitations !== false)) {
      parts.push('#### 📚 **Citations & References**\n');
      msg.citations.forEach(c => {
        parts.push(`- **[${c.index}]** [${c.title}](${c.url}) ${c.siteName ? `*(${c.siteName})*` : ''}`);
        if (c.snippet) {
          parts.push(`  > "${c.snippet}"`);
        }
      });
      parts.push('');
    }

    parts.push('---\n');
    return parts.join('\n');
  }

  /**
   * Exports the full conversation to Obsidian/Notion ready Markdown
   */
  public exportToMarkdown(conversation: ConversationData, options: ExportOptions = { format: 'markdown' }): string {
    const lines: string[] = [];

    // Frontmatter
    if (options.includeFrontmatter !== false) {
      lines.push(this.generateFrontmatter(conversation));
    }

    // Document Title
    lines.push(`# ${conversation.title}\n`);
    lines.push(`> **Platform:** ${conversation.platform.toUpperCase()} | **Model:** ${conversation.model || 'Default'} | **Exported:** ${new Date(conversation.exportedAt).toLocaleString()}\n`);
    lines.push('---\n');

    // Messages
    conversation.messages.forEach(msg => {
      lines.push(this.formatMessage(msg, options));
    });

    // Global Bibliography if any
    const allCitations = conversation.messages.flatMap(m => m.citations || []);
    if (allCitations.length > 0 && (options.includeCitations !== false)) {
      lines.push('## 📑 Comprehensive Bibliography\n');
      const seen = new Set<string>();
      allCitations.forEach(c => {
        if (!seen.has(c.url)) {
          seen.add(c.url);
          let hostname = '';
          try {
            hostname = new URL(c.url).hostname.replace(/^www\./, '');
          } catch {
            hostname = c.url;
          }
          lines.push(`${c.index}. [${c.title}](${c.url}) — *${c.siteName || hostname}*`);
        }
      });
      lines.push('\n');
    }

    // Footer
    lines.push('\n\n*Exported with Universal AI Exporter — 100% Private & Local.*');

    return healCodeFences(cleanMarkdownUrls(normalizeChecklists(lines.join('\n'))));
  }
}
