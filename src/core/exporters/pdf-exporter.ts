/**
 * Executive & Academic PDF Export Engine
 * Generates beautiful, styled PDFs using high-DPI canvas slicing and jsPDF,
 * providing 100% Unicode / Greek / Math support with zero blank pages.
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
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
            .map(imgUrl => `<div style="margin: 10px 0; text-align: center;"><img src="${imgUrl}" style="max-width: 100%; max-height: 420px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); object-fit: contain;" /></div>`)
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
          <div style="margin: 12px 0; padding: 12px 14px; background: ${isDark ? '#182234' : '#fefce8'}; border-left: 4px solid #eab308; border-radius: 6px; font-size: 13px; break-inside: avoid;">
            <div style="font-weight: 700; color: ${isDark ? '#facc15' : '#a16207'}; margin-bottom: 6px;">
              🧠 Reasoning Process (${msg.author})
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
              <div style="margin: 14px 0; border: 1px solid ${cardBorder}; border-radius: 8px; background: ${isDark ? '#0f172a' : '#f8fafc'}; padding: 14px; text-align: center; break-inside: avoid;">
                <div style="font-size: 11px; font-weight: 700; color: ${accentCol}; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">🎨 Graphic: ${escapeHtml(art.title)}</div>
                <div style="max-width: 100%; display: flex; justify-content: center; align-items: center; overflow: hidden;">
                  ${art.content}
                </div>
              </div>
            `;
          }
          return `
            <div style="margin: 14px 0; border: 1px solid ${cardBorder}; border-radius: 6px; background: ${codeBg}; padding: 12px; break-inside: auto;">
              <div style="font-size: 12px; font-weight: 700; color: ${accentCol}; margin-bottom: 6px; break-after: avoid;">📦 ARTIFACT: ${escapeHtml(art.title)} (${art.type})</div>
              <pre style="margin: 0; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap; break-inside: auto;"><code>${escapeHtml(art.content)}</code></pre>
            </div>
          `;
        }).join('');
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
        <div class="message-turn" style="margin-bottom: 18px; background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 10px; padding: 16px 20px; break-inside: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid ${cardBorder}; padding-bottom: 8px; break-after: avoid;">
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
            break-inside: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 12.5px;
            break-inside: auto;
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
            max-height: 400px;
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

        <div class="doc-footer" style="margin-top: 18px; padding-top: 10px; border-top: 1px solid ${cardBorderUser}; font-size: 10px; color: ${mutedCol}; text-align: center; break-inside: avoid; break-before: avoid;">
          Generated with <strong>Universal AI Exporter</strong> &bull; 100% Local & Private Document
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates and downloads a clean, multi-page PDF using high-DPI canvas slicing.
   * Eliminates blank pages, prevents cut-off text with smart card boundary snapping,
   * and renders 100% Greek / Unicode characters accurately.
   */
  public static async exportToPDF(
    conversation: ConversationData,
    theme: PDFTheme = 'executive',
    options: ExportOptions = { format: 'pdf' }
  ): Promise<Blob> {
    const html = this.generateDocumentHtml(conversation, theme, options);

    // Create an isolated offscreen iframe to render PDF without affecting the popup DOM
    const iframe = document.createElement('iframe');
    iframe.id = 'uaie-pdf-sandbox';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '794px';
    iframe.style.height = '1123px';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-99999';
    document.body.appendChild(iframe);

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => resolve(), 2500); // Fallback if onload doesn't fire
        iframe.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        iframe.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
        iframe.srcdoc = html;
      });

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc || !iframeDoc.body) {
        throw new Error('Failed to access PDF sandbox document');
      }

      // Wait for any embedded remote or blob images to finish decoding/loading before canvas capture
      const imgElements = Array.from(iframeDoc.querySelectorAll('img'));
      if (imgElements.length > 0) {
        await Promise.race([
          Promise.all(imgElements.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return img.decode().catch(() => {});
          })),
          new Promise(r => setTimeout(r, 2000))
        ]);
      }

      // 1. Calculate dynamic adaptive scale to prevent browser GPU canvas dimension overflow (>32,767px)
      const docHeight = Math.max(iframeDoc.body.scrollHeight, iframeDoc.documentElement.scrollHeight, 1123);
      const safeMaxCanvasHeight = 30000;
      const targetScale = Math.min(2, Math.max(0.5, safeMaxCanvasHeight / docHeight));

      // Render isolated document into canvas (scale 2 by default for crisp vector-like text, dynamically scaled for 50+ turn chats)
      const canvas = await html2canvas(iframeDoc.body, {
        scale: targetScale,
        useCORS: false,
        allowTaint: false,
        logging: false,
        backgroundColor: theme === 'midnight' ? '#0f172a' : '#ffffff',
        windowWidth: 794,
        ignoreElements: (element) => {
          // Ignore tiny decorative icons and avatars (< 24px)
          if (element.tagName === 'IMG') {
            const img = element as HTMLImageElement;
            const src = img.src || img.getAttribute('src') || '';
            if (!src) return true;
            if ((img.naturalWidth > 0 && img.naturalWidth < 24) || (img.naturalHeight > 0 && img.naturalHeight < 24)) {
              return true;
            }
          }
          return false;
        }
      });

      // A4 dimensions in pt
      const pdfWidthPt = 595.28;
      const pdfHeightPt = 841.89;
      const marginPt = 20;

      const printWidthPt = pdfWidthPt - marginPt * 2;
      const printHeightPt = pdfHeightPt - marginPt * 2;

      // Calculate how many canvas pixels correspond to one A4 printable height
      const pageCanvasHeight = (canvas.width * printHeightPt) / printWidthPt;

      // Measure block-level boundaries for element-aware slice snapping (cards, images, tables, code blocks)
      const scale = canvas.width / (iframeDoc.body.clientWidth || 794);
      const bodyRect = iframeDoc.body.getBoundingClientRect();
      const blockElements = Array.from(iframeDoc.querySelectorAll('.message-turn, .header-banner, img, table, pre, blockquote, [class*="image"], [class*="card"]'));
      const blockBounds = blockElements.map(el => {
        const r = el.getBoundingClientRect();
        const isImage = el.tagName === 'IMG' || el.classList.contains('image-container');
        return {
          isImage,
          top: (r.top - bodyRect.top) * scale,
          bottom: (r.bottom - bodyRect.top) * scale
        };
      });

      // Compute smart slice positions
      const pageSlices: { y: number; height: number }[] = [];
      let currentY = 0;

      while (currentY < canvas.height) {
        let nextY = currentY + pageCanvasHeight;

        if (nextY >= canvas.height) {
          pageSlices.push({ y: currentY, height: canvas.height - currentY });
          break;
        }

        // Check if a block element straddles nextY
        let snapY = nextY;
        for (const block of blockBounds) {
          if (block.top < nextY && block.bottom > nextY) {
            // If an image straddles the page boundary, ALWAYS push it to the next page to prevent cutting it in half
            if (block.isImage && block.top > currentY + 40) {
              snapY = block.top - 10;
              break;
            }
            const reduction = nextY - block.top;
            // Snap to block top if reduction is reasonable
            if (block.top > currentY && reduction < pageCanvasHeight * 0.35) {
              snapY = block.top - 8;
              break;
            }
          }
        }

        const sliceHeight = Math.max(snapY - currentY, pageCanvasHeight * 0.4);
        pageSlices.push({ y: currentY, height: sliceHeight });
        currentY += sliceHeight;
      }

      const totalPages = pageSlices.length || 1;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      // 2. Slice master canvas into individual pages based on smart boundaries
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        const slice = pageSlices[page];
        const sourceY = slice.y;
        const sourceHeight = slice.height;

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

      // Explicitly clear canvas dimensions to release GPU memory buffers
      canvas.width = 0;
      canvas.height = 0;

      const blob = pdf.output('blob');
      return blob;
    } finally {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }
  }
}
