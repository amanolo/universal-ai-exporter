/**
 * Executive & Academic PDF Export Engine
 * Generates beautiful, styled PDFs using high-DPI canvas slicing and jsPDF,
 * providing 100% Unicode / Greek / Math support with zero blank pages.
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ConversationData, ExportOptions, PDFTheme } from '../types';

export class PDFExporter {
  /**
   * Generates the styled HTML document for PDF rendering
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

      let bodyHtml = msg.contentHtml || `<p>${msg.contentText}</p>`;

      // DeepSeek Reasoning HTML
      let reasoningBlock = '';
      if (msg.reasoning && options.includeReasoning !== false) {
        reasoningBlock = `
          <div style="margin: 12px 0; padding: 12px 14px; background: ${isDark ? '#182234' : '#fefce8'}; border-left: 4px solid #eab308; border-radius: 6px; font-size: 13px; break-inside: avoid;">
            <div style="font-weight: 700; color: ${isDark ? '#facc15' : '#a16207'}; margin-bottom: 6px;">
              🧠 Reasoning Process (${msg.author})
            </div>
            <div style="color: ${isDark ? '#cbd5e1' : '#475569'}; white-space: pre-wrap; font-family: monospace; font-size: 12px; line-height: 1.5;">${msg.reasoning}</div>
          </div>
        `;
      }

      // Claude Artifacts
      let artifactsBlock = '';
      if (msg.artifacts && msg.artifacts.length > 0 && options.includeArtifacts !== false) {
        artifactsBlock = msg.artifacts.map(art => `
          <div style="margin: 14px 0; border: 1px solid ${cardBorder}; border-radius: 6px; background: ${codeBg}; padding: 12px; break-inside: avoid;">
            <div style="font-size: 12px; font-weight: 700; color: ${accentCol}; margin-bottom: 6px;">📦 ARTIFACT: ${art.title} (${art.type})</div>
            <pre style="margin: 0; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap;"><code>${art.content}</code></pre>
          </div>
        `).join('');
      }

      // Perplexity Citations
      let citationsBlock = '';
      if (msg.citations && msg.citations.length > 0 && options.includeCitations !== false) {
        citationsBlock = `
          <div style="margin: 14px 0; padding: 10px 0; border-top: 1px solid ${cardBorder}; font-size: 12px; break-inside: avoid;">
            <div style="font-weight: 700; color: ${mutedCol}; margin-bottom: 6px;">📚 Citations & Sources:</div>
            <ol style="margin: 0; padding-left: 18px;">
              ${msg.citations.map(c => `<li><a href="${c.url}" style="color: ${accentCol}; text-decoration: none; font-weight: 500;">${c.title}</a> <span style="color: ${mutedCol};">(${c.siteName || c.url})</span></li>`).join('')}
            </ol>
          </div>
        `;
      }

      return `
        <div class="message-turn" style="margin-bottom: 18px; background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 10px; padding: 16px 20px; break-inside: avoid;">
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

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${conversation.title}</title>
        <style>
          @page {
            margin: 15mm;
            size: A4 portrait;
          }
          body {
            font-family: ${fontFamily};
            background-color: ${bgCol};
            color: ${textCol};
            margin: 0;
            padding: 24px 28px;
            font-size: 13.5px;
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
            margin-bottom: 22px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
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
        <div class="header-banner">
          <div>
            <h1 class="doc-title">${conversation.title}</h1>
            <div class="doc-meta">
              <span class="badge">${conversation.platform.toUpperCase()}</span>
              <span>Model: <strong>${conversation.model || 'Default'}</strong></span> &bull;
              <span>Exported: ${new Date(conversation.exportedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div style="text-align: right; font-size: 10px; color: ${mutedCol}; line-height: 1.4;">
            <div style="font-weight: 700; color: ${textCol};">UNIVERSAL AI EXPORTER</div>
            <div>100% PRIVATE &bull; LOCAL</div>
          </div>
        </div>

        <div class="conversation-stream">
          ${messagesHtml}
        </div>

        <div style="margin-top: 28px; padding-top: 12px; border-top: 1px solid ${cardBorderUser}; font-size: 10px; color: ${mutedCol}; text-align: center; break-inside: avoid;">
          Generated with <strong>Universal AI Exporter</strong> &bull; 100% Local & Private Document
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates and downloads a clean, multi-page PDF using high-DPI canvas slicing.
   * Eliminates blank pages and renders 100% Greek / Unicode characters accurately.
   */
  public static async exportToPDF(
    conversation: ConversationData,
    theme: PDFTheme = 'executive',
    options: ExportOptions = { format: 'pdf' }
  ): Promise<Blob> {
    const html = this.generateDocumentHtml(conversation, theme, options);

    // Create an attached offscreen container with exact standard width (794px = A4 at 96 DPI)
    const container = document.createElement('div');
    container.id = 'uaie-pdf-sandbox';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.backgroundColor = theme === 'midnight' ? '#0f172a' : '#ffffff';
    container.style.zIndex = '-9999';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      // 1. Render complete document into high-resolution canvas (scale: 2 for crisp vector-like text)
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: theme === 'midnight' ? '#0f172a' : '#ffffff'
      });

      // A4 dimensions in pt
      const pdfWidthPt = 595.28;
      const pdfHeightPt = 841.89;
      const marginPt = 20;

      const printWidthPt = pdfWidthPt - marginPt * 2;
      const printHeightPt = pdfHeightPt - marginPt * 2;

      // Calculate how many canvas pixels correspond to one A4 printable height
      const pageCanvasHeight = (canvas.width * printHeightPt) / printWidthPt;
      const totalPages = Math.ceil(canvas.height / pageCanvasHeight) || 1;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      // 2. Slice master canvas into individual pages
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        const sourceY = page * pageCanvasHeight;
        const sourceHeight = Math.min(pageCanvasHeight, canvas.height - sourceY);

        // Create page slice canvas
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;

        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = theme === 'midnight' ? '#0f172a' : '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            sourceHeight,
            0,
            0,
            canvas.width,
            sourceHeight
          );
        }

        const renderedHeightPt = (sourceHeight * printWidthPt) / canvas.width;
        const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);

        pdf.addImage(imgData, 'JPEG', marginPt, marginPt, printWidthPt, renderedHeightPt, undefined, 'FAST');

        // Add page footer numbers
        pdf.setFontSize(8);
        pdf.setTextColor(theme === 'midnight' ? 148 : 100);
        pdf.text(
          `Page ${page + 1} of ${totalPages}`,
          pdfWidthPt - marginPt - 50,
          pdfHeightPt - 10
        );
      }

      const blob = pdf.output('blob');
      return blob;
    } finally {
      document.body.removeChild(container);
    }
  }

  /**
   * Opens the formatted document in a clean new window with browser print dialog
   */
  public static printDocument(conversation: ConversationData, theme: PDFTheme = 'executive'): void {
    const html = this.generateDocumentHtml(conversation, theme);
    const printWindow = window.open('', '_blank', 'width=850,height=1000');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    }
  }
}
