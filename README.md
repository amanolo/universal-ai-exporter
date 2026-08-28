# Universal AI Exporter (`PromptDoc`)

> A lightweight, **100% private, client-side browser extension** (Manifest V3) that exports conversations, code blocks, reasoning traces, and citations from **ChatGPT, Claude, Perplexity, DeepSeek, and Google Gemini** into beautifully styled PDFs, Obsidian-ready Markdown, and CSV tables.

---

## 🔒 100% Client-Side Privacy Guarantee

- **0 Outbound Network Calls**: No servers, no external analytics, no telemetry.
- **100% Local RAM Processing**: PDF rendering (`jsPDF`), Markdown transformation (`turndown`), and offline cryptographic license validation (`Web Crypto Ed25519`) execute directly inside the browser.
- **Enterprise & GDPR Safe**: Conversations never leave your local machine.

---

## 🚀 Key Features

| Feature | ChatGPT | Claude | Perplexity | DeepSeek | Gemini |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Multi-Turn Chat Capture** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Fenced Code Blocks & Highlighting** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **LaTeX Math Formulas (`$...$`)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Claude Artifacts Isolation** | — | ✅ | — | — | — |
| **Academic Bibliography & Citations** | — | — | ✅ | — | — |
| **DeepSeek `<think>` Reasoning Traces** | — | — | — | ✅ | — |
| **HTML Table Extractor to CSV** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **3 PDF Themes (Executive, Midnight, Academic)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Obsidian/Notion YAML Frontmatter** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🛠️ Project Structure

```
Universal AI Exporter/
├── src/
│   ├── manifest.chromium.json   # Chrome, Edge, Brave, Opera MV3 manifest
│   ├── manifest.firefox.json    # Firefox AMO MV3 manifest with gecko settings
│   ├── background/
│   │   └── service-worker.ts    # Background coordinator
│   ├── content/
│   │   ├── content.ts           # Content script entry & message router
│   │   ├── floating-toolbar.ts  # Injected glassmorphic floating action bar
│   │   └── floating-toolbar.css # Modern styling with zero page collisions
│   ├── popup/
│   │   ├── popup.html           # Minimalist extension popup
│   │   ├── popup.ts             # Popup controller & platform detector
│   │   └── popup.css            # Dark/Light theme styles
│   └── core/
│       ├── types.ts             # Core data interfaces
│       ├── licensing/           # Ed25519 offline asymmetric license verification
│       ├── adapters/            # 5 platform adapters + semantic fallback
│       └── exporters/           # PDF, Markdown, and CSV engines
├── dist/
│   ├── chromium/                # Unpacked build for Edge, Chrome, Brave
│   └── firefox/                 # Unpacked build for Firefox
├── releases/                    # Production .zip archives for stores
├── scripts/
│   ├── build.js                 # Multi-target bundle compiler
│   ├── package.js               # Auto-zip release packaging script
│   ├── generate-icons.js        # High-res PNG icon asset generator
│   ├── generate-license.js      # CLI Ed25519 Pro license keygen
│   └── test-license.js          # Automated crypto verification test
├── docs/
│   └── STORE_LISTING.md         # Store metadata, SEO keywords & reviewer notes
├── CHROMEWEBSTORE.md            # Chrome Web Store submission specification
├── package.json
└── tsconfig.json
```

---

## 📦 How to Test & Load Locally

### 1. Build the Extension
```bash
npm install
npm run build
```

### 2. Load in Microsoft Edge / Google Chrome / Brave
1. Open your browser and navigate to:
   - Edge: `edge://extensions`
   - Chrome / Brave: `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right or sidebar).
3. Click **Load unpacked**.
4. Select the directory:
   ```
   /Users/antonismanolioudakis/Documents/Universal AI Exporter/dist/chromium
   ```
5. Navigate to `https://chatgpt.com`, `https://claude.ai`, `https://www.perplexity.ai`, `https://chat.deepseek.com`, or `https://gemini.google.com`.
6. Use the floating action pill in the bottom-right corner or click the extension icon in the toolbar!

### 3. Load in Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the file:
   ```
   /Users/antonismanolioudakis/Documents/Universal AI Exporter/dist/firefox/manifest.json
   ```

---

## 🔑 Offline Pro License Key Generation

To generate valid offline Pro license keys for testing or distribution:

```bash
# Generate a lifetime Pro license for any email
node scripts/generate-license.js user@example.com pro lifetime
```

The script will output a signed token (e.g. `PDOC-PRO.eyJlbWFpb...`). Paste this token into the popup's **"Activate Pro License"** modal to instantly unlock Pro features in memory (verified locally in `<1ms` with Web Crypto).

---

## 🚢 Packaging for Store Submission

To build and package all ready-to-upload store archives:

```bash
npm run package
```

This generates:
- `universal-ai-exporter-edge-v1.0.0.zip` (for Microsoft Edge Add-ons)
- `universal-ai-exporter-firefox-v1.0.0.zip` (for Mozilla Firefox AMO)
- `universal-ai-exporter-chrome-v1.0.0.zip` (for Chrome Web Store / Brave)
