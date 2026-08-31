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
  await restorePreferences();
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

  // Contextual Long Thread Notice: If on ChatGPT and first turn is assistant (top prompt unrendered above viewport)
  const isVirtualThread = conv.platform === 'chatgpt' && conv.messages.length > 0 && conv.messages[0].role === 'assistant';
  const noticeEl = document.getElementById('long-thread-notice');
  if (noticeEl) {
    noticeEl.style.display = isVirtualThread ? 'flex' : 'none';
  }
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

function switchTab(tabId: string): void {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  const matchingBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const matchingContent = document.getElementById(`tab-${tabId}`);
  if (!matchingBtn || !matchingContent) return;

  tabButtons.forEach(b => b.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));

  matchingBtn.classList.add('active');
  matchingContent.classList.add('active');
}

function setupTabs(): void {
  const tabButtons = document.querySelectorAll('.tab-btn');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (!tabId) return;
      switchTab(tabId);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ uaie_active_tab: tabId });
      }
    });
  });

  // Radio button theme selection visual state + storage persistence
  const themeCards = document.querySelectorAll('.theme-card');
  themeCards.forEach(card => {
    const radio = card.querySelector<HTMLInputElement>('input[type="radio"]');
    radio?.addEventListener('change', () => {
      themeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ uaie_pdf_theme: radio.value });
      }
    });
  });
}

/**
 * Sets up collapsible Markdown options drawer and persists toggles
 */
function setupMarkdownOptions(): void {
  const toggleBtn = document.getElementById('btn-toggle-md-opts');
  const drawer = document.getElementById('md-options-drawer');

  toggleBtn?.addEventListener('click', () => {
    const isOpen = drawer?.classList.toggle('active');
    toggleBtn.classList.toggle('open', isOpen);
  });

  const mdOptionIds = [
    { id: 'opt-md-frontmatter', key: 'uaie_opt_md_frontmatter' },
    { id: 'opt-md-reasoning', key: 'uaie_opt_md_reasoning' },
    { id: 'opt-md-citations', key: 'uaie_opt_md_citations' },
    { id: 'opt-md-images', key: 'uaie_opt_md_images' }
  ];

  mdOptionIds.forEach(({ id, key }) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.addEventListener('change', () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: el.checked });
      }
    });
  });

  const resetBtn = document.getElementById('btn-reset-md-opts');
  resetBtn?.addEventListener('click', () => {
    const defaults: Record<string, { id: string; val: boolean }> = {
      uaie_opt_md_frontmatter: { id: 'opt-md-frontmatter', val: false },
      uaie_opt_md_reasoning: { id: 'opt-md-reasoning', val: true },
      uaie_opt_md_citations: { id: 'opt-md-citations', val: true },
      uaie_opt_md_images: { id: 'opt-md-images', val: true }
    };

    const storagePayload: Record<string, boolean> = {};
    Object.entries(defaults).forEach(([key, { id, val }]) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.checked = val;
      storagePayload[key] = val;
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(storagePayload);
    }
    showToast('↺ Restored Markdown defaults');
  });
}

/**
 * Sets up collapsible PDF options drawer and persists toggles
 */
function setupPdfOptions(): void {
  const toggleBtn = document.getElementById('btn-toggle-pdf-opts');
  const drawer = document.getElementById('pdf-options-drawer');

  toggleBtn?.addEventListener('click', () => {
    const isOpen = drawer?.classList.toggle('active');
    toggleBtn.classList.toggle('open', isOpen);
  });

  const pdfOptionIds = [
    { id: 'opt-pdf-reasoning', key: 'uaie_opt_pdf_reasoning' },
    { id: 'opt-pdf-citations', key: 'uaie_opt_pdf_citations' },
    { id: 'opt-pdf-artifacts', key: 'uaie_opt_pdf_artifacts' },
    { id: 'opt-pdf-images', key: 'uaie_opt_pdf_images' }
  ];

  pdfOptionIds.forEach(({ id, key }) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.addEventListener('change', () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: el.checked });
      }
    });
  });

  const resetBtn = document.getElementById('btn-reset-pdf-opts');
  resetBtn?.addEventListener('click', () => {
    const defaults: Record<string, { id: string; val: boolean }> = {
      uaie_opt_pdf_reasoning: { id: 'opt-pdf-reasoning', val: true },
      uaie_opt_pdf_citations: { id: 'opt-pdf-citations', val: true },
      uaie_opt_pdf_artifacts: { id: 'opt-pdf-artifacts', val: true },
      uaie_opt_pdf_images: { id: 'opt-pdf-images', val: true }
    };

    const storagePayload: Record<string, boolean> = {};
    Object.entries(defaults).forEach(([key, { id, val }]) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.checked = val;
      storagePayload[key] = val;
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(storagePayload);
    }
    showToast('↺ Restored PDF defaults');
  });
}

/**
 * Restores the user's previously selected tab, theme, and option toggles
 */
async function restorePreferences(): Promise<void> {
  let targetTab = 'markdown';
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const data = await chrome.storage.local.get([
        'uaie_active_tab',
        'uaie_pdf_theme',
        'uaie_opt_md_frontmatter',
        'uaie_opt_md_reasoning',
        'uaie_opt_md_citations',
        'uaie_opt_md_images',
        'uaie_opt_pdf_reasoning',
        'uaie_opt_pdf_citations',
        'uaie_opt_pdf_artifacts',
        'uaie_opt_pdf_images'
      ]);

      // 1. Target active tab
      if (data && data.uaie_active_tab) {
        targetTab = data.uaie_active_tab;
      }

      // 2. Restore PDF theme
      if (data && data.uaie_pdf_theme) {
        const radio = document.querySelector<HTMLInputElement>(`input[name="pdf-theme"][value="${data.uaie_pdf_theme}"]`);
        if (radio) {
          radio.checked = true;
          const themeCards = document.querySelectorAll('.theme-card');
          themeCards.forEach(c => c.classList.remove('active'));
          radio.closest('.theme-card')?.classList.add('active');
        }
      }

      // 3. Restore checkbox options
      const checkboxes: { key: string; id: string }[] = [
        { key: 'uaie_opt_md_frontmatter', id: 'opt-md-frontmatter' },
        { key: 'uaie_opt_md_reasoning', id: 'opt-md-reasoning' },
        { key: 'uaie_opt_md_citations', id: 'opt-md-citations' },
        { key: 'uaie_opt_md_images', id: 'opt-md-images' },
        { key: 'uaie_opt_pdf_reasoning', id: 'opt-pdf-reasoning' },
        { key: 'uaie_opt_pdf_citations', id: 'opt-pdf-citations' },
        { key: 'uaie_opt_pdf_artifacts', id: 'opt-pdf-artifacts' },
        { key: 'uaie_opt_pdf_images', id: 'opt-pdf-images' }
      ];

      checkboxes.forEach(({ key, id }) => {
        if (data && typeof data[key] === 'boolean') {
          const el = document.getElementById(id) as HTMLInputElement | null;
          if (el) el.checked = data[key];
        }
      });
    } catch (e) {
      console.error('Error restoring preferences:', e);
    }
  }

  // Activate selected tab without any layout shift
  switchTab(targetTab);
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

  // Populate Table Dropdown Selector in CSV tab when multiple tables exist
  const selectGroup = document.getElementById('csv-select-group');
  const tableSelect = document.getElementById('csv-table-select') as HTMLSelectElement | null;
  if (selectGroup && tableSelect) {
    if (scoped.totalTablesCount > 1) {
      selectGroup.style.display = 'flex';
      const allScopedTables: { preview: string; rows: number }[] = [];
      scoped.messages.forEach(msg => {
        if (msg.tables && msg.tables.length > 0) {
          msg.tables.forEach(t => {
            const firstRow = t[0] || [];
            const preview = firstRow.slice(0, 3).join(', ').slice(0, 26);
            allScopedTables.push({
              preview: preview || 'Table',
              rows: t.length
            });
          });
        }
      });

      const savedVal = tableSelect.value;
      tableSelect.innerHTML = `<option value="-1">All Tables in Scope (${allScopedTables.length} Tables)</option>` +
        allScopedTables.map((t, idx) => `<option value="${idx}">Table ${idx + 1}: ${t.preview} (${t.rows} rows)</option>`).join('');

      if (savedVal && parseInt(savedVal, 10) < allScopedTables.length) {
        tableSelect.value = savedVal;
      }
    } else {
      selectGroup.style.display = 'none';
      tableSelect.innerHTML = `<option value="-1">All Tables in Scope</option>`;
    }
  }

  // Export button labels
  const btnPdf = document.querySelector('#btn-export-pdf span');
  if (btnPdf) {
    btnPdf.textContent = currentScopeMode === 'all'
      ? '🖨️ Print / Save to PDF'
      : `🖨️ Print PDF (${scopedCount} turn${scopedCount === 1 ? '' : 's'})`;
  }

  const btnMd = document.querySelector('#btn-export-md span');
  if (btnMd) {
    btnMd.textContent = currentScopeMode === 'all'
      ? 'Download .md'
      : `Download .md (${scopedCount})`;
  }

  const btnCopyRich = document.querySelector('#btn-copy-rich span');
  if (btnCopyRich) {
    btnCopyRich.textContent = currentScopeMode === 'all'
      ? '📋 Copy Rich'
      : `📋 Copy Rich (${scopedCount})`;
  }

  const btnCopyMd = document.querySelector('#btn-copy-md span');
  if (btnCopyMd) {
    btnCopyMd.textContent = currentScopeMode === 'all'
      ? '📝 Copy MD'
      : `📝 Copy MD (${scopedCount})`;
  }

  const btnCsv = document.querySelector('#btn-export-csv span');
  if (btnCsv) {
    const selectedIdx = tableSelect ? parseInt(tableSelect.value, 10) : -1;
    if (scoped.totalTablesCount === 0) {
      btnCsv.textContent = 'Export Tables to CSV';
    } else if (selectedIdx >= 0) {
      btnCsv.textContent = `Export Table ${selectedIdx + 1} to CSV`;
    } else {
      btnCsv.textContent = `Export ${scoped.totalTablesCount} Table${scoped.totalTablesCount === 1 ? '' : 's'} to CSV`;
    }
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return activeConversation;

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id!, { action: 'GET_CONVERSATION' }, (res) => {
      const lastError = chrome.runtime.lastError;
      if (lastError || !res || !res.success || !res.conversation) {
        resolve(activeConversation);
        return;
      }
      activeConversation = res.conversation;
      onConversationLoaded(res.conversation);
      resolve(res.conversation);
    });
  });
}

async function cropImageFromScreenshot(screenshotUrl: string, rect: { x: number; y: number; width: number; height: number; dpr: number }): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const dpr = rect.dpr || 1;
        const cropX = Math.round(rect.x * dpr);
        const cropY = Math.round(rect.y * dpr);
        const cropW = Math.round(rect.width * dpr);
        const cropH = Math.round(rect.height * dpr);

        if (cropW <= 0 || cropH <= 0 || cropX < 0 || cropY < 0 || cropX + cropW > img.width || cropY + cropH > img.height) {
          resolve('');
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
          return;
        }
      } catch {}
      resolve('');
    };
    img.onerror = () => resolve('');
    img.src = screenshotUrl;
  });
}

async function enrichConversationWithScreenshots(conv: ConversationData): Promise<ConversationData> {
  const hasImagesToCapture = conv.messages.some(m => m.images && m.images.length > 0);
  if (!hasImagesToCapture) return conv;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.windowId) return conv;

    const countResult = await new Promise<number>((resolve) => {
      chrome.tabs.sendMessage(tab.id!, { action: 'PREPARE_IMAGE_CAPTURE' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.success || typeof res.count !== 'number') {
          resolve(0);
        } else {
          resolve(res.count);
        }
      });
    });

    if (countResult === 0) return conv;

    const capturedImages: { url: string; base64: string }[] = [];

    for (let index = 0; index < countResult; index++) {
      const stepResult = await new Promise<{ success: boolean; url: string; rect: { x: number; y: number; width: number; height: number; dpr: number } }>((resolve) => {
        chrome.tabs.sendMessage(tab.id!, { action: 'FOCUS_IMAGE_AT_INDEX', index }, (res) => {
          if (chrome.runtime.lastError || !res || !res.success || !res.rect) {
            resolve({ success: false, url: '', rect: { x: 0, y: 0, width: 0, height: 0, dpr: 1 } });
          } else {
            resolve(res);
          }
        });
      });

      if (stepResult.success && stepResult.rect && stepResult.rect.width > 15 && stepResult.rect.height > 15) {
        const screenshotUrl = await new Promise<string>((resolve) => {
          chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
              resolve('');
            } else {
              resolve(dataUrl);
            }
          });
        });

        if (screenshotUrl) {
          const croppedBase64 = await cropImageFromScreenshot(screenshotUrl, stepResult.rect);
          if (croppedBase64 && croppedBase64.startsWith('data:image')) {
            capturedImages.push({
              url: stepResult.url,
              base64: croppedBase64
            });
          }
        }
      }
    }

    if (capturedImages.length === 0) return conv;

    let captureIndex = 0;
    const enrichedMessages = conv.messages.map((msg) => {
      if (!msg.images || msg.images.length === 0) return msg;

      const newImages = [...msg.images];
      let newContentHtml = msg.contentHtml;

      for (let i = 0; i < newImages.length; i++) {
        if (captureIndex < capturedImages.length) {
          const cap = capturedImages[captureIndex++];
          const oldUrl = newImages[i];
          newImages[i] = cap.base64;
          if (newContentHtml && oldUrl) {
            newContentHtml = newContentHtml.split(oldUrl).join(cap.base64);
          }
        }
      }

      return {
        ...msg,
        images: newImages,
        contentHtml: newContentHtml
      };
    });

    return {
      ...conv,
      messages: enrichedMessages
    };
  } catch (e) {
    console.error('Enrich conversation failed:', e);
    return conv;
  }
}

function setupExportButtons(): void {
  // Print / Save to PDF
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

      showToast('🖨️ Opening print view...');

      const themeRadio = document.querySelector('input[name="pdf-theme"]:checked') as HTMLInputElement;
      const selectedTheme = (themeRadio?.value || 'executive') as PDFTheme;

      const includeReasoning = (document.getElementById('opt-pdf-reasoning') as HTMLInputElement)?.checked ?? true;
      const includeCitations = (document.getElementById('opt-pdf-citations') as HTMLInputElement)?.checked ?? true;
      const includeArtifacts = (document.getElementById('opt-pdf-artifacts') as HTMLInputElement)?.checked ?? true;
      const includeImages = (document.getElementById('opt-pdf-images') as HTMLInputElement)?.checked ?? true;

      try {
        const convForPdf = JSON.parse(JSON.stringify(conv));
        const finalConv = await enrichConversationWithScreenshots(convForPdf);
        await PDFExporter.printDocument(finalConv, selectedTheme, {
          format: 'pdf',
          pdfTheme: selectedTheme,
          includeReasoning,
          includeCitations,
          includeArtifacts,
          includeImages
        });
        showToast('✅ Print view opened!');
      } catch (e) {
        console.error('Print view failed:', e);
        showToast('❌ Failed to open print view.');
      }
    });
  });

  // Copy Rich Text to Clipboard (for Google Docs, MS Word, Outlook, Slack)
  const btnCopyRich = document.getElementById('btn-copy-rich');
  btnCopyRich?.addEventListener('click', () => {
    withLoading(btnCopyRich, async () => {
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

      showToast('Preparing formatted clipboard...');

      const includeFrontmatter = (document.getElementById('opt-md-frontmatter') as HTMLInputElement)?.checked ?? false;
      const includeReasoning = (document.getElementById('opt-md-reasoning') as HTMLInputElement)?.checked ?? true;
      const includeCitations = (document.getElementById('opt-md-citations') as HTMLInputElement)?.checked ?? true;
      const includeImages = (document.getElementById('opt-md-images') as HTMLInputElement)?.checked ?? true;

      const themeRadio = document.querySelector('input[name="pdf-theme"]:checked') as HTMLInputElement;
      const selectedTheme = (themeRadio?.value || 'executive') as PDFTheme;

      try {
        const convForExport = JSON.parse(JSON.stringify(conv));
        const finalConv = await enrichConversationWithScreenshots(convForExport);

        const htmlContent = PDFExporter.generateRichClipboardHtml(finalConv, {
          format: 'pdf',
          includeReasoning,
          includeCitations,
          includeArtifacts: true,
          includeImages
        });

        const exporter = new MarkdownExporter();
        const markdownContent = exporter.exportToMarkdown(finalConv, {
          format: 'markdown',
          includeFrontmatter,
          includeReasoning,
          includeCitations,
          includeImages
        });

        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([markdownContent], { type: 'text/plain' });

        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          })
        ]);

        showToast('📋 Copied Rich Text (ready for Docs/Word)!');
      } catch (e) {
        console.error('Rich copy failed:', e);
        showToast('❌ Failed to copy rich text.');
      }
    });
  });

  // Export Markdown (.md file download)
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

  // Copy Plain Markdown to Clipboard (for Obsidian, Notion, GitHub)
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
      showToast('📝 Copied Markdown (for Obsidian)!');
    });
  });

  // Table selection change in CSV tab
  const tableSelect = document.getElementById('csv-table-select') as HTMLSelectElement | null;
  tableSelect?.addEventListener('change', () => {
    if (!activeConversation) return;
    const scoped = getScopedConversation(activeConversation);
    const btnCsvSpan = document.querySelector('#btn-export-csv span');
    if (!btnCsvSpan) return;
    const selectedIdx = parseInt(tableSelect.value, 10);
    if (selectedIdx >= 0) {
      btnCsvSpan.textContent = `Export Table ${selectedIdx + 1} to CSV`;
    } else {
      btnCsvSpan.textContent = `Export ${scoped.totalTablesCount} Table${scoped.totalTablesCount === 1 ? '' : 's'} to CSV`;
    }
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

      showToast('Extracting table(s)...');

      const selectedIdx = tableSelect ? parseInt(tableSelect.value, 10) : -1;
      const result = selectedIdx >= 0
        ? CSVExporter.exportTables(conv, selectedIdx)
        : CSVExporter.exportTables(conv);

      const filenameSuffix = selectedIdx >= 0 ? `-table-${selectedIdx + 1}` : '-tables';
      const filename = sanitizeFilename(`${conv.title}${filenameSuffix}`, 'csv');
      downloadBlob(result.csvContent, filename, 'text/csv');
      showToast(`✅ Exported ${result.count} table(s) to CSV!`);
    });
  });
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  initPopup();
});

