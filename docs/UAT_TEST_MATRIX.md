# Universal AI Exporter — UAT Test Matrix

| ID | Feature Area | Platform | Test Prompt / Precondition | Test Action | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **UAT-01-A** | **AI Generated Images (DALL-E)** | ChatGPT | *"Generate a futuristic cyberpunk skyline"* | Export to **Markdown** & **PDF** | • **MD**: 1 clean image link.<br>• **PDF**: Renders image in responsive card. | [ ] |
| **UAT-01-B** | **AI Generated Images (Imagen)** | Gemini | *"Generate a sunshine image"* | Export to **Markdown** & **PDF** | • **MD**: Clean text.<br>• **PDF**: Renders Imagen generation from Google CDN. | [ ] |
| **UAT-01-C** | **AI Generated Visuals (Widgets)** | Claude | *"Create a sunshine pic plz"* | Export to **Markdown** & **PDF** | • Visual web app on `artifacts.claude.ai` (cross-domain iframe pixel restriction). | [ ] |
| **UAT-02-A** | **User Image Uploads** | ChatGPT | Upload photo: *"What is in this picture?"* | Export to **Markdown** & **PDF** | • User photo extracted and rendered in **You (User Prompt)** card. | [ ] |
| **UAT-02-B** | **User Image Uploads** | Gemini | Upload photo: *"What is in this picture?"* | Export to **Markdown** & **PDF** | • User photo extracted and rendered in **You (User Prompt)** card. | [ ] |
| **UAT-02-C** | **User Image Uploads** | Claude | Upload photo: *"What is in this picture?"* | Export to **Markdown** & **PDF** | • User photo extracted and rendered in **You (User Prompt)** card. | [ ] |
| **UAT-03** | **Visual-Only Message Turns** | Gemini | Prompt generating image without text | Export to **Markdown** | • Image turn is not discarded as an empty turn. | [ ] |
| **UAT-04-A** | **Checklist Normalization** | ChatGPT | 5-step checklist with checkboxes | Export to **Markdown** → Obsidian/Notion | • Formatted as standard GFM task lists: `- [ ] Step 1`, `- [x] Step 2`. | [ ] |
| **UAT-04-B** | **Checklist Normalization** | Claude | 5-step checklist with checkboxes | Export to **Markdown** → Obsidian/Notion | • Formatted as standard GFM task lists: `- [ ] Step 1`, `- [x] Step 2`. | [ ] |
| **UAT-04-C** | **Checklist Normalization** | Gemini | 5-step checklist with checkboxes | Export to **Markdown** → Obsidian/Notion | • Formatted as standard GFM task lists: `- [ ] Step 1`, `- [x] Step 2`. | [ ] |
| **UAT-05-A** | **URL Underscore Sanitization** | Perplexity | Wikipedia link with underscores (e.g. *Deep_learning*) | Export to **Markdown** | • URLs keep underscores intact without `\_`. | [ ] |
| **UAT-05-B** | **URL Underscore Sanitization** | ChatGPT | Wikipedia link with underscores (e.g. *Deep_learning*) | Export to **Markdown** | • URLs keep underscores intact without `\_`. | [ ] |
| **UAT-05-C** | **URL Underscore Sanitization** | Gemini | Wikipedia link with underscores (e.g. *Deep_learning*) | Export to **Markdown** | • URLs keep underscores intact without `\_`. | [ ] |
| **UAT-05-D** | **URL Underscore Sanitization** | Claude | Wikipedia link with underscores (e.g. *Deep_learning*) | Export to **Markdown** | • URLs keep underscores intact without `\_`. | [ ] |
| **UAT-06-A** | **Reasoning Traces (o3-mini)** | ChatGPT | Logic/math problem | Export to **Markdown** & **PDF** | • **MD**: Folded in callout `> [!note]- 🧠 Reasoning Process`.<br>• **PDF**: Tinted reasoning block. | [ ] |
| **UAT-06-B** | **Reasoning Traces (3.7 Sonnet)** | Claude | Logic/math problem with thinking | Export to **Markdown** & **PDF** | • **MD**: Folded in callout `> [!note]- 🧠 Reasoning Process`.<br>• **PDF**: Tinted reasoning block. | [ ] |
| **UAT-06-C** | **Reasoning Traces (<think>)** | DeepSeek | Logic/math problem | Export to **Markdown** & **PDF** | • **MD**: Folded in callout `> [!note]- 🧠 Reasoning Process`.<br>• **PDF**: Tinted reasoning block. | [ ] |
| **UAT-07** | **Claude Isolated Artifacts** | Claude | *"Write a React button component in a code artifact"* | Export to **Markdown** & **PDF** | • Code cleanly isolated under `📦 Claude Artifacts`. | [ ] |
| **UAT-08** | **Web Citations & Bibliography** | Perplexity | Research question with web sources | Export to **Markdown** | • Inline citation numbers `[1]`, `[2]`.<br>• Full `📑 Comprehensive Bibliography` at bottom. | [ ] |
| **UAT-09-A** | **Tables & CSV Multi-Table Export** | ChatGPT | *"Compare PostgreSQL vs SQLite in a table"* | CSV Tab → Export All / Selected Table | • RFC 4180 CSV with UTF-8 BOM (`\uFEFF`) for Excel. | [ ] |
| **UAT-09-B** | **Tables & CSV Multi-Table Export** | Claude | *"Compare PostgreSQL vs SQLite in a table"* | CSV Tab → Export All / Selected Table | • RFC 4180 CSV with UTF-8 BOM (`\uFEFF`) for Excel. | [ ] |
| **UAT-09-C** | **Tables & CSV Multi-Table Export** | Gemini | *"Compare PostgreSQL vs SQLite in a table"* | CSV Tab → Export All / Selected Table | • RFC 4180 CSV with UTF-8 BOM (`\uFEFF`) for Excel. | [ ] |
| **UAT-09-D** | **Tables & CSV Multi-Table Export** | DeepSeek | *"Compare PostgreSQL vs SQLite in a table"* | CSV Tab → Export All / Selected Table | • RFC 4180 CSV with UTF-8 BOM (`\uFEFF`) for Excel. | [ ] |
| **UAT-09-E** | **Tables & CSV Multi-Table Export** | Perplexity | *"Compare PostgreSQL vs SQLite in a table"* | CSV Tab → Export All / Selected Table | • RFC 4180 CSV with UTF-8 BOM (`\uFEFF`) for Excel. | [ ] |
| **UAT-10-A** | **PDF Theming (Executive / Midnight / Academic)** | ChatGPT | Any conversation | Switch themes in PDF Options drawer | • **Executive**: Light theme.<br>• **Midnight**: Dark slate theme.<br>• **Academic**: Serif paper theme. | [ ] |
| **UAT-10-B** | **PDF Theming (Executive / Midnight / Academic)** | Claude | Any conversation | Switch themes in PDF Options drawer | • **Executive**: Light theme.<br>• **Midnight**: Dark slate theme.<br>• **Academic**: Serif paper theme. | [ ] |
| **UAT-10-C** | **PDF Theming (Executive / Midnight / Academic)** | Gemini | Any conversation | Switch themes in PDF Options drawer | • **Executive**: Light theme.<br>• **Midnight**: Dark slate theme.<br>• **Academic**: Serif paper theme. | [ ] |
| **UAT-11-A** | **Multi-Page PDF Page-Break Snapping** | ChatGPT | Long conversation (10+ turns) | Export to **PDF** | • Message cards avoid being sliced across page breaks. | [ ] |
| **UAT-11-B** | **Multi-Page PDF Page-Break Snapping** | Claude | Long conversation (10+ turns) | Export to **PDF** | • Message cards avoid being sliced across page breaks. | [ ] |
| **UAT-11-C** | **Multi-Page PDF Page-Break Snapping** | Gemini | Long conversation (10+ turns) | Export to **PDF** | • Message cards avoid being sliced across page breaks. | [ ] |
| **UAT-12** | **Popup Option Persistence** | Extension UI | Any tab | Toggle option OFF → Close popup → Reopen | • Toggles remember state via `chrome.storage.local`. | [ ] |
| **UAT-13** | **Image Filter Toggle** | Extension UI | Conversation with images | Toggle "Include Images" OFF → Export | • MD and PDF omit all images when toggled OFF. | [ ] |
| **UAT-14** | **Offline PRO License Key Activation** | Extension UI | Any tab | Paste test key in License tab | • Instantly activates PRO status offline with 0 network calls. | [ ] |
| **UAT-15** | **Keyboard Accessibility** | Extension UI | Any tab | Open popup → Press <kbd>Escape</kbd> | • Popup or drawers dismiss cleanly. | [ ] |
