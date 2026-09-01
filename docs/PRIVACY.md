# Privacy Policy — Universal AI Exporter

**Effective Date:** August 28, 2026  
**Last Updated:** September 1, 2026

Universal AI Exporter is built from the ground up with a strict **zero-data-collection, client-side privacy architecture**. We believe your private AI conversations, research prompts, code snippets, and thinking traces should remain entirely under your personal control.

---

## 1. Zero Remote Data Collection & Zero Telemetry
* **0 Outbound Network Requests:** Universal AI Exporter does not transmit any conversation text, prompts, code blocks, metadata, or browser details to external servers.
* **0 Analytics or Tracking:** We do not use Google Analytics, Mixpanel, Sentry, tracking pixels, or any third-party telemetry tools.
* **0 Remote Code Execution:** All rendering and parsing engines (`jsPDF`, `turndown`, cryptographic verifiers) are 100% bundled locally within the extension package.

---

## 2. How Your Data is Processed
* **Local In-Memory (RAM) Processing:** When you click to export a conversation, DOM parsing, Markdown generation, PDF rendering, and CSV table extraction happen strictly within your local browser's volatile memory.
* **No Cloud Storage:** We do not store, index, or cache your chats on any remote server or database. Once you download your document or close the tab, the in-memory data is cleared.

---

## 3. Local Browser Storage (`chrome.storage.local`)
The extension uses the browser's local storage API exclusively to persist your local user preferences:
* Your chosen PDF visual theme (Executive Light, Midnight Dark, or Academic Paper).
* Your export option toggles (e.g. YAML Frontmatter, reasoning callouts, citation links).
* Your local export counter (used to track local milestone counts).
* Your activated offline Supporter License Key (if activated).

This data never leaves your personal device.

---

## 4. Payment & License Information
Optional Lifetime Supporter Licenses are processed securely by **Lemon Squeezy**, acting as our Merchant of Record. 
* Payment information (such as credit card numbers or billing addresses) is handled directly and securely by Lemon Squeezy and is never seen, processed, or stored by the Universal AI Exporter extension.
* License key verification is performed **100% offline** on your device using the browser's native Web Crypto API (Ed25519 asymmetric cryptography) with zero server validation requests.

---

## 5. Contact
If you have any questions about this Privacy Policy or the security of Universal AI Exporter, please open an issue on GitHub:
* **Repository:** [https://github.com/amanolo/universal-ai-exporter](https://github.com/amanolo/universal-ai-exporter)
