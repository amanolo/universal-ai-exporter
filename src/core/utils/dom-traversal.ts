/**
 * Universal AI Exporter - DOM Traversal & Extraction Utilities
 * Resilient semantic extraction independent of minified or changing CSS class names.
 */

import { CodeBlock } from '../types';

/**
 * Extracts clean text from an element while preserving inline code, links, and line breaks
 */
export function extractCleanText(element: Element | null): string {
  if (!element) return '';

  const clone = element.cloneNode(true) as HTMLElement;

  // Remove UI action buttons, copy buttons, feedback icons
  const unwanted = clone.querySelectorAll('button, svg, [role="button"], .copy-button, .feedback-btn, [aria-hidden="true"]');
  unwanted.forEach(el => el.remove());

  // Replace br with newlines
  clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));

  // Replace block elements with spacing
  clone.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6').forEach(block => {
    if (block.textContent) {
      block.append('\n');
    }
  });

  return (clone.textContent || '').trim().replace(/\n{3,}/g, '\n\n');
}

/**
 * Extracts code blocks from an element (pre, code, data-language, etc.)
 */
export function extractCodeBlocks(element: Element): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const preElements = element.querySelectorAll('pre');

  preElements.forEach(pre => {
    let language = 'plaintext';

    // Check language from class name (e.g. language-typescript, lang-python)
    const codeEl = pre.querySelector('code');
    const classTarget = codeEl ? codeEl.className : pre.className;
    const langMatch = classTarget.match(/(?:language|lang)-([a-zA-Z0-9_+-]+)/i);

    if (langMatch && langMatch[1]) {
      language = langMatch[1].toLowerCase();
    } else {
      // Check data attributes or sibling header
      const langAttr = pre.getAttribute('data-language') || codeEl?.getAttribute('data-language');
      if (langAttr) {
        language = langAttr.toLowerCase();
      } else {
        // Look for header with language name
        const headerEl = pre.parentElement?.querySelector('span, div');
        if (headerEl && headerEl !== pre) {
          const headerText = headerEl.textContent?.trim() || '';
          if (headerText && headerText.length < 20 && !headerText.toLowerCase().includes('copy')) {
            language = headerText.toLowerCase();
          }
        }
      }
    }

    const code = (codeEl ? codeEl.textContent : pre.textContent) || '';
    if (code.trim()) {
      blocks.push({
        language,
        code: code.replace(/\r\n/g, '\n')
      });
    }
  });

  return blocks;
}

/**
 * Parses all <table> elements inside a container into a 3D matrix [tables][rows][cells]
 */
export function extractTables(element: Element): string[][][] {
  const tables: string[][][] = [];
  const tableElements = element.querySelectorAll('table');

  tableElements.forEach(table => {
    const tableData: string[][] = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
      const rowData: string[] = [];
      const cells = row.querySelectorAll('th, td');
      cells.forEach(cell => {
        const text = (cell.textContent || '').trim().replace(/\s+/g, ' ');
        rowData.push(text);
      });
      if (rowData.length > 0) {
        tableData.push(rowData);
      }
    });

    if (tableData.length > 0) {
      tables.push(tableData);
    }
  });

  return tables;
}

/**
 * Normalizes LaTeX math formulas from KaTeX / MathJax rendered elements
 */
export function normalizeLatexMath(element: Element): void {
  // KaTeX: find .katex and extract annotation[encoding="application/x-tex"]
  const katexElements = element.querySelectorAll('.katex');
  katexElements.forEach(k => {
    const annotation = k.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation && annotation.textContent) {
      const tex = annotation.textContent.trim();
      const isDisplay = k.classList.contains('katex-display') || k.closest('.katex-display') !== null;
      const textNode = document.createTextNode(isDisplay ? `\n$$${tex}$$\n` : `$${tex}$`);
      k.replaceWith(textNode);
    }
  });

  // MathJax: find script[type^="math/tex"]
  const mathJaxElements = element.querySelectorAll('script[type^="math/tex"]');
  mathJaxElements.forEach(script => {
    const tex = script.textContent?.trim() || '';
    const isDisplay = script.getAttribute('type')?.includes('mode=display');
    const textNode = document.createTextNode(isDisplay ? `\n$$${tex}$$\n` : `$${tex}$`);
    script.parentElement?.replaceWith(textNode);
  });
}

/**
 * Detects page title from document or common conversation title headers
 */
export function extractConversationTitle(defaultTitle = 'AI Conversation'): string {
  // Check document.title
  let title = document.title || '';

  // Clean common suffixes
  title = title
    .replace(/\s*-\s*ChatGPT.*$/i, '')
    .replace(/\s*\|\s*Claude.*$/i, '')
    .replace(/\s*-\s*Perplexity.*$/i, '')
    .replace(/\s*-\s*DeepSeek.*$/i, '')
    .replace(/\s*-\s*Gemini.*$/i, '')
    .replace(/^ChatGPT\s*-\s*/i, '')
    .replace(/^Claude\s*-\s*/i, '')
    .replace(/^Gemini\s*-\s*/i, '')
    .trim();

  if (title && title !== 'ChatGPT' && title !== 'Claude' && title !== 'Perplexity' && title !== 'DeepSeek' && title !== 'Gemini') {
    return title;
  }

  // Look for first H1 or active conversation item in sidebar
  const h1 = document.querySelector('h1');
  if (h1 && h1.textContent?.trim()) {
    return h1.textContent.trim();
  }

  const activeNav = document.querySelector('nav [aria-current="page"], nav .active, [data-testid^="history-item-active"]');
  if (activeNav && activeNav.textContent?.trim()) {
    return activeNav.textContent.trim();
  }

  return defaultTitle;
}
