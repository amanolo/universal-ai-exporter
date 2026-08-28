/**
 * Universal AI Exporter - Content Script Entry Point
 * Listens for popup commands and initializes the floating action bar.
 */

import { AdapterRegistry } from '../core/adapters/adapter-registry';
import { FloatingToolbar } from './floating-toolbar';
import { MarkdownExporter } from '../core/exporters/markdown-exporter';
import { PDFExporter } from '../core/exporters/pdf-exporter';
import { CSVExporter } from '../core/exporters/csv-exporter';
import { ExportOptions } from '../core/types';

// Initialize Injected Floating Toolbar
const toolbar = new FloatingToolbar();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => toolbar.init());
} else {
  toolbar.init();
}

// Runtime message listener for popup commands
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    try {
      if (request.action === 'GET_CONVERSATION') {
        const adapter = AdapterRegistry.getAdapter();
        const conversation = await adapter.extractConversation();
        sendResponse({ success: true, conversation });
        return;
      }

      if (request.action === 'EXPORT_CONVERSATION') {
        const options: ExportOptions = request.options;
        const adapter = AdapterRegistry.getAdapter();
        const conversation = await adapter.extractConversation();

        if (conversation.messages.length === 0) {
          sendResponse({ success: false, error: 'No conversation messages found on this page.' });
          return;
        }

        if (options.format === 'markdown') {
          const exporter = new MarkdownExporter();
          const content = exporter.exportToMarkdown(conversation, options);
          sendResponse({ success: true, content, filename: `${conversation.title}.md`, mimeType: 'text/markdown' });
          return;
        }

        if (options.format === 'csv') {
          const result = CSVExporter.exportTables(conversation, options.selectedTableIndex);
          sendResponse({ success: true, content: result.csvContent, filename: result.filename, mimeType: 'text/csv' });
          return;
        }

        if (options.format === 'pdf') {
          const html = PDFExporter.generateDocumentHtml(conversation, options.pdfTheme || 'executive', options);
          sendResponse({ success: true, html, title: conversation.title, mimeType: 'application/pdf' });
          return;
        }

        sendResponse({ success: false, error: 'Unknown export format.' });
      }
    } catch (err: any) {
      console.error('PromptDoc Content Script Error:', err);
      sendResponse({ success: false, error: err.message || 'Extraction failed' });
    }
  })();

  return true; // Keep message port open for async response
});
