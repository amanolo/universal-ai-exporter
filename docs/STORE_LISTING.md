# Universal AI Exporter - Store Listing Kit

Official store listing metadata, optimized search keywords, copy variations, and reviewer verification notes for **Microsoft Edge Add-ons**, **Mozilla Firefox AMO**, **Google Chrome Web Store**, and **Brave**.

---

## 1. Store Metadata

| Field | Content |
| :--- | :--- |
| **Extension Title** | Universal AI Exporter — ChatGPT, Claude, DeepSeek to PDF & Markdown |
| **Version** | `1.0.1` |
| **Category** | Productivity / Developer Tools |
| **YouTube Video Demo** | `https://www.youtube.com/watch?v=U2rA7z9JdP0` |
| **Short Description** (132 chars max) | Export ChatGPT, Claude, Perplexity, DeepSeek & Gemini chats to Obsidian Markdown, styled PDFs & CSVs. 100% private & offline. |

---

## 2. Store Listing Copy (Detailed Description)

```markdown
Export ChatGPT, Claude, Perplexity, DeepSeek, and Google Gemini chats to Markdown, styled PDFs, and CSV tables with 100% local privacy and zero servers.

**100% Local & Private (Zero-Server Architecture)**
Unlike other extensions that upload your chat transcripts to third-party cloud servers, Universal AI Exporter operates entirely inside your browser’s RAM:
- 0 Outbound network calls
- 0 Analytics or tracking pixels
- 0 Cloud storage or server dependencies
- 100% GDPR, HIPAA, and Enterprise safe

**Supported AI Platforms & Features**
- **ChatGPT (chatgpt.com):** Multi-turn threads, code blocks, and LaTeX math.
- **Claude (claude.ai):** Clean formatting and Claude Artifact extraction (Code, HTML, SVG).
- **Perplexity AI (perplexity.ai):** Academic bibliographies, source citations, and footnotes.
- **DeepSeek (deepseek.com):** Extracts reasoning traces into collapsible callouts.
- **Google Gemini (gemini.google.com):** Structured chats, markdown tables, and code.

**3 Export Engines**
- **Executive & Academic PDF:** 3 themes (Executive Light, Midnight Dark, Academic Paper) with clean page-break protection and running headers.
- **Obsidian & Notion Markdown:** Structured YAML frontmatter, syntax-highlighted code blocks, and 1-click clipboard copy.
- **CSV Table Extractor:** 1-Click extraction of tables with Excel UTF-8 BOM encoding.
```

---

### 🚀 SUPPORTED PLATFORMS & UNIQUE FEATURES

1. 🟢 ChatGPT (chatgpt.com)
• Captures multi-turn chats, formatted code blocks with syntax highlighting.
• Preserves LaTeX math equations ($...$ and $$...$$).

2. 🟣 Claude (claude.ai)
• Isolates Claude Artifacts (Code, HTML, SVG, React components) into dedicated files and export sections.
• Formats multi-turn developer prompts cleanly.

3. 🔵 Perplexity AI (perplexity.ai)
• Automatically parses web sources and generates an Academic Bibliography and Citation List.
• Formats inline reference footnotes with original source URLs.

4. ⚪ DeepSeek (deepseek.com)
• Detects and extracts the <think> reasoning process.
• Formats reasoning traces into Obsidian collapsible callouts (> [!note]- Reasoning) alongside the final response.

5. 🔴 Google Gemini (gemini.google.com)
• Exports structured multi-modal chats, markdown tables, and formatted source code.

---

### 📦 3 POWERFUL EXPORT ENGINES

📄 1. Executive & Academic PDF Engine
• 3 Beautiful Themes: Executive Light (Clean Modern), Midnight Dark (OLED High-Contrast), and Academic Paper (Formal Serif).
• Page Numbering (Page X of Y) and running headers with date, model, and source.
• CSS print page-break protection: Never slices code blocks or tables across page breaks.

📝 2. Obsidian & Notion Markdown Engine
• Automatically injects structured YAML Frontmatter (Title, Platform, Model, Date, Tags).
• Preserves fenced code blocks with language tags (` ```typescript `).
• 1-Click "Copy to Clipboard" for instant pasting into your knowledge base.

📊 3. CSV & Data Table Extractor
• Automatically detects all HTML tables in your conversation.
• One-click export to RFC 4180 CSV with Excel UTF-8 BOM encoding.

---

### ⚡ FAST & INTUITIVE WORKFLOW
• Fast 1-Click Exports: Click the extension icon in your browser toolbar to instantly export to PDF, Markdown, or CSV.
• Instant Formatting: Frontmatter toggles, theme selectors, and table extractors built right in.
```

---

## 3. In-Store Keyword Search Tags

### Microsoft Edge Add-ons
`chatgpt export`, `claude to pdf`, `deepseek markdown`, `perplexity citation`, `chatgpt to obsidian`, `ai exporter`, `export chatgpt`, `gemini pdf`, `save chatgpt conversation`

### Mozilla Firefox AMO
`chatgpt`, `claude`, `deepseek`, `markdown`, `pdf export`, `obsidian`, `privacy`, `academic citations`, `latex math`, `table extractor`

### Google Chrome Web Store
`ChatGPT export to PDF`, `Claude Markdown export`, `DeepSeek reasoning export`, `Perplexity bibliography`, `ChatGPT to Obsidian`, `AI chat backup`

---

## 4. Reviewer Instructions & Permission Justifications

### Notes for Store Reviewers:
> **Reviewer Instructions:**
> Universal AI Exporter is a 100% client-side document generator for AI chat websites (ChatGPT, Claude, Perplexity, DeepSeek, Google Gemini).
> 
> **How to test:**
> 1. Open any active chat on `https://chatgpt.com`, `https://claude.ai`, `https://www.perplexity.ai`, `https://chat.deepseek.com`, or `https://gemini.google.com`.
> 2. Click the extension toolbar icon.
> 3. Click "Print / Save to PDF", "Download .md", or "Export CSV Tables" to generate a formatted document.
> 
> **Build from Source:**
> 1. Repository: `https://github.com/amanolo/universal-ai-exporter`
> 2. Commands: `npm install && npm run build` (compiled outputs to `dist/firefox` and `dist/chromium`).
> 
> **Privacy Architecture:**
> All document rendering (via bundled jsPDF, Turndown, and Web Crypto) happens strictly in local memory. The extension makes zero remote API requests, contains 0 telemetry, and transmits zero user data.
>
> **Monetization & Supporter Checkout:**
> Optional one-time supporter lifetime license ($9.99) is processed via Lemon Squeezy Merchant of Record:
> `https://universalaiexporter.lemonsqueezy.com/checkout/buy/a18a3c4c-5820-4816-b49c-f9e3d8eca1be?logo=0&discount=0`
> Supports offline key activation in `<1ms` via Web Crypto API with 0 server dependencies.

### Permissions Justification:
- `storage`: Required to save user export preferences (e.g. selected PDF theme) and offline license activation state locally in browser storage.
- `activeTab`: Required to detect the active conversation and initiate document extraction upon user click.
- `tabs`: Required to read tab URL to automatically select the matching platform adapter (ChatGPT vs Claude vs Perplexity vs DeepSeek vs Gemini).
- `host_permissions` (`chatgpt.com`, `claude.ai`, `perplexity.ai`, `deepseek.com`, `gemini.google.com`): Restricted strictly to the 5 supported AI web platforms to allow content scripts to parse conversation turns.
