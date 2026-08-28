/**
 * Universal AI Exporter - Injected Floating Toolbar
 * Renders an unobtrusive, glassmorphic export button bar into supported AI web apps.
 */

import { AdapterRegistry } from '../core/adapters/adapter-registry';
import { MarkdownExporter } from '../core/exporters/markdown-exporter';
import { PDFExporter } from '../core/exporters/pdf-exporter';
import { CSVExporter } from '../core/exporters/csv-exporter';
import { downloadBlob, sanitizeFilename } from '../core/utils/download-helper';
import { LicenseManager } from '../core/licensing/license-manager';

export class FloatingToolbar {
  private container: HTMLElement | null = null;
  private isMinimized = false;

  public init(): void {
    if (document.getElementById('promptdoc-toolbar-host')) return;

    this.container = document.createElement('div');
    this.container.id = 'promptdoc-toolbar-host';
    this.render();
    document.body.appendChild(this.container);
  }

  private showToast(message: string, durationMs = 3000): void {
    if (!this.container) return;
    const existing = this.container.querySelector('.pdoc-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'pdoc-toast';
    toast.innerHTML = `<span>✨</span><span>${message}</span>`;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, durationMs);
  }

  private render(): void {
    if (!this.container) return;

    const platform = AdapterRegistry.detectPlatform();
    const platformDisplay = platform.toUpperCase();

    this.container.innerHTML = `
      <div class="pdoc-pill ${this.isMinimized ? 'pdoc-minimized' : ''}">
        <div class="pdoc-brand" title="Universal AI Exporter (PromptDoc)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span class="pdoc-brand-text">PromptDoc</span>
        </div>

        <div class="pdoc-actions">
          <button class="pdoc-btn pdoc-btn-primary" id="pdoc-btn-pdf" title="Export clean Executive PDF">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
              <path d="M14 2v6h6"></path>
            </svg>
            <span>PDF</span>
          </button>

          <button class="pdoc-btn" id="pdoc-btn-md" title="Export Obsidian / Notion Markdown">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="7 15 7 9 10 12 13 9 13 15"></polyline>
              <polyline points="17 9 17 15 15 13"></polyline>
            </svg>
            <span>MD</span>
          </button>

          <button class="pdoc-btn" id="pdoc-btn-csv" title="Extract data tables to CSV">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
            <span>CSV</span>
          </button>

          <button class="pdoc-collapse-btn" id="pdoc-btn-toggle" title="Minimize toolbar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Toggle minimize
    const toggleBtn = this.container.querySelector('#pdoc-btn-toggle');
    const brand = this.container.querySelector('.pdoc-brand');

    const toggle = () => {
      this.isMinimized = !this.isMinimized;
      this.render();
    };

    toggleBtn?.addEventListener('click', toggle);
    if (this.isMinimized) {
      brand?.addEventListener('click', toggle);
    }

    // Export PDF
    this.container.querySelector('#pdoc-btn-pdf')?.addEventListener('click', async () => {
      try {
        this.showToast('Generating PDF...');
        const adapter = AdapterRegistry.getAdapter();
        const conversation = await adapter.extractConversation();

        if (conversation.messages.length === 0) {
          this.showToast('⚠️ No chat messages found on this page.');
          return;
        }

        const isPro = await LicenseManager.isFeatureAllowed('pdf_executive');
        const theme = isPro ? 'executive' : 'executive';

        const blob = await PDFExporter.exportToPDF(conversation, theme, { format: 'pdf' });
        const filename = sanitizeFilename(conversation.title, 'pdf');
        downloadBlob(blob, filename, 'application/pdf');
        this.showToast(`✅ Exported ${conversation.messages.length} messages to PDF!`);
      } catch (err) {
        console.error('PromptDoc PDF export error:', err);
        this.showToast('❌ PDF generation failed. Check console.');
      }
    });

    // Export Markdown
    this.container.querySelector('#pdoc-btn-md')?.addEventListener('click', async () => {
      try {
        this.showToast('Generating Markdown...');
        const adapter = AdapterRegistry.getAdapter();
        const conversation = await adapter.extractConversation();

        if (conversation.messages.length === 0) {
          this.showToast('⚠️ No chat messages found on this page.');
          return;
        }

        const exporter = new MarkdownExporter();
        const markdown = exporter.exportToMarkdown(conversation, { format: 'markdown', includeFrontmatter: true });
        const filename = sanitizeFilename(conversation.title, 'md');
        downloadBlob(markdown, filename, 'text/markdown');
        this.showToast(`✅ Exported to Obsidian-ready Markdown!`);
      } catch (err) {
        console.error('PromptDoc Markdown export error:', err);
        this.showToast('❌ Markdown export failed.');
      }
    });

    // Export CSV
    this.container.querySelector('#pdoc-btn-csv')?.addEventListener('click', async () => {
      try {
        this.showToast('Extracting tables...');
        const adapter = AdapterRegistry.getAdapter();
        const conversation = await adapter.extractConversation();

        if (conversation.totalTablesCount === 0) {
          this.showToast('⚠️ No tables found in this conversation.');
          return;
        }

        const result = CSVExporter.exportTables(conversation);
        const filename = sanitizeFilename(`${conversation.title}-tables`, 'csv');
        downloadBlob(result.csvContent, filename, 'text/csv');
        this.showToast(`✅ Exported ${result.count} tables to CSV!`);
      } catch (err) {
        console.error('PromptDoc CSV export error:', err);
        this.showToast('❌ CSV extraction failed.');
      }
    });
  }
}
