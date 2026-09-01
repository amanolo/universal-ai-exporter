# Universal AI Exporter

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
│   │   └── content.ts           # Content script entry & message router
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

## 🛠️ Build Instructions & Environment (For Mozilla Reviewers)

- **Operating System**: Platform independent (macOS, Ubuntu Linux 22.04/24.04 LTS, Windows 10/11)
- **Runtime Environment**: Node.js `>= 20.0.0` (LTS), npm `>= 10.0.0`
- **Build Steps**:
  1. `npm install` (Installs open-source build dependencies from `package-lock.json`)
  2. `npm run build` (Compiles TypeScript and bundles local assets via `scripts/build.js` using `esbuild`)
- **Output**: The compiled, unminified add-on code is output to `dist/firefox/`, matching the submitted package 1:1.
- **Automated Tests**: Run `npm test` and `npm run test:license` to run the 35-test verification suite.

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
6. Click the **Universal AI Exporter** icon in your browser toolbar to export!

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

The script will output a signed token (e.g. `UAIE-PRO.eyJlbWFpb...`). Paste this token into the popup's **"Activate Pro License"** modal to activate Lifetime Supporter status and permanently dismiss community milestone reminders (verified locally in `<1ms` with Web Crypto).

---

## 📜 Legal, Policies & Store Compliance

- **[Privacy Policy](docs/PRIVACY.md)**: 100% client-side operation, 0 outbound network requests, 0 telemetry.
- **[Terms of Service](docs/TERMS.md)**: Community freeware license and Lifetime Supporter terms.
- **[Refund Policy](docs/REFUND.md)**: Voluntary supporter contribution and non-refundable digital license policy.

---

## 🚢 Packaging for Store Submission

To build and package all ready-to-upload store archives:

```bash
npm run package
```

This generates:
- `universal-ai-exporter-edge-v1.0.1.zip` (for Microsoft Edge Add-ons)
- `universal-ai-exporter-firefox-v1.0.1.zip` (for Mozilla Firefox AMO)
- `universal-ai-exporter-chrome-v1.0.1.zip` (for Chrome Web Store / Brave)
