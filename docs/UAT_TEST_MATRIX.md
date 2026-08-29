# Universal AI Exporter — Granular UAT Test Matrix

| ID | Platform | Feature Area | Test Prompt / Precondition | Test Action | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **UAT-01-A-MD** | **ChatGPT** | AI Generated Images (DALL-E) | Generate a futuristic cyberpunk skyline | Export to **Markdown** | Image appears as a clean markdown link without duplicate links or button text. | [x] |
| **UAT-01-A-PDF** | **ChatGPT** | AI Generated Images (DALL-E) | Generate a futuristic cyberpunk skyline | Export to **PDF** | Generated image renders in high resolution inside a response card without buttons. | [x] |
| **UAT-02-A-MD** | **ChatGPT** | User Image Uploads | Upload photo: What is in this picture? | Export to **Markdown** | Uploaded photo link is included in the "You" prompt section right above the answer. | [x] |
| **UAT-02-A-PDF** | **ChatGPT** | User Image Uploads | Upload photo: What is in this picture? | Export to **PDF** | Uploaded photo renders cleanly inside the "You" prompt card. | [x] |
| **UAT-04-A** | **ChatGPT** | Checklists & To-Do Lists | 5-step checklist with checkboxes | Export to **Markdown** | Formats as interactive checkboxes (`- [ ]` and `- [x]`) for Obsidian and Notion. | [x] |
| **UAT-05-B** | **ChatGPT** | Links with Underscores | Wikipedia link with underscores (e.g. *Deep_learning*) | Export to **Markdown** | Website links remain clickable without broken backslashes; text italics still format normally. | [x] |
| **UAT-06-A-MD** | **ChatGPT** | Reasoning Traces (o3-mini) | Logic or math problem with o3-mini | Export to **Markdown** | Thought process is tucked into a collapsible `> [!note]- 🧠 Reasoning Process` box. | [ ] |
| **UAT-06-A-PDF** | **ChatGPT** | Reasoning Traces (o3-mini) | Logic or math problem with o3-mini | Export to **PDF** | Thought process appears inside a tinted "Reasoning Process" callout block. | [ ] |
| **UAT-09-A-ALL** | **ChatGPT** | Tables to CSV (All Tables) | Compare PostgreSQL vs SQLite in a table | CSV Tab → **Export All Tables** | Exports a multi-table spreadsheet with headers that opens directly in Excel. | [x] |
| **UAT-09-A-SEL** | **ChatGPT** | Tables to CSV (Selected Table) | Compare PostgreSQL vs SQLite in a table | CSV Tab → **Export Selected Table** | Exports only the selected table as a single CSV file. | [x] |
| **UAT-10-A-EXEC** | **ChatGPT** | PDF Executive Theme | Any conversation | PDF Options → **Executive** → Export PDF | Clean, modern light layout with subtle card borders. | [x] |
| **UAT-10-A-MID** | **ChatGPT** | PDF Midnight Theme | Any conversation | PDF Options → **Midnight** → Export PDF | Dark slate OLED background with high-contrast text. | [x] |
| **UAT-10-A-ACAD** | **ChatGPT** | PDF Academic Theme | Any conversation | PDF Options → **Academic** → Export PDF | Formal book-style serif typography and clean dividers. | [x] |
| **UAT-11-A** | **ChatGPT** | Multi-Page PDF Layout | Long conversation (10+ turns) | Export to **PDF** | Long messages, code boxes, and tables stay intact without getting sliced across page edges. | [x] |
| | | | | | | |
| **UAT-01-C-MD** | **Claude** | AI Generated Visuals (Widgets) | Create a sunshine pic plz | Export to **Markdown** | Captures graphic/illustration without showing tool command text (`visualize show_widget`). | [ ] |
| **UAT-01-C-PDF** | **Claude** | AI Generated Visuals (Widgets) | Create a sunshine pic plz | Export to **PDF** | Visual graphic renders in the PDF card without internal tool clutter. | [ ] |
| **UAT-02-C-MD** | **Claude** | User Image Uploads | Upload photo: What is in this picture? | Export to **Markdown** | Uploaded photo is preserved cleanly; screen-reader clutter ("Claude responded:") is removed. | [ ] |
| **UAT-02-C-PDF** | **Claude** | User Image Uploads | Upload photo: What is in this picture? | Export to **PDF** | Uploaded photo renders cleanly in the "You" prompt card. | [ ] |
| **UAT-04-B** | **Claude** | Checklists & To-Do Lists | 5-step checklist with checkboxes | Export to **Markdown** | Checkboxes format cleanly with no stray backslashes or broken symbols. | [ ] |
| **UAT-05-D** | **Claude** | Links with Underscores | Wikipedia link with underscores (e.g. *Deep_learning*) | Export to **Markdown** | Website links remain clickable with no broken characters. | [ ] |
| **UAT-06-B-MD** | **Claude** | Reasoning Traces (3.7 Sonnet) | Complex prompt with thinking enabled | Export to **Markdown** | Thought process appears in a collapsible reasoning callout box. | [ ] |
| **UAT-06-B-PDF** | **Claude** | Reasoning Traces (3.7 Sonnet) | Complex prompt with thinking enabled | Export to **PDF** | Thought process renders in a distinct tinted callout block. | [ ] |
| **UAT-07-MD** | **Claude** | Code & Component Artifacts | Write a React button component in a code artifact | Export to **Markdown** | Generated code files and components are grouped in a dedicated `#### 📦 Claude Artifacts` section. | [ ] |
| **UAT-07-PDF** | **Claude** | Code & Component Artifacts | Write a React button component in a code artifact | Export to **PDF** | Artifacts are rendered in dedicated framed code cards. | [ ] |
| **UAT-09-B-ALL** | **Claude** | Tables to CSV (All Tables) | Compare PostgreSQL vs SQLite in a table | CSV Tab → **Export All Tables** | Exports all detected tables into a single formatted CSV. | [ ] |
| **UAT-09-B-SEL** | **Claude** | Tables to CSV (Selected Table) | Compare PostgreSQL vs SQLite in a table | CSV Tab → **Export Selected Table** | Exports chosen table as a clean single CSV file. | [ ] |
| **UAT-10-B-EXEC** | **Claude** | PDF Executive Theme | Any conversation | PDF Options → **Executive** → Export PDF | Clean modern light layout. | [ ] |
| **UAT-10-B-MID** | **Claude** | PDF Midnight Theme | Any conversation | PDF Options → **Midnight** → Export PDF | Dark mode layout with high contrast. | [ ] |
| **UAT-10-B-ACAD** | **Claude** | PDF Academic Theme | Any conversation | PDF Options → **Academic** → Export PDF | Formal serif academic paper style. | [ ] |
| **UAT-11-B** | **Claude** | Multi-Page PDF Layout | Long conversation (10+ turns) | Export to **PDF** | Long messages, code boxes, and tables stay intact without getting sliced in half across page edges. | [ ] |
| | | | | | | |
| **UAT-01-B-MD** | **Gemini** | AI Generated Images (Imagen) | Generate a sunshine image | Export to **Markdown** | Image link from Google CDN is preserved cleanly. | [ ] |
| **UAT-01-B-PDF** | **Gemini** | AI Generated Images (Imagen) | Generate a sunshine image | Export to **PDF** | Generated image renders in high resolution in the PDF card. | [ ] |
| **UAT-02-B-MD** | **Gemini** | User Image Uploads | Upload photo: What is in this picture? | Export to **Markdown** | Uploaded photo link appears in prompt and is not repeated in later turns. | [ ] |
| **UAT-02-B-PDF** | **Gemini** | User Image Uploads | Upload photo: What is in this picture? | Export to **PDF** | Uploaded photo renders inside the "You" prompt card. | [ ] |
| **UAT-03-MD** | **Gemini** | Image-Only Answers | Prompt generating an image without text | Export to **Markdown** | Visual-only turn is preserved as an image card and not dropped. | [ ] |
| **UAT-03-PDF** | **Gemini** | Image-Only Answers | Prompt generating an image without text | Export to **PDF** | Visual-only turn renders the image in a full response card. | [ ] |
| **UAT-04-C** | **Gemini** | Checklists & To-Do Lists | 5-step checklist with checkboxes | Export to **Markdown** | Checkboxes format as `- [ ]` and `- [x]`. | [ ] |
| **UAT-05-C** | **Gemini** | Links with Underscores | Wikipedia link with underscores (e.g. *Deep_learning*) | Export to **Markdown** | Website links remain clickable with no broken characters. | [ ] |
| **UAT-09-C-ALL** | **Gemini** | Tables to CSV (All Tables) | Compare PostgreSQL vs SQLite in a table | CSV Tab → **Export All Tables** | Exports all tables to CSV. | [ ] |
| **UAT-09-C-SEL** | **Gemini** | Tables to CSV (Selected Table) | Compare PostgreSQL vs SQLite in a table | CSV Tab → **Export Selected Table** | Exports selected table to CSV. | [ ] |
| **UAT-10-C-EXEC** | **Gemini** | PDF Executive Theme | Any conversation | PDF Options → **Executive** → Export PDF | Light theme layout. | [ ] |
| **UAT-10-C-MID** | **Gemini** | PDF Midnight Theme | Any conversation | PDF Options → **Midnight** → Export PDF | Dark theme layout. | [ ] |
| **UAT-10-C-ACAD** | **Gemini** | PDF Academic Theme | Any conversation | PDF Options → **Academic** → Export PDF | Formal serif academic theme. | [ ] |
| **UAT-11-C** | **Gemini** | Multi-Page PDF Layout | Long conversation (10+ turns) | Export to **PDF** | Long messages, code boxes, and tables stay intact without splitting across page boundaries. | [ ] |
| | | | | | | |
| **UAT-05-A** | **Perplexity** | Links with Underscores | Wikipedia link with underscores (e.g. *Deep_learning*) | Export to **Markdown** | Website links remain clickable with no broken characters. | [ ] |
| **UAT-08-MD** | **Perplexity** | Web Citations & Sources | Research question with web sources | Export to **Markdown** | Reference numbers like `[1]` link to sources + comprehensive bibliography at bottom. | [ ] |
| **UAT-08-PDF** | **Perplexity** | Web Citations & Sources | Research question with web sources | Export to **PDF** | Formatted citation badges and bibliography card in PDF. | [ ] |
| **UAT-09-E-ALL** | **Perplexity** | Tables to CSV (All Tables) | Compare PostgreSQL vs SQLite in a table | CSV Tab → **Export All Tables** | Exports all tables to CSV. | [ ] |
| **UAT-09-E-SEL** | **Perplexity** | Tables to CSV (Selected Table) | Compare PostgreSQL vs SQLite in a table | CSV Tab → **Export Selected Table** | Exports selected table to CSV. | [ ] |
| | | | | | | |
| **UAT-06-C-MD** | **DeepSeek** | Reasoning Traces (<think>) | Logic or coding question | Export to **Markdown** | DeepSeek's thinking process is formatted in a clean collapsible callout box above the answer. | [x] |
| **UAT-06-C-PDF** | **DeepSeek** | Reasoning Traces (<think>) | Logic or coding question | Export to **PDF** | Reasoning process renders in a distinct tinted callout block. | [x] |
| **UAT-09-D-ALL** | **DeepSeek** | Tables to CSV (All Tables) | Compare PostgreSQL vs SQLite in a table | CSV Tab → **Export All Tables** | Exports all tables to CSV. | [ ] |
| **UAT-09-D-SEL** | **DeepSeek** | Tables to CSV (Selected Table) | Compare PostgreSQL vs SQLite in a table | CSV Tab → **Export Selected Table** | Exports selected table to CSV. | [ ] |
| | | | | | | |
| **UAT-SMOKE-FIREFOX** | **Firefox** | Cross-Browser Smoke Audit | Load `dist/firefox` in `about:debugging` | Export 1 MD & 1 PDF on any platform | Add-on loads cleanly with dual MV3 compatibility; downloads & print dialogs trigger smoothly. | [ ] |
| **UAT-SMOKE-EDGE** | **Edge** | Cross-Browser Smoke Audit | Load `dist/chromium` in `edge://extensions` | Export 1 MD & 1 PDF on any platform | Unpacked extension loads cleanly; full Chromium parity confirmed. | [ ] |

