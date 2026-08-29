/**
 * Universal AI Exporter - Extension Popup Controller
 * Manages UI tabs, Smart Scope selection, export actions, live platform detection, and offline Pro key activation.
 */

import { ConversationData, ExportScopeMode, ExtractedMessage, PDFTheme } from '../core/types';
import { LicenseManager } from '../core/licensing/license-manager';
import { MarkdownExporter } from '../core/exporters/markdown-exporter';
import { PDFExporter } from '../core/exporters/pdf-exporter';
import { CSVExporter } from '../core/exporters/csv-exporter';
import { downloadBlob, sanitizeFilename } from '../core/utils/download-helper';

let activeConversation: ConversationData | null = null;
let currentScopeMode: ExportScopeMode = 'all';
let selectedCustomTurnIds: Set<string> = new Set();

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
  setupMarkdownOptions();
  setupPdfOptions();
  setupScopeControls();
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
      const lastError = chrome.runtime.lastError;
      if (lastError || !response || !response.success) {
        updatePlatformStatus('⚠️ Refresh Required', 'Reload this chat tab to connect.', false, true);

        document.getElementById('btn-header-reload')?.addEventListener('click', () => {
          if (tab.id) {
            chrome.tabs.reload(tab.id);
            window.close();
          }
        });

        const listEl = document.getElementById('turns-list');
        if (listEl) {
          listEl.innerHTML = `
            <div class="turns-empty">
              <p style="margin-bottom: 6px; font-weight: 600;">⚠️ Tab disconnected from extension</p>
              <p style="font-size: 10px; color: var(--text-secondary); margin-bottom: 8px;">Chat was open before extension reloaded.</p>
              <button class="btn-micro" id="btn-reload-active-tab" style="padding: 4px 12px; font-size: 11px;">🔄 Reload Tab Now</button>
            </div>
          `;
          document.getElementById('btn-reload-active-tab')?.addEventListener('click', () => {
            if (tab.id) {
              chrome.tabs.reload(tab.id);
              window.close();
            }
          });
        }
        return;
      }

      activeConversation = response.conversation;
      if (activeConversation) {
        onConversationLoaded(activeConversation);
      }
    });
  } catch (err) {
    console.error('Universal AI Exporter: Popup initialization error', err);
    updatePlatformStatus('Ready', 'Click export button to capture conversation.', true);
  }
}

function onConversationLoaded(conv: ConversationData): void {
  const msgCount = conv.messages.length;
  const tableCount = conv.totalTablesCount;

  let details = `${msgCount} Messages`;
  if (tableCount > 0) details += ` • ${tableCount} Table${tableCount > 1 ? 's' : ''}`;

  const platformDisplayNames: Record<string, string> = {
    gemini: 'GOOGLE GEMINI',
    chatgpt: 'CHATGPT',
    claude: 'CLAUDE',
    deepseek: 'DEEPSEEK',
    perplexity: 'PERPLEXITY'
  };

  const platformTitle = platformDisplayNames[conv.platform] || conv.platform.toUpperCase();

  updatePlatformStatus(
    platformTitle,
    details,
    true,
    false
  );

  // Update scope all count badge
  const allCountEl = document.getElementById('scope-count-all');
  if (allCountEl) {
    allCountEl.textContent = String(msgCount);
  }

  // Pre-select all custom turns
  selectedCustomTurnIds = new Set(conv.messages.map(m => m.id));
  renderCustomTurnsList(conv);
  updateScopeUI();
}

function updatePlatformStatus(title: string, details: string, isActive: boolean, showReload = false): void {
  const nameEl = document.getElementById('platform-name');
  const statsEl = document.getElementById('platform-stats');
  const indicatorEl = document.getElementById('status-indicator');
  const reloadBtn = document.getElementById('btn-header-reload');

  if (nameEl) nameEl.textContent = title;
  if (statsEl) statsEl.textContent = details;
  if (indicatorEl) {
    indicatorEl.className = `status-indicator ${isActive ? 'active' : 'inactive'}`;
  }
  if (reloadBtn) {
    reloadBtn.style.display = showReload ? 'inline-flex' : 'none';
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

/**
 * Sets up collapsible Markdown options drawer
 */
function setupMarkdownOptions(): void {
  const toggleBtn = document.getElementById('btn-toggle-md-opts');
  const drawer = document.getElementById('md-options-drawer');

  toggleBtn?.addEventListener('click', () => {
    const isOpen = drawer?.classList.toggle('active');
    toggleBtn.classList.toggle('open', isOpen);
  });
}

/**
 * Sets up collapsible PDF options drawer
 */
function setupPdfOptions(): void {
  const toggleBtn = document.getElementById('btn-toggle-pdf-opts');
  const drawer = document.getElementById('pdf-options-drawer');

  toggleBtn?.addEventListener('click', () => {
    const isOpen = drawer?.classList.toggle('active');
    toggleBtn.classList.toggle('open', isOpen);
  });
}

/**
 * Sets up Smart Scope controls and custom turn checklist drawer
 */
function setupScopeControls(): void {
  const pills = document.querySelectorAll('.scope-pill');
  const drawer = document.getElementById('custom-turns-drawer');
  const selectAllBtn = document.getElementById('btn-scope-select-all');
  const clearAllBtn = document.getElementById('btn-scope-clear-all');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const scope = pill.getAttribute('data-scope') as ExportScopeMode;
      if (!scope) return;

      currentScopeMode = scope;

      pills.forEach(p => p.classList.remove('active', 'open'));
      pill.classList.add('active');

      if (scope === 'custom') {
        drawer?.classList.add('active');
        pill.classList.add('open');
      } else {
        drawer?.classList.remove('active');
      }

      updateScopeUI();
    });
  });

  selectAllBtn?.addEventListener('click', () => {
    if (!activeConversation) return;
    selectedCustomTurnIds = new Set(activeConversation.messages.map(m => m.id));
    const checkboxes = document.querySelectorAll<HTMLInputElement>('.turn-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = true;
      cb.closest('.turn-item')?.classList.add('selected');
    });
    updateScopeUI();
  });

  clearAllBtn?.addEventListener('click', () => {
    selectedCustomTurnIds.clear();
    const checkboxes = document.querySelectorAll<HTMLInputElement>('.turn-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = false;
      cb.closest('.turn-item')?.classList.remove('selected');
    });
    updateScopeUI();
  });
}

/**
 * Renders turn list in the custom drawer
 */
function renderCustomTurnsList(conv: ConversationData): void {
  const listEl = document.getElementById('turns-list');
  if (!listEl) return;

  if (conv.messages.length === 0) {
    listEl.innerHTML = '<div class="turns-empty">No message turns found.</div>';
    return;
  }

  listEl.innerHTML = '';

  conv.messages.forEach((msg, idx) => {
    const isSelected = selectedCustomTurnIds.has(msg.id);
    const item = document.createElement('div');
    item.className = `turn-item ${isSelected ? 'selected' : ''}`;
    item.setAttribute('data-msg-id', msg.id);

    // Clean snippet text
    let snippet = msg.contentText.trim();
    if (!snippet && msg.codeBlocks.length > 0) {
      snippet = `[Code: ${msg.codeBlocks[0].language || 'Snippet'}]`;
    } else if (!snippet && msg.artifacts && msg.artifacts.length > 0) {
      snippet = `[Artifact: ${msg.artifacts[0].title}]`;
    }
    if (snippet.length > 55) {
      snippet = snippet.slice(0, 55) + '...';
    }

    const isUser = msg.role === 'user';
    const roleLabel = isUser ? 'You' : (conv.platform === 'claude' ? 'Claude' : conv.platform === 'deepseek' ? 'DeepSeek' : 'AI');

    item.innerHTML = `
      <input type="checkbox" class="turn-checkbox" id="chk-turn-${idx}" ${isSelected ? 'checked' : ''}>
      <div class="turn-body">
        <div class="turn-meta">
          <span class="turn-badge ${isUser ? 'user' : 'assistant'}">${roleLabel}</span>
          <span class="turn-number">Turn #${idx + 1}</span>
        </div>
        <div class="turn-snippet">${snippet || 'Empty turn'}</div>
      </div>
    `;

    const checkbox = item.querySelector<HTMLInputElement>('.turn-checkbox');
    
    // Toggle on item or checkbox click
    item.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        if (checkbox) checkbox.checked = !checkbox.checked;
      }
      if (checkbox?.checked) {
        selectedCustomTurnIds.add(msg.id);
        item.classList.add('selected');
      } else {
        selectedCustomTurnIds.delete(msg.id);
        item.classList.remove('selected');
      }
      updateScopeUI();
    });

    listEl.appendChild(item);
  });
}

/**
 * Returns a cloned ConversationData object filtered by current active scope
 */
function getScopedConversation(conv: ConversationData): ConversationData {
  let filteredMessages: ExtractedMessage[] = [];

  if (currentScopeMode === 'all') {
    filteredMessages = [...conv.messages];
  } else if (currentScopeMode === 'latest') {
    if (conv.messages.length <= 2) {
      filteredMessages = [...conv.messages];
    } else {
      const lastMsg = conv.messages[conv.messages.length - 1];
      if (lastMsg.role === 'assistant') {
        const prevMsg = conv.messages[conv.messages.length - 2];
        filteredMessages = prevMsg.role === 'user' ? [prevMsg, lastMsg] : [lastMsg];
      } else {
        filteredMessages = [lastMsg];
      }
    }
  } else if (currentScopeMode === 'last3') {
    filteredMessages = conv.messages.slice(-3);
  } else if (currentScopeMode === 'custom') {
    filteredMessages = conv.messages.filter(m => selectedCustomTurnIds.has(m.id));
  }

  const totalTablesCount = filteredMessages.reduce((acc, m) => acc + (m.tables?.length || 0), 0);

  return {
    ...conv,
    messages: filteredMessages,
    totalTablesCount
  };
}

/**
 * Updates UI labels and button texts based on active scope
 */
function updateScopeUI(): void {
  if (!activeConversation) return;

  const scoped = getScopedConversation(activeConversation);
  const scopedCount = scoped.messages.length;
  const totalCount = activeConversation.messages.length;

  // Scope summary header
  const summaryEl = document.getElementById('scope-summary');
  if (summaryEl) {
    if (currentScopeMode === 'all') {
      summaryEl.textContent = `Full Chat (${scopedCount})`;
    } else if (currentScopeMode === 'latest') {
      summaryEl.textContent = `Latest (${scopedCount} turn${scopedCount === 1 ? '' : 's'})`;
    } else if (currentScopeMode === 'last3') {
      summaryEl.textContent = `Last 3 (${scopedCount} turn${scopedCount === 1 ? '' : 's'})`;
    } else {
      summaryEl.textContent = `Custom (${scopedCount} of ${totalCount})`;
    }
  }

  // Custom drawer stats
  const customStatsEl = document.getElementById('custom-turns-stats');
  if (customStatsEl) {
    customStatsEl.textContent = `${selectedCustomTurnIds.size} of ${totalCount} selected`;
  }

  // Table count label in CSV tab
  const tableCountLabel = document.getElementById('table-count-label');
  if (tableCountLabel) {
    tableCountLabel.textContent = `${scoped.totalTablesCount} Table${scoped.totalTablesCount === 1 ? '' : 's'} in Scope`;
  }

  // Export button labels
  const btnPdf = document.querySelector('#btn-export-pdf span');
  if (btnPdf) {
    btnPdf.textContent = currentScopeMode === 'all'
      ? 'Export Styled PDF'
      : `Export PDF (${scopedCount} turn${scopedCount === 1 ? '' : 's'})`;
  }

  const btnMd = document.querySelector('#btn-export-md span');
  if (btnMd) {
    btnMd.textContent = currentScopeMode === 'all'
      ? 'Download'
      : `Download (${scopedCount})`;
  }

  const btnCopyMd = document.querySelector('#btn-copy-md span');
  if (btnCopyMd) {
    btnCopyMd.textContent = currentScopeMode === 'all'
      ? 'Copy'
      : `Copy (${scopedCount})`;
  }

  const btnCsv = document.querySelector('#btn-export-csv span');
  if (btnCsv) {
    btnCsv.textContent = scoped.totalTablesCount > 0
      ? `Export ${scoped.totalTablesCount} Table${scoped.totalTablesCount === 1 ? '' : 's'} to CSV`
      : 'Export Tables to CSV';
  }
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
    if (keyInput) {
      keyInput.value = '';
      keyInput.focus();
    }
    if (feedback) {
      feedback.textContent = '';
      feedback.className = 'license-feedback';
    }
  });

  closeBtn?.addEventListener('click', () => {
    modal?.classList.remove('active');
  });

  // Close modal with Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) {
      modal.classList.remove('active');
    }
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

async function withLoading(btn: HTMLElement | null, fn: () => Promise<void>): Promise<void> {
  if (!btn || btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  try {
    await fn();
  } finally {
    btn.classList.remove('loading');
  }
}

async function getOrFetchConversation(): Promise<ConversationData | null> {
  if (activeConversation && activeConversation.messages.length > 0) {
    return activeConversation;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return null;

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id!, { action: 'GET_CONVERSATION' }, (res) => {
      const lastError = chrome.runtime.lastError;
      if (lastError || !res || !res.success || !res.conversation) {
        resolve(null);
        return;
      }
      activeConversation = res.conversation;
      onConversationLoaded(res.conversation);
      resolve(res.conversation);
    });
  });
}

function setupExportButtons(): void {
  // Export PDF
  const btnPdf = document.getElementById('btn-export-pdf');
  btnPdf?.addEventListener('click', () => {
    withLoading(btnPdf, async () => {
      const rawConv = await getOrFetchConversation();
      if (!rawConv || rawConv.messages.length === 0) {
        showToast('⚠️ Please reload chat tab to connect.');
        return;
      }

      const conv = getScopedConversation(rawConv);
      if (conv.messages.length === 0) {
        showToast('⚠️ No messages selected in current scope.');
        return;
      }

      showToast('Preparing PDF document...');

      const themeRadio = document.querySelector('input[name="pdf-theme"]:checked') as HTMLInputElement;
      const selectedTheme = (themeRadio?.value || 'executive') as PDFTheme;

      const includeReasoning = (document.getElementById('opt-pdf-reasoning') as HTMLInputElement)?.checked ?? true;
      const includeCitations = (document.getElementById('opt-pdf-citations') as HTMLInputElement)?.checked ?? true;
      const includeArtifacts = (document.getElementById('opt-pdf-artifacts') as HTMLInputElement)?.checked ?? true;
      const includeImages = (document.getElementById('opt-pdf-images') as HTMLInputElement)?.checked ?? true;

      try {
        const blob = await PDFExporter.exportToPDF(conv, selectedTheme, {
          format: 'pdf',
          pdfTheme: selectedTheme,
          includeReasoning,
          includeCitations,
          includeArtifacts,
          includeImages
        });

        const filename = sanitizeFilename(conv.title, 'pdf');
        downloadBlob(blob, filename, 'application/pdf');
        showToast('✅ PDF exported successfully!');
      } catch (e) {
        console.error('PDF export failed:', e);
        showToast('❌ PDF export failed.');
      }
    });
  });

  // Export Markdown
  const btnMd = document.getElementById('btn-export-md');
  btnMd?.addEventListener('click', () => {
    withLoading(btnMd, async () => {
      const rawConv = await getOrFetchConversation();
      if (!rawConv || rawConv.messages.length === 0) {
        showToast('⚠️ Please reload chat tab to connect.');
        return;
      }

      const conv = getScopedConversation(rawConv);
      if (conv.messages.length === 0) {
        showToast('⚠️ No messages selected in current scope.');
        return;
      }

      showToast('Generating Markdown...');

      const includeFrontmatter = (document.getElementById('opt-md-frontmatter') as HTMLInputElement)?.checked ?? false;
      const includeReasoning = (document.getElementById('opt-md-reasoning') as HTMLInputElement)?.checked ?? true;
      const includeCitations = (document.getElementById('opt-md-citations') as HTMLInputElement)?.checked ?? true;
      const includeImages = (document.getElementById('opt-md-images') as HTMLInputElement)?.checked ?? true;

      const exporter = new MarkdownExporter();
      const markdown = exporter.exportToMarkdown(conv, {
        format: 'markdown',
        includeFrontmatter,
        includeReasoning,
        includeCitations,
        includeImages
      });

      const filename = sanitizeFilename(conv.title, 'md');
      downloadBlob(markdown, filename, 'text/markdown');
      showToast('✅ Markdown saved!');
    });
  });

  // Copy Markdown to Clipboard
  const btnCopyMd = document.getElementById('btn-copy-md');
  btnCopyMd?.addEventListener('click', () => {
    withLoading(btnCopyMd, async () => {
      const rawConv = await getOrFetchConversation();
      if (!rawConv || rawConv.messages.length === 0) {
        showToast('⚠️ Please reload chat tab to connect.');
        return;
      }

      const conv = getScopedConversation(rawConv);
      if (conv.messages.length === 0) {
        showToast('⚠️ No messages selected in current scope.');
        return;
      }

      const includeFrontmatter = (document.getElementById('opt-md-frontmatter') as HTMLInputElement)?.checked ?? false;
      const includeReasoning = (document.getElementById('opt-md-reasoning') as HTMLInputElement)?.checked ?? true;
      const includeCitations = (document.getElementById('opt-md-citations') as HTMLInputElement)?.checked ?? true;
      const includeImages = (document.getElementById('opt-md-images') as HTMLInputElement)?.checked ?? true;

      const exporter = new MarkdownExporter();
      const markdown = exporter.exportToMarkdown(conv, {
        format: 'markdown',
        includeFrontmatter,
        includeReasoning,
        includeCitations,
        includeImages
      });

      await navigator.clipboard.writeText(markdown);
      showToast('📋 Copied Markdown to clipboard!');
    });
  });

  // Export CSV
  const btnCsv = document.getElementById('btn-export-csv');
  btnCsv?.addEventListener('click', () => {
    withLoading(btnCsv, async () => {
      const rawConv = await getOrFetchConversation();
      if (!rawConv || rawConv.totalTablesCount === 0) {
        showToast('⚠️ No tables found in this conversation.');
        return;
      }

      const conv = getScopedConversation(rawConv);
      if (conv.totalTablesCount === 0) {
        showToast('⚠️ No tables found in the selected scope.');
        return;
      }

      showToast('Extracting tables...');

      const result = CSVExporter.exportTables(conv);
      const filename = sanitizeFilename(`${conv.title}-tables`, 'csv');
      downloadBlob(result.csvContent, filename, 'text/csv');
      showToast(`✅ Exported ${result.count} table(s) to CSV!`);
    });
  });
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  initPopup();
});

