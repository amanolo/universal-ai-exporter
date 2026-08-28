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
        markdownContent = this.turndown.turndown(msg.contentHtml);
      } catch (e) {
        markdownContent = msg.contentText;
      }
    } else {
      markdownContent = msg.contentText;
    }

    // Auto-heal unclosed code fences within message content if exported mid-stream
    parts.push(healCodeFences(markdownContent.trim()));
    parts.push('');

    // 3. Claude Artifacts
    if (msg.artifacts && msg.artifacts.length > 0 && (options.includeArtifacts !== false)) {
      parts.push('#### 📦 **Claude Artifacts**\n');
      msg.artifacts.forEach((art, idx) => {
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

    return healCodeFences(lines.join('\n'));
  }
}
