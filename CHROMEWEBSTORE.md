# Chrome Web Store & Store Listing Document

> Single source of truth for all store metadata, permissions justifications, privacy disclosures, and submission assets for **Universal AI Exporter**.

---

## Extension Metadata

- **Name**: Universal AI Exporter
- **Version**: 1.0.1
- **Summary / Short Description**: Export ChatGPT, Claude, Perplexity, DeepSeek & Gemini chats to Obsidian Markdown, styled PDFs & CSVs. 100% private & offline.
- **Primary Category**: Productivity
- **Secondary Category**: Developer Tools
- **Default Language**: English

---

## Permissions Justification

| Permission / Host | Justification for Review Team |
| :--- | :--- |
| `storage` | Used exclusively to persist local export preferences (such as selected PDF theme and frontmatter toggles) and offline license key state in `chrome.storage.local`. No data is ever transmitted. |
| `activeTab` | Used to initiate client-side DOM parsing on the currently active chat tab when the user clicks the extension action button. |
| `tabs` | Used to detect the active tab's URL to automatically activate the matching platform adapter (ChatGPT, Claude, Perplexity, DeepSeek, or Gemini). |
| `https://chatgpt.com/*`<br>`https://chat.openai.com/*` | Required to inject the content script that reads chat turns, formatted code blocks, and KaTeX math formulas on ChatGPT. |
| `https://claude.ai/*` | Required to inject the content script that extracts Claude conversations and isolates Claude Artifacts (code, HTML, SVG). |
| `https://www.perplexity.ai/*`<br>`https://perplexity.ai/*` | Required to inject the content script that extracts research answers and parses web source cards into academic citations. |
| `https://*.deepseek.com/*` | Required to inject the content script that extracts chat turns and separates DeepSeek `<think>` reasoning traces. |
| `https://gemini.google.com/*` | Required to inject the content script that parses Gemini responses, data tables, and formatted source code. |

---

## Privacy & Data Use Disclosure

- **Does this extension collect user data?** No.
- **Does this extension transmit user data to external servers?** No. Zero outbound network requests are made.
- **Does this extension use remote code or analytics?** No. All libraries (`jspdf`, `turndown`) and verification code are bundled 100% locally.
- **Data handling:** All conversation extraction, PDF rendering, Markdown formatting, and cryptographic Ed25519 verification happen directly within the user's browser memory (RAM).

---

## Version History

### Version 1.0.1 (2026-08-31)
- Live Lemon Squeezy Merchant of Record checkout integration ($9.99 Lifetime License).
- Dual key offline verification: supports Ed25519 cryptographic tokens and Lemon Squeezy order UUIDs with 0 remote network calls.
- Non-blocking 15-export supporter milestone notification with 2.5s clipboard debounce.
- Mozilla Firefox AMO built-in data consent compliance (`data_collection_permissions: { required: ["none"] }`).
- Refactored popup and print renderers for DOM safety and 0 linter warnings.

### Version 1.0.0 (2026-08-28)
- Initial release for Microsoft Edge Add-ons, Mozilla Firefox AMO, Google Chrome Web Store, and Brave.
- 5 Dedicated Platform Adapters (ChatGPT, Claude, Perplexity, DeepSeek, Google Gemini) + Generic Semantic Tree-Walker fallback.
- Executive Light, Midnight Dark, and Academic Paper PDF themes with running headers and page-break protection.
- Obsidian & Notion Markdown engine with YAML Frontmatter and Callouts.
- 1-Click CSV table extractor with Excel UTF-8 BOM encoding.
- Smart Scope selective export (Full Chat, Latest Deliverable, Last 3 Turns, Custom).
- 100% Offline Ed25519 asymmetric cryptographic license verification.
