/**
 * Executive & Academic Native Print & PDF Export Engine
 * Generates beautiful, styled vector documents with zero external rendering dependencies,
 * leveraging browser-native @media print CSS for 100% vector typography, clickable hyperlinks,
 * and automatic page-break protection.
 */

import { ConversationData, ExportOptions, PDFTheme } from '../types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class PDFExporter {
  /**
   * Generates the styled HTML document for Native Print-to-PDF and Rich Text Clipboard
   */
  public static generateDocumentHtml(
    conversation: ConversationData,
    theme: PDFTheme = 'executive',
    options: ExportOptions = { format: 'pdf' }
  ): string {
    const isDark = theme === 'midnight';
    const isAcademic = theme === 'academic';

    const fontFamily = isAcademic
      ? 'Georgia, "Times New Roman", serif'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    const bgCol = isDark ? '#0f172a' : '#ffffff';
    const textCol = isDark ? '#f1f5f9' : '#0f172a';
    const mutedCol = isDark ? '#94a3b8' : '#64748b';
    const cardBgUser = isDark ? '#1e293b' : '#f8fafc';
    const cardBgAI = isDark ? '#111e38' : '#f0f9ff';
    const cardBorderUser = isDark ? '#334155' : '#e2e8f0';
    const cardBorderAI = isDark ? '#1e3a8a' : '#bae6fd';
    const accentCol = isDark ? '#38bdf8' : (isAcademic ? '#1e293b' : '#0284c7');
    const codeBg = isDark ? '#020617' : '#f1f5f9';

    // Format messages HTML
    const messagesHtml = conversation.messages.map((msg, idx) => {
      const isUser = msg.role === 'user';
      const cardBg = isUser ? cardBgUser : cardBgAI;
      const cardBorder = isUser ? cardBorderUser : cardBorderAI;
      const roleLabel = isUser ? 'USER PROMPT' : `${(msg.author || 'ASSISTANT').toUpperCase()}`;

      let bodyHtml = msg.contentHtml || `<p>${escapeHtml(msg.contentText)}</p>`;

      // Render content images cleanly if includeImages is true (default); otherwise strip them
      if (options.includeImages !== false) {
        if (msg.images && msg.images.length > 0) {
          const uniqueImages = Array.from(new Set(msg.images));
          const appendedImages = uniqueImages
            .filter(imgUrl => {
              const cleanUrl = imgUrl.split('?')[0];
              const escapedUrl = imgUrl.replace(/&/g, '&amp;');
              return !bodyHtml.includes(imgUrl) && !bodyHtml.includes(escapedUrl) && (!cleanUrl || !bodyHtml.includes(cleanUrl));
            })
            .map(imgUrl => `<div style="margin: 12px 0; text-align: center;"><img src="${imgUrl}" style="max-width: 100%; max-height: 440px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); object-fit: contain;" /></div>`)
            .join('');
          bodyHtml += appendedImages;
        }
      } else {
        bodyHtml = bodyHtml.replace(/<img[^>]*>/gi, '');
      }

      // AI Reasoning HTML
      let reasoningBlock = '';
      if (msg.reasoning && options.includeReasoning !== false) {
        reasoningBlock = `
          <div style="margin: 12px 0; padding: 12px 14px; background: ${isDark ? '#182234' : '#fefce8'}; border-left: 4px solid #eab308; border-radius: 6px; font-size: 13px; break-inside: avoid; page-break-inside: avoid;">
            <div style="font-weight: 700; color: ${isDark ? '#facc15' : '#a16207'}; margin-bottom: 6px;">
              🧠 Reasoning Process (${msg.author || 'AI'})
            </div>
            <div style="color: ${isDark ? '#cbd5e1' : '#475569'}; white-space: pre-wrap; font-family: monospace; font-size: 12px; line-height: 1.5;">${escapeHtml(msg.reasoning)}</div>
          </div>
        `;
      }

      // Claude Artifacts
      let artifactsBlock = '';
      if (msg.artifacts && msg.artifacts.length > 0 && options.includeArtifacts !== false) {
        artifactsBlock = msg.artifacts.map(art => {
          if (art.type === 'svg') {
            return `
              <div style="margin: 14px 0; border: 1px solid ${cardBorder}; border-radius: 8px; background: ${isDark ? '#0f172a' : '#f8fafc'}; padding: 14px; text-align: center; break-inside: avoid; page-break-inside: avoid;">
                <div style="font-size: 11px; font-weight: 700; color: ${accentCol}; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">🎨 Graphic: ${escapeHtml(art.title)}</div>
                <div style="max-width: 100%; display: flex; justify-content: center; align-items: center; overflow: hidden;">
                  ${art.content}
                </div>
              </div>
            `;
          }
          return `
            <div style="margin: 14px 0; border: 1px solid ${cardBorder}; border-radius: 6px; background: ${codeBg}; padding: 12px; break-inside: avoid; page-break-inside: avoid;">
              <div style="font-size: 12px; font-weight: 700; color: ${accentCol}; margin-bottom: 6px;">📦 ARTIFACT: ${escapeHtml(art.title)} (${art.type})</div>
              <pre style="margin: 0; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap;"><code>${escapeHtml(art.content)}</code></pre>
            </div>
          `;
        }).join('');
      }

      // Perplexity Citations
      let citationsBlock = '';
      if (msg.citations && msg.citations.length > 0 && options.includeCitations !== false) {
        citationsBlock = `
          <div style="margin: 14px 0; padding: 10px 0; border-top: 1px solid ${cardBorder}; font-size: 12px; break-inside: avoid; page-break-inside: avoid;">
            <div style="font-weight: 700; color: ${mutedCol}; margin-bottom: 6px;">📚 Citations & Sources:</div>
            <ol style="margin: 0; padding-left: 18px;">
              ${msg.citations.map(c => `<li><a href="${c.url}" target="_blank" rel="noopener noreferrer" style="color: ${accentCol}; text-decoration: underline; font-weight: 500;">${escapeHtml(c.title)}</a> <span style="color: ${mutedCol};">(${escapeHtml(c.siteName || c.url)})</span></li>`).join('')}
            </ol>
          </div>
        `;
      }

      return `
        <div class="message-turn" style="margin-bottom: 18px; background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 10px; padding: 16px 20px; break-inside: avoid; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid ${cardBorder}; padding-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: ${isUser ? mutedCol : accentCol};">${roleLabel}</span>
            <span style="font-size: 11px; color: ${mutedCol}; font-weight: 500;">Turn #${idx + 1}</span>
          </div>
          ${reasoningBlock}
          <div style="font-size: 13.5px; line-height: 1.6; color: ${textCol};">
            ${bodyHtml}
          </div>
          ${artifactsBlock}
          ${citationsBlock}
        </div>
      `;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(conversation.title || 'AI Conversation Export')}</title>
  <style>
    @page {
      margin: 15mm;
      size: A4 portrait;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: ${bgCol} !important;
        color: ${textCol} !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .message-turn, .header-banner, pre, table, blockquote, img, svg, .doc-footer {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      a {
        text-decoration: underline !important;
        color: ${accentCol} !important;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: ${fontFamily};
      background-color: ${bgCol};
      color: ${textCol};
      margin: 0;
      padding: 24px 32px;
      font-size: 13.5px;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: ${isDark ? '#1e293b' : '#f1f5f9'};
      border: 1px solid ${isDark ? '#334155' : '#cbd5e1'};
      border-radius: 8px;
      padding: 10px 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .print-btn {
      background: #0284c7;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover {
      background: #0369a1;
    }
    .header-banner {
      border-bottom: 2px solid ${accentCol};
      padding-bottom: 14px;
      margin-bottom: 22px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      break-inside: avoid;
    }
    .doc-title {
      font-size: 20px;
      font-weight: 800;
      color: ${textCol};
      margin: 0 0 6px 0;
      line-height: 1.2;
    }
    .doc-meta {
      font-size: 11.5px;
      color: ${mutedCol};
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 700;
      background: ${accentCol};
      color: #ffffff;
      margin-right: 6px;
    }
    pre {
      background-color: ${codeBg};
      border: 1px solid ${cardBorderUser};
      border-radius: 6px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
      break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 12.5px;
      break-inside: avoid;
    }
    thead {
      display: table-header-group;
    }
    tr {
      break-inside: avoid;
    }
    th, td {
      border: 1px solid ${cardBorderUser};
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background-color: ${cardBgUser};
      font-weight: 700;
      color: ${accentCol};
    }
    img {
      max-width: 100%;
      max-height: 440px;
      border-radius: 8px;
      object-fit: contain;
      display: block;
      margin: 8px auto;
      break-inside: avoid;
    }
    svg {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 8px auto;
      border-radius: 6px;
      break-inside: avoid;
    }
    blockquote {
      margin: 12px 0;
      padding: 8px 16px;
      border-left: 3px solid ${accentCol};
      background: ${cardBgUser};
      color: ${textCol};
      font-style: italic;
    }
    a {
      color: ${accentCol};
      text-decoration: underline;
    }
    ul, ol {
      margin: 8px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <div>
      <strong>Universal AI Exporter</strong> &bull; Print Preview (${theme.toUpperCase()} Theme)
    </div>
    <button class="print-btn" onclick="window.print()">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="header-banner">
    <div>
      <h1 class="doc-title">${escapeHtml(conversation.title || 'AI Conversation')}</h1>
      <div class="doc-meta">
        <span class="badge">${(conversation.platform || 'AI').toUpperCase()}</span>
        <span>Model: <strong>${escapeHtml(conversation.model || 'Default')}</strong></span> &bull;
        <span>Exported: ${new Date(conversation.exportedAt || Date.now()).toLocaleDateString()}</span>
      </div>
    </div>
    <div style="text-align: right; font-size: 10px; color: ${mutedCol}; line-height: 1.4;">
      <div style="font-weight: 700; color: ${textCol};">UNIVERSAL AI EXPORTER</div>
      <div>100% PRIVATE &bull; LOCAL VECTOR PDF</div>
    </div>
  </div>

  <div class="conversation-stream">
    ${messagesHtml}
  </div>

  <div class="doc-footer" style="margin-top: 24px; padding-top: 12px; border-top: 1px solid ${cardBorderUser}; font-size: 10px; color: ${mutedCol}; text-align: center; break-inside: avoid;">
    Generated with <strong>Universal AI Exporter</strong> &bull; 100% Local & Private Document
  </div>

  <script class="no-print">
    // Auto trigger print dialog after page assets settle
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try { window.print(); } catch (e) {}
      }, 350);
    });
  </script>
</body>
</html>`;
  }

  /**
   * Triggers the native browser print/save-to-pdf dialog by opening a clean print tab
   */
  public static async printDocument(
    conversation: ConversationData,
    theme: PDFTheme = 'executive',
    options: ExportOptions = { format: 'pdf' }
  ): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.tabs) {
      await chrome.storage.local.set({
        uaie_print_job: {
          conversation,
          theme,
          options
        }
      });
      const printUrl = chrome.runtime.getURL('print/print.html');
      await chrome.tabs.create({ url: printUrl, active: true });
    } else {
      const html = this.generateDocumentHtml(conversation, theme, options);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      if (typeof window !== 'undefined') {
        const win = window.open(url, '_blank');
        if (win) win.focus();
      }
    }
  }
}
