import { PDFExporter } from '../core/exporters/pdf-exporter';
import { ConversationData, ExportOptions, PDFTheme } from '../core/types';

document.addEventListener('DOMContentLoaded', async () => {
  const btn = document.getElementById('btn-trigger-print');
  btn?.addEventListener('click', () => {
    window.print();
  });

  // Automatically close the print preview tab once print/save completes or is dismissed
  window.addEventListener('afterprint', () => {
    setTimeout(() => {
      try { window.close(); } catch {}
    }, 250);
  });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get('uaie_print_job');
    if (data && data.uaie_print_job) {
      const { conversation, theme, options } = data.uaie_print_job as {
        conversation: ConversationData;
        theme: PDFTheme;
        options: ExportOptions;
      };

      const themeLabel = (theme || 'executive').toUpperCase();
      const titleEl = document.getElementById('print-header-title');
      if (titleEl) {
        titleEl.textContent = `Universal AI Exporter • Print Preview (${themeLabel} Theme)`;
      }

      const html = PDFExporter.generateDocumentHtml(conversation, theme, options);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const styles = doc.querySelectorAll('style');
      styles.forEach(s => document.head.appendChild(s.cloneNode(true)));
      
      document.title = doc.title || 'AI Conversation Export';
      
      const contentEl = document.getElementById('print-content');
      if (contentEl) {
        contentEl.replaceChildren();
        const header = doc.querySelector('.header-banner');
        const stream = doc.querySelector('.conversation-stream');
        const footer = doc.querySelector('.doc-footer');
        
        if (header) contentEl.appendChild(header.cloneNode(true));
        if (stream) contentEl.appendChild(stream.cloneNode(true));
        if (footer) contentEl.appendChild(footer.cloneNode(true));
      }

      if (theme === 'midnight') {
        document.body.style.backgroundColor = '#0f172a';
        document.body.style.color = '#f1f5f9';
      }

      setTimeout(() => {
        try { window.print(); } catch (e) {}
      }, 350);
    }
  }
});
