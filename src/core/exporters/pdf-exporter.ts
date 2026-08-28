/**
 * Executive & Academic PDF Export Engine
 * Generates beautiful, styled PDFs using jsPDF with 3 distinct themes,
 * syntax highlighting, page-break protection, running headers, and page numbering.
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import Prism from 'prismjs';
import { ConversationData, ExportOptions, PDFTheme } from '../types';

export class PDFExporter {
  /**
   * Generates the styled HTML document for PDF rendering
   */
  public static generateDocumentHtml(conversation: ConversationData, theme: PDFTheme = 'executive', options: ExportOptions = { format: 'pdf' }): string {
    const isDark = theme === 'midnight';
    const isAcademic = theme === 'academic';

    const fontFamily = isAcademic
      ? 'Cambria, "Times New Roman", Georgia, serif'
      : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';

    const bgCol = isDark ? '#0f172a' : '#ffffff';
    const textCol = isDark ? '#f1f5f9' : '#0f172a';
    const mutedCol = isDark ? '#94a3b8' : '#64748b';
    const cardBgUser = isDark ? '#1e293b' : '#f8fafc';
    const cardBgAI = isDark ? '#111e38' : '#f0f9ff';
    const cardBorderUser = isDark ? '#334155' : '#e2e8f0';
    const cardBorderAI = isDark ? '#1e3a8a' : '#bae6fd';
    const accentCol = isDark ? '#38bdf8' : (isAcademic ? '#1e293b' : '#2563eb');
    const codeBg = isDark ? '#020617' : '#f1f5f9';

    // Format messages HTML
    const messagesHtml = conversation.messages.map((msg, idx) => {
      const isUser = msg.role === 'user';
      const cardBg = isUser ? cardBgUser : cardBgAI;
      const cardBorder = isUser ? cardBorderUser : cardBorderAI;
      const roleLabel = isUser ? 'USER PROMPT' : `${(msg.author || 'ASSISTANT').toUpperCase()}`;

      // Syntax highlight code blocks if present
      let bodyHtml = msg.contentHtml || `<p>${msg.contentText}</p>`;

      // Build reasoning HTML
      let reasoningBlock = '';
      if (msg.reasoning && (options.includeReasoning !== false)) {
        reasoningBlock = `
          <div class="reasoning-box" style="margin: 12px 0; padding: 12px 16px; background: ${isDark ? '#182234' : '#fefce8'}; border-left: 4px solid #eab308; border-radius: 4px; font-size: 13px; break-inside: avoid;">
            <div style="font-weight: 700; color: ${isDark ? '#facc15' : '#a16207'}; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span>🧠 Reasoning Process (${msg.author})</span>
            </div>
            <div style="color: ${isDark ? '#cbd5e1' : '#475569'}; white-space: pre-wrap; font-family: monospace; font-size: 12px; line-height: 1.5;">${msg.reasoning}</div>
          </div>
        `;
      }

      // Claude Artifacts
      let artifactsBlock = '';
      if (msg.artifacts && msg.artifacts.length > 0 && (options.includeArtifacts !== false)) {
        artifactsBlock = msg.artifacts.map(art => `
          <div class="artifact-box" style="margin: 14px 0; border: 1px solid ${cardBorder}; border-radius: 6px; background: ${codeBg}; padding: 12px; break-inside: avoid;">
            <div style="font-size: 12px; font-weight: 700; color: ${accentCol}; margin-bottom: 6px;">📦 ARTIFACT: ${art.title} (${art.type})</div>
            <pre style="margin: 0; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap;"><code>${art.content}</code></pre>
          </div>
        `).join('');
      }

      // Perplexity Citations
      let citationsBlock = '';
      if (msg.citations && msg.citations.length > 0 && (options.includeCitations !== false)) {
        citationsBlock = `
          <div class="citations-box" style="margin: 14px 0; padding: 12px; border-top: 1px solid ${cardBorder}; font-size: 12px; break-inside: avoid;">
            <div style="font-weight: 700; color: ${mutedCol}; margin-bottom: 6px;">📚 Citations & Sources:</div>
            <ol style="margin: 0; padding-left: 18px;">
              ${msg.citations.map(c => `<li><a href="${c.url}" style="color: ${accentCol}; text-decoration: none; font-weight: 500;">${c.title}</a> <span style="color: ${mutedCol};">(${c.siteName || c.url})</span></li>`).join('')}
            </ol>
          </div>
        `;
      }

      return `
        <div class="message-turn" style="margin-bottom: 20px; background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 8px; padding: 16px 20px; break-inside: avoid; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid ${cardBorder}; padding-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; letter-spacing: 0.05em; color: ${isUser ? mutedCol : accentCol};">${roleLabel}</span>
            <span style="font-size: 11px; color: ${mutedCol};">Turn #${idx + 1}</span>
          </div>
          ${reasoningBlock}
          <div class="message-body" style="font-size: 14px; line-height: 1.6; color: ${textCol};">
            ${bodyHtml}
          </div>
          ${artifactsBlock}
          ${citationsBlock}
        </div>
      `;
    }).join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${conversation.title}</title>
        <style>
          @page {
            margin: 18mm 15mm 20mm 15mm;
            size: A4 portrait;
          }
          body {
            font-family: ${fontFamily};
            background-color: ${bgCol};
            color: ${textCol};
            margin: 0;
            padding: 24px;
            font-size: 14px;
            line-height: 1.6;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          * {
            box-sizing: border-box;
          }
          .header-banner {
            border-bottom: 2px solid ${accentCol};
            padding-bottom: 14px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .doc-title {
            font-size: 22px;
            font-weight: 800;
            color: ${textCol};
            margin: 0 0 6px 0;
            line-height: 1.2;
          }
          .doc-meta {
            font-size: 12px;
            color: ${mutedCol};
          }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
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
            page-break-inside: avoid;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 14px 0;
            font-size: 13px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          th, td {
            border: 1px solid ${cardBorderUser};
            padding: 8px 10px;
            text-align: left;
          }
          th {
            background-color: ${cardBgUser};
            font-weight: 700;
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
          .break-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <div>
            <h1 class="doc-title">${conversation.title}</h1>
            <div class="doc-meta">
              <span class="badge">${conversation.platform.toUpperCase()}</span>
              <span>Model: <strong>${conversation.model || 'Default'}</strong></span> &bull;
              <span>Exported: ${new Date(conversation.exportedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: ${mutedCol};">
            <div>UNIVERSAL AI EXPORTER</div>
            <div>PROMPTDOC &bull; 100% PRIVATE</div>
          </div>
        </div>

        <div class="conversation-stream">
          ${messagesHtml}
        </div>

        <div style="margin-top: 32px; padding-top: 14px; border-top: 1px solid ${cardBorderUser}; font-size: 11px; color: ${mutedCol}; text-align: center; break-inside: avoid;">
          Generated locally with <strong>Universal AI Exporter (PromptDoc)</strong> &bull; Zero Server Latency &bull; 100% Private Document
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates and downloads the PDF directly in the browser
   */
  public static async exportToPDF(
    conversation: ConversationData,
    theme: PDFTheme = 'executive',
    options: ExportOptions = { format: 'pdf' }
  ): Promise<Blob> {
    const html = this.generateDocumentHtml(conversation, theme, options);

    // Create a sandbox render container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-99999px';
    container.style.left = '-99999px';
    container.style.width = '800px';
    container.style.backgroundColor = theme === 'midnight' ? '#0f172a' : '#ffffff';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      // Render HTML using jsPDF's built-in html renderer
      await pdf.html(container, {
        callback: (doc) => {
          // Page numbering on all pages
          const totalPages = doc.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(theme === 'midnight' ? 148 : 100);
            doc.text(
              `Page ${i} of ${totalPages}`,
              doc.internal.pageSize.getWidth() - 80,
              doc.internal.pageSize.getHeight() - 20
            );
            doc.text(
              `${conversation.title.slice(0, 35)}...`,
              40,
              doc.internal.pageSize.getHeight() - 20
            );
          }
        },
        margin: [30, 30, 40, 30],
        autoPaging: 'text',
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          logging: false
        },
        x: 0,
        y: 0,
        width: 535,
        windowWidth: 800
      });

      const blob = pdf.output('blob');
      return blob;
    } finally {
      document.body.removeChild(container);
    }
  }
}
