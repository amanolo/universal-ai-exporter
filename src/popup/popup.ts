/**
 * Universal AI Exporter - Extension Popup Controller
 * Manages UI tabs, export actions, live platform detection, and offline Pro key activation.
 */

import { ConversationData, ExportOptions, PDFTheme } from '../core/types';
import { LicenseManager } from '../core/licensing/license-manager';
import { MarkdownExporter } from '../core/exporters/markdown-exporter';
import { PDFExporter } from '../core/exporters/pdf-exporter';
import { CSVExporter } from '../core/exporters/csv-exporter';
import { downloadBlob, sanitizeFilename } from '../core/utils/download-helper';

let activeConversation: ConversationData | null = null;

function showToast(message: string, durationMs = 3000): void {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('active');
  setTimeout(() => {
    toast.classList.remove('active');
  }, durationMs);
}

/**
 * Initializes the popup UI and reads active tab state
 */
async function initPopup(): Promise<void> {
  await updateLicenseBadge();
  setupTabs();
  setupModal();
  setupExportButtons();

  // Query active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      updatePlatformStatus('No Active Tab', 'Open ChatGPT, Claude, Perplexity, DeepSeek, or Gemini.', false);
      return;
    }

    const url = tab.url || '';
    const isSupported = /chatgpt\.com|chat\.openai\.com|claude\.ai|perplexity\.ai|deepseek\.com|gemini\.google\.com/i.test(url);

    if (!isSupported) {
      updatePlatformStatus('Unsupported Page', 'Navigate to ChatGPT, Claude, Perplexity, DeepSeek, or Gemini.', false);
      return;
    }

    // Send extraction message to content script
    chrome.tabs.sendMessage(tab.id, { action: 'GET_CONVERSATION' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        updatePlatformStatus('Ready to Export', 'Click an export option below to scan page.', true);
        return;
      }

      activeConversation = response.conversation;
      if (activeConversation) {
        const msgCount = activeConversation.messages.length;
        const tableCount = activeConversation.totalTablesCount;
        const hasReasoning = activeConversation.messages.some(m => !!m.reasoning);

        let details = `${msgCount} Messages`;
        if (tableCount > 0) details += ` • ${tableCount} Tables`;
        if (hasReasoning) details += ` • Reasoning Trace`;

        updatePlatformStatus(
          `${activeConversation.platform.toUpperCase()} (${activeConversation.model || 'Detected'})`,
          details,
          true
        );

        // Update CSV count
        const tableCountLabel = document.getElementById('table-count-label');
        if (tableCountLabel) {
          tableCountLabel.textContent = `${tableCount} Table${tableCount === 1 ? '' : 's'} Detected`;
        }
      }
    });
  } catch (err) {
    console.error('Universal AI Exporter: Popup initialization error', err);
    updatePlatformStatus('Ready', 'Click export button to capture conversation.', true);
  }
}

function updatePlatformStatus(title: string, details: string, isActive: boolean): void {
  const nameEl = document.getElementById('platform-name');
  const statsEl = document.getElementById('platform-stats');
  const indicatorEl = document.getElementById('status-indicator');

  if (nameEl) nameEl.textContent = title;
  if (statsEl) statsEl.textContent = details;
  if (indicatorEl) {
    indicatorEl.className = `status-indicator ${isActive ? 'active' : 'inactive'}`;
  }
}

async function updateLicenseBadge(): Promise<void> {
  const status = await LicenseManager.getStatus();
  const badge = document.getElementById('pro-badge');
  const banner = document.getElementById('license-banner');

  if (badge) {
    if (status.isPro) {
      badge.textContent = '⭐ PRO LIFETIME';
      badge.className = 'badge badge-pro';
    } else {
      badge.textContent = 'FREE TIER';
      badge.className = 'badge badge-free';
    }
  }

  if (banner) {
    if (status.isPro) {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'flex';
    }
  }
}

function setupTabs(): void {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(`tab-${tabId}`);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Radio button theme selection visual state
  const themeCards = document.querySelectorAll('.theme-card');
  themeCards.forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    radio?.addEventListener('change', () => {
      themeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });
}

function setupModal(): void {
  const modal = document.getElementById('license-modal');
  const openBtn = document.getElementById('btn-open-license');
  const closeBtn = document.getElementById('btn-close-modal');
  const submitBtn = document.getElementById('btn-submit-key');
  const keyInput = document.getElementById('license-key-input') as HTMLInputElement;
  const feedback = document.getElementById('license-feedback');

  openBtn?.addEventListener('click', () => {
    modal?.classList.add('active');
    if (keyInput) keyInput.value = '';
    if (feedback) {
      feedback.textContent = '';
      feedback.className = 'license-feedback';
    }
  });

  closeBtn?.addEventListener('click', () => {
    modal?.classList.remove('active');
  });

  submitBtn?.addEventListener('click', async () => {
    const key = keyInput?.value.trim() || '';
    if (!key) {
      if (feedback) {
        feedback.textContent = 'Please paste your license key.';
        feedback.className = 'license-feedback error';
      }
      return;
    }

    if (feedback) {
      feedback.textContent = 'Verifying signature locally...';
      feedback.className = 'license-feedback';
    }

    const result = await LicenseManager.activateKey(key);
    if (result.success) {
      if (feedback) {
        feedback.textContent = `✅ ${result.message}`;
        feedback.className = 'license-feedback success';
      }
      await updateLicenseBadge();
      showToast('🎉 Pro Lifetime Activated!');
      setTimeout(() => {
        modal?.classList.remove('active');
      }, 1500);
    } else {
      if (feedback) {
        feedback.textContent = `❌ ${result.message}`;
        feedback.className = 'license-feedback error';
      }
    }
  });
}

async function getOrFetchConversation(): Promise<ConversationData | null> {
  if (activeConversation && activeConversation.messages.length > 0) {
    return activeConversation;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return null;

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id!, { action: 'GET_CONVERSATION' }, (res) => {
      if (res && res.success && res.conversation) {
        activeConversation = res.conversation;
        resolve(res.conversation);
      } else {
        resolve(null);
      }
    });
  });
}

function setupExportButtons(): void {
  // Export PDF
  document.getElementById('btn-export-pdf')?.addEventListener('click', async () => {
    showToast('Preparing PDF document...');
    const conv = await getOrFetchConversation();
    if (!conv || conv.messages.length === 0) {
      showToast('⚠️ No messages found on active page.');
      return;
    }

    const themeRadio = document.querySelector('input[name="pdf-theme"]:checked') as HTMLInputElement;
    const selectedTheme = (themeRadio?.value || 'executive') as PDFTheme;

    const includeReasoning = (document.getElementById('opt-pdf-reasoning') as HTMLInputElement)?.checked ?? true;
    const includeCitations = (document.getElementById('opt-pdf-citations') as HTMLInputElement)?.checked ?? true;
    const includeArtifacts = (document.getElementById('opt-pdf-artifacts') as HTMLInputElement)?.checked ?? true;

    try {
      const blob = await PDFExporter.exportToPDF(conv, selectedTheme, {
        format: 'pdf',
        pdfTheme: selectedTheme,
        includeReasoning,
        includeCitations,
        includeArtifacts
      });

      const filename = sanitizeFilename(conv.title, 'pdf');
      downloadBlob(blob, filename, 'application/pdf');
      showToast('✅ PDF exported successfully!');
    } catch (e) {
      console.error('PDF export failed:', e);
      showToast('❌ PDF export failed.');
    }
  });

  // Export Markdown
  document.getElementById('btn-export-md')?.addEventListener('click', async () => {
    showToast('Generating Markdown...');
    const conv = await getOrFetchConversation();
    if (!conv || conv.messages.length === 0) {
      showToast('⚠️ No messages found on active page.');
      return;
    }

    const includeFrontmatter = (document.getElementById('opt-md-frontmatter') as HTMLInputElement)?.checked ?? true;
    const includeReasoning = (document.getElementById('opt-md-reasoning') as HTMLInputElement)?.checked ?? true;
    const includeCitations = (document.getElementById('opt-md-citations') as HTMLInputElement)?.checked ?? true;

    const exporter = new MarkdownExporter();
    const markdown = exporter.exportToMarkdown(conv, {
      format: 'markdown',
      includeFrontmatter,
      includeReasoning,
      includeCitations
    });

    const filename = sanitizeFilename(conv.title, 'md');
    downloadBlob(markdown, filename, 'text/markdown');
    showToast('✅ Markdown saved!');
  });

  // Copy Markdown to Clipboard
  document.getElementById('btn-copy-md')?.addEventListener('click', async () => {
    const conv = await getOrFetchConversation();
    if (!conv || conv.messages.length === 0) {
      showToast('⚠️ No messages found on active page.');
      return;
    }

    const exporter = new MarkdownExporter();
    const markdown = exporter.exportToMarkdown(conv, { format: 'markdown', includeFrontmatter: true });

    await navigator.clipboard.writeText(markdown);
    showToast('📋 Copied Markdown to clipboard!');
  });

  // Export CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', async () => {
    showToast('Extracting tables...');
    const conv = await getOrFetchConversation();
    if (!conv || conv.totalTablesCount === 0) {
      showToast('⚠️ No tables found in this conversation.');
      return;
    }

    const result = CSVExporter.exportTables(conv);
    const filename = sanitizeFilename(`${conv.title}-tables`, 'csv');
    downloadBlob(result.csvContent, filename, 'text/csv');
    showToast(`✅ Exported ${result.count} table(s) to CSV!`);
  });
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  initPopup();
});
