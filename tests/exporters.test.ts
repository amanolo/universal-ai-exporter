import test from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownExporter, healCodeFences, normalizeChecklists, cleanMarkdownUrls } from '../src/core/exporters/markdown-exporter';
import { CSVExporter } from '../src/core/exporters/csv-exporter';
import { PDFExporter } from '../src/core/exporters/pdf-exporter';
import { ConversationData } from '../src/core/types';

const sampleConversation: ConversationData = {
  id: 'conv-test-99',
  title: 'Autonomous Multi-Agent Architecture',
  platform: 'claude',
  model: 'Claude 3.7 Sonnet',
  url: 'https://claude.ai/chat/arch-99',
  exportedAt: '2026-08-28T18:00:00.000Z',
  totalTablesCount: 1,
  messages: [
    {
      id: 'm1',
      role: 'user',
      author: 'You',
      contentHtml: '<p>Explain multi-agent consensus protocols with a comparison table.</p>',
      contentText: 'Explain multi-agent consensus protocols with a comparison table.',
      codeBlocks: []
    },
    {
      id: 'm2',
      role: 'assistant',
      author: 'Claude',
      reasoning: 'Analyzed Raft, Paxos, and PBFT consensus algorithms for distributed agents.',
      contentHtml: '<p>Consensus algorithms allow autonomous agents to coordinate state safely.</p><table><tr><th>Protocol</th><th>Fault Tolerance</th><th>Latency</th></tr><tr><td>Raft</td><td>Crash Fault (f < n/2)</td><td>1 RTT</td></tr><tr><td>PBFT</td><td>Byzantine Fault (f < n/3)</td><td>3 RTT</td></tr></table><pre><code class="language-typescript">interface ConsensusMessage {\n  term: number;\n  leaderId: string;\n}</code></pre>',
      contentText: 'Consensus algorithms allow autonomous agents to coordinate state safely.\n\nProtocol | Fault Tolerance | Latency\nRaft | Crash Fault (f < n/2) | 1 RTT\nPBFT | Byzantine Fault (f < n/3) | 3 RTT',
      codeBlocks: [
        { language: 'typescript', code: 'interface ConsensusMessage {\n  term: number;\n  leaderId: string;\n}' }
      ],
      tables: [
        [
          ['Protocol', 'Fault Tolerance', 'Latency'],
          ['Raft', 'Crash Fault (f < n/2)', '1 RTT'],
          ['PBFT', 'Byzantine Fault (f < n/3)', '3 RTT']
        ]
      ],
      artifacts: [
        {
          id: 'art-1',
          title: 'ConsensusNode.ts',
          type: 'code',
          language: 'typescript',
          content: 'export class ConsensusNode { state: string = "follower"; }'
        }
      ],
      citations: [
        {
          index: 1,
          title: 'In Search of an Understandable Consensus Algorithm (Ongaro & Ousterhout)',
          url: 'https://raft.github.io/raft.pdf',
          siteName: 'raft.github.io'
        }
      ]
    }
  ]
};

test('Exporter 1: Markdown Exporter (Frontmatter, Reasoning Callouts, Artifacts, Citations)', () => {
  const exporter = new MarkdownExporter();
  const md = exporter.exportToMarkdown(sampleConversation, {
    format: 'markdown',
    includeFrontmatter: true,
    includeReasoning: true,
    includeArtifacts: true,
    includeCitations: true
  });

  // Frontmatter
  assert.ok(md.startsWith('---'));
  assert.ok(md.includes('title: "Autonomous Multi-Agent Architecture"'));
  assert.ok(md.includes('platform: claude'));
  assert.ok(md.includes('model: "Claude 3.7 Sonnet"'));
  assert.ok(md.includes('tags:'));

  // Title
  assert.ok(md.includes('# Autonomous Multi-Agent Architecture'));

  // Reasoning callout
  assert.ok(md.includes('> [!note]- 🧠 **Reasoning Process**'));
  assert.ok(md.includes('Analyzed Raft, Paxos, and PBFT'));

  // Code block
  assert.ok(md.includes('```typescript'));
  assert.ok(md.includes('interface ConsensusMessage'));

  // Artifact
  assert.ok(md.includes('#### 📦 **Claude Artifacts**'));
  assert.ok(md.includes('ConsensusNode.ts'));

  // Citation & Bibliography
  assert.ok(md.includes('#### 📚 **Citations & References**'));
  assert.ok(md.includes('## 📑 Comprehensive Bibliography'));
  assert.ok(md.includes('1. [In Search of an Understandable Consensus Algorithm (Ongaro & Ousterhout)](https://raft.github.io/raft.pdf) — *raft.github.io*'));

  // Code fence healing check
  const brokenMd = '```python\nprint("test")';
  assert.ok(healCodeFences(brokenMd).endsWith('```\n'));
});

test('Exporter 2: Markdown Exporter (Options Toggles: Frontmatter & Reasoning disabled)', () => {
  const exporter = new MarkdownExporter();
  const md = exporter.exportToMarkdown(sampleConversation, {
    format: 'markdown',
    includeFrontmatter: false,
    includeReasoning: false,
    includeArtifacts: false,
    includeCitations: false
  });

  assert.equal(md.startsWith('---'), false, 'Should not start with frontmatter when disabled');
  assert.equal(md.includes('> [!note]- 🧠 **Reasoning Process**'), false, 'Reasoning should be excluded when toggled off');
  assert.equal(md.includes('#### 📦 **Claude Artifacts**'), false, 'Artifacts should be excluded when toggled off');
  assert.equal(md.includes('## 📑 Comprehensive Bibliography'), false, 'Bibliography should be excluded when toggled off');
});

test('Exporter 3: CSV Table Extractor (RFC 4180 Escaping, Excel UTF-8 BOM & Multi-table)', () => {
  // Consolidated export
  const csvResult = CSVExporter.exportTables(sampleConversation);
  assert.equal(csvResult.count, 1);
  assert.ok(csvResult.csvContent.startsWith('\uFEFF'), 'CSV must contain UTF-8 BOM for Microsoft Excel');
  assert.ok(csvResult.csvContent.includes('--- TABLE 1 (Claude) ---'));
  assert.ok(csvResult.csvContent.includes('Raft,Crash Fault (f < n/2),1 RTT'));

  // Single table index selection
  const singleResult = CSVExporter.exportTables(sampleConversation, 0);
  assert.equal(singleResult.count, 1);
  assert.equal(singleResult.filename, 'table-1.csv');
  assert.ok(singleResult.csvContent.startsWith('\uFEFF'));
  assert.ok(singleResult.csvContent.includes('PBFT,Byzantine Fault (f < n/3),3 RTT'));

  // Empty conversation
  const emptyConv: ConversationData = {
    id: 'empty',
    title: 'Empty',
    platform: 'chatgpt',
    url: 'https://chatgpt.com',
    exportedAt: new Date().toISOString(),
    messages: []
  };
  const emptyResult = CSVExporter.exportTables(emptyConv);
  assert.equal(emptyResult.count, 0);
  assert.ok(emptyResult.csvContent.includes('No tables found'));

  // RFC 4180 escaping check: commas, quotes, newlines
  const specialTable = [
    ['Col "A"', 'Col, B', 'Col\nC']
  ];
  const escaped = CSVExporter.tableToCSV(specialTable);
  assert.ok(escaped.includes('"Col ""A"""'));
  assert.ok(escaped.includes('"Col, B"'));
  assert.ok(escaped.includes('"Col\nC"'));
});

test('Exporter 4: PDF Document HTML Generation (Executive, Midnight, Academic Themes & Page-Break CSS)', () => {
  // Executive Light Theme
  const lightHtml = PDFExporter.generateDocumentHtml(sampleConversation, 'executive');
  assert.ok(lightHtml.includes('<!DOCTYPE html>'));
  assert.ok(lightHtml.includes('Autonomous Multi-Agent Architecture'));
  assert.ok(lightHtml.includes('break-inside: avoid'), 'Must include CSS break-inside avoid on message cards');
  assert.ok(lightHtml.includes('Reasoning Process (Claude)'));
  assert.ok(lightHtml.includes('ConsensusNode.ts'));

  // Midnight Dark Theme
  const darkHtml = PDFExporter.generateDocumentHtml(sampleConversation, 'midnight');
  assert.ok(darkHtml.includes('#0f172a'), 'Must use Midnight dark background');
  assert.ok(darkHtml.includes('#f1f5f9'), 'Must use Midnight light text color');

  // Academic Paper Theme
  const academicHtml = PDFExporter.generateDocumentHtml(sampleConversation, 'academic');
  assert.ok(academicHtml.includes('Georgia, "Times New Roman", serif'), 'Must use Serif typography');
});

test('Exporter 5: Multimodal Image Export in Markdown and PDF', () => {
  const imageConversation: ConversationData = {
    id: 'conv-img-1',
    title: 'Cyberpunk Hero Generation',
    platform: 'gemini',
    model: 'Gemini 2.0 Flash',
    url: 'https://gemini.google.com/app/img-123',
    exportedAt: '2026-08-29T09:00:00.000Z',
    totalTablesCount: 0,
    messages: [
      {
        id: 'img-m1',
        role: 'user',
        author: 'You',
        contentHtml: '<p>Make me like a cyberpunk hero.</p><img src="https://lh3.googleusercontent.com/user-photo" alt="User Selfie" />',
        contentText: 'Make me like a cyberpunk hero.',
        codeBlocks: [],
        images: ['https://lh3.googleusercontent.com/user-photo']
      },
      {
        id: 'img-m2',
        role: 'assistant',
        author: 'Gemini',
        contentHtml: '<img src="https://lh3.googleusercontent.com/cyberpunk-hero-gen" alt="Cyberpunk Hero Artwork" />',
        contentText: '',
        codeBlocks: [],
        images: ['https://lh3.googleusercontent.com/cyberpunk-hero-gen']
      }
    ]
  };

  const exporter = new MarkdownExporter();

  // Markdown with images enabled (default)
  const mdWithImages = exporter.exportToMarkdown(imageConversation, {
    format: 'markdown',
    includeImages: true
  });
  assert.ok(mdWithImages.includes('![User Selfie](https://lh3.googleusercontent.com/user-photo)'));
  assert.ok(mdWithImages.includes('![Cyberpunk Hero Artwork](https://lh3.googleusercontent.com/cyberpunk-hero-gen)'));

  // Markdown with images disabled
  const mdNoImages = exporter.exportToMarkdown(imageConversation, {
    format: 'markdown',
    includeImages: false
  });
  assert.equal(mdNoImages.includes('https://lh3.googleusercontent.com'), false, 'Images must be excluded when includeImages is false');

  // Markdown with blob URL filtering
  const blobConversation: ConversationData = {
    ...imageConversation,
    messages: [
      {
        id: 'blob-m1',
        role: 'assistant',
        author: 'Gemini',
        contentHtml: '<img src="blob:https://gemini.google.com/123-abc" alt="A very long 500 word AI generation prompt description text that should be filtered" />',
        contentText: '',
        codeBlocks: [],
        images: ['blob:https://gemini.google.com/123-abc']
      }
    ]
  };
  const mdBlob = exporter.exportToMarkdown(blobConversation, { format: 'markdown', includeImages: true });
  assert.equal(mdBlob.includes('blob:https://gemini.google.com'), false, 'Blob URLs must be filtered out from Markdown');
  assert.ok(mdBlob.includes('*[AI Generated Visual]*'), 'Visual-only turns with blob URLs must render clean placeholder');

  // PDF HTML generation with images
  const pdfHtml = PDFExporter.generateDocumentHtml(imageConversation, 'executive', {
    format: 'pdf',
    includeImages: true
  });
  assert.ok(pdfHtml.includes('https://lh3.googleusercontent.com/cyberpunk-hero-gen'), 'PDF HTML must include content image src');
  assert.ok(pdfHtml.includes('<img src='), 'PDF HTML must contain img element');

  // PDF HTML generation with images disabled
  const pdfHtmlNoImages = PDFExporter.generateDocumentHtml(imageConversation, 'executive', {
    format: 'pdf',
    includeImages: false
  });
  assert.equal(pdfHtmlNoImages.includes('<img'), false, 'PDF HTML must not contain img elements when includeImages is false');
});

test('Exporter 6: Universal Checklist Normalization for Obsidian & Notion', () => {
  // Test raw Turndown escaped brackets in lists
  const escapedMarkdown = `
### Task List / Checklist
- \\[ \\] **Ατομικό Δελτίο Υγείας Μαθητή (ΑΔΥΜ)**
  - Επίσκεψη στον παιδίατρο
- \\[x\\] **Φωτογραφία Μαθητικής Ταυτότητας** *(Έχει ήδη σταλεί)*
- \\[X\\] **Έντυπο GDPR**
1. \\[ \\] First numbered task
* ☐ Unicode unchecked item
* ☑ Unicode completed item
`;

  const normalized = normalizeChecklists(escapedMarkdown);

  assert.ok(normalized.includes('- [ ] **Ατομικό Δελτίο Υγείας Μαθητή (ΑΔΥΜ)**'));
  assert.ok(normalized.includes('- [x] **Φωτογραφία Μαθητικής Ταυτότητας**'));
  assert.ok(normalized.includes('- [x] **Έντυπο GDPR**'));
  assert.ok(normalized.includes('1. [ ] First numbered task'));
  assert.ok(normalized.includes('* [ ] Unicode unchecked item'));
  assert.ok(normalized.includes('* [x] Unicode completed item'));

  // Test full MarkdownExporter integration with HTML checklist
  const checklistConversation: ConversationData = {
    id: 'conv-checklist-1',
    title: 'Pre-school Onboarding Checklist',
    platform: 'gemini',
    model: 'Gemini 2.0 Flash',
    url: 'https://gemini.google.com/app/checklist-123',
    exportedAt: '2026-08-29T09:00:00.000Z',
    totalTablesCount: 0,
    messages: [
      {
        id: 'chk-1',
        role: 'assistant',
        author: 'Gemini',
        contentHtml: '<ul><li>[ ] Σαγιονάρες</li><li>[x] Μπουρνούζι</li><li>[ ] Σκουφάκι κολύμβησης</li></ul>',
        contentText: '- [ ] Σαγιονάρες\n- [x] Μπουρνούζι\n- [ ] Σκουφάκι κολύμβησης',
        codeBlocks: []
      }
    ]
  };

  const exporter = new MarkdownExporter();
  const md = exporter.exportToMarkdown(checklistConversation);

  assert.ok(md.includes('- [ ] Σαγιονάρες'));
  assert.ok(md.includes('- [x] Μπουρνούζι'));
  assert.ok(md.includes('- [ ] Σκουφάκι κολύμβησης'));
  assert.equal(md.includes('\\[ \\]'), false, 'Markdown must not contain escaped backslash brackets');
});

test('Exporter 7: Clean Web URLs (Unescaping Underscores in Links)', () => {
  const inputWithEscapedUrls = `
Here is the school onboarding PDF:
https://mcusercontent.com/4506e2aac91bcb83457cd36cd/files/c4a1d437-062f-e85b-9da0-6cc872ba8ff3/\\_Pi\\_Rho\\_Omicron\\_Nu\\_Eta\\_Pi\\_Iota\\_Alpha\\_2026\\_27.pdf

And in markdown link:
[Onboarding Guide](https://example.com/files/test\\_file\\_2026.pdf)

While regular italics _like this_ and *this* should remain intact.
`;

  const cleaned = cleanMarkdownUrls(inputWithEscapedUrls);

  assert.ok(cleaned.includes('https://mcusercontent.com/4506e2aac91bcb83457cd36cd/files/c4a1d437-062f-e85b-9da0-6cc872ba8ff3/_Pi_Rho_Omicron_Nu_Eta_Pi_Iota_Alpha_2026_27.pdf'));
  assert.ok(cleaned.includes('[Onboarding Guide](https://example.com/files/test_file_2026.pdf)'));
  assert.ok(cleaned.includes('_like this_'), 'Non-URL italics must remain untouched');
});

test('Exporter 8: Image Deduplication in Markdown and PDF', () => {
  const chatgptImageConv: ConversationData = {
    id: 'conv-chatgpt-img',
    title: 'Generate Cyberpunk Skyline',
    platform: 'chatgpt',
    model: 'ChatGPT',
    url: 'https://chatgpt.com/c/skyline-123',
    exportedAt: '2026-08-29T10:35:00.000Z',
    messages: [
      {
        id: 'msg-1',
        role: 'assistant',
        author: 'ChatGPT',
        contentHtml: '<p><img src="https://chatgpt.com/backend-api/estuary/content?id=file_0001&ts=100&sig=abc" alt="Generated image: Neon Rain Over Future City" /></p>',
        contentText: '',
        codeBlocks: [],
        images: [
          'https://chatgpt.com/backend-api/estuary/content?id=file_0001&ts=100&sig=abc',
          'https://chatgpt.com/backend-api/estuary/content?id=file_0001&ts=100&sig=abc'
        ]
      }
    ]
  };

  const exporter = new MarkdownExporter();
  const md = exporter.exportToMarkdown(chatgptImageConv, { format: 'markdown', includeImages: true });

  // Count occurrences of the image in markdown
  const matches = md.match(/!\[.*?\]\(https:\/\/chatgpt\.com\/backend-api\/estuary\/content\?id=file_0001[^\)]*\)/g);
  assert.equal(matches?.length, 1, 'Markdown must contain EXACTLY ONE image link without duplicates');

  // Verify PDF HTML contains exactly one img element
  const pdfHtml = PDFExporter.generateDocumentHtml(chatgptImageConv, 'executive', { format: 'pdf', includeImages: true });
  const imgTagMatches = pdfHtml.match(/<img[^>]+src=["']https:\/\/chatgpt\.com\/backend-api\/estuary\/content\?id=file_0001/gi);
  assert.equal(imgTagMatches?.length, 1, 'PDF HTML must contain EXACTLY ONE img tag without duplicates');
});

test('Exporter 9: Relative /api/ Link Filtering and V Tool Noise Stripping', () => {
  const claudeNoiseConv: ConversationData = {
    id: 'conv-claude-noise',
    title: 'Image identification request',
    platform: 'claude',
    model: 'Claude 3.5 Sonnet',
    url: 'https://claude.ai/chat/123',
    exportedAt: '2026-08-29T11:40:00.000Z',
    messages: [
      {
        id: 'msg-u1',
        role: 'user',
        author: 'You',
        contentHtml: '<p>What is in this picture?</p><img src="/api/6bdb2585-28e7-4fe2-b1d9-e1ee6d3071b5/files/ce825ffb/preview" alt="Attachment" />',
        contentText: 'What is in this picture?',
        codeBlocks: [],
        images: ['/api/6bdb2585-28e7-4fe2-b1d9-e1ee6d3071b5/files/ce825ffb/preview']
      },
      {
        id: 'msg-a1',
        role: 'assistant',
        author: 'Claude',
        contentHtml: '<p>V</p><p>visualize show_widget</p><p>Here is a bright sunshine scene for you ☀️</p>',
        contentText: 'V\nvisualize show_widget\nHere is a bright sunshine scene for you ☀️',
        codeBlocks: []
      }
    ]
  };

  const exporter = new MarkdownExporter();
  const md = exporter.exportToMarkdown(claudeNoiseConv, { format: 'markdown', includeImages: true });

  // 1. Must filter out relative /api/ link
  assert.equal(md.includes('/api/6bdb2585'), false, 'Relative /api/ attachment links must be excluded from Markdown');
  assert.equal(md.includes('![Image](/api/'), false, 'No relative image markdown tags');

  // 2. Must filter out single-line 'V' and 'visualize show_widget'
  assert.equal(md.includes('\nV\n'), false, 'Stray V lines must be removed');
  assert.equal(md.includes('visualize show_widget'), false, 'Tool commands must be removed');
  assert.ok(md.includes('Here is a bright sunshine scene for you ☀️'));
});

test('Exporter 10: Full Toggle Verification Suite (Markdown & PDF Options ON vs OFF)', () => {
  const toggleTestData: ConversationData = {
    id: 'conv-toggle-test',
    title: 'PostgreSQL vs SQLite Architecture',
    platform: 'claude',
    model: 'Claude 3.7 Sonnet',
    url: 'https://claude.ai/chat/toggle-test',
    exportedAt: '2026-08-31T09:30:00.000Z',
    totalTablesCount: 1,
    messages: [
      {
        id: 'm1',
        role: 'user',
        author: 'You',
        contentHtml: '<p>Compare PostgreSQL vs SQLite with a diagram and code snippet.</p>',
        contentText: 'Compare PostgreSQL vs SQLite with a diagram and code snippet.',
        codeBlocks: [],
        images: ['https://images.unsplash.com/photo-database.jpg']
      },
      {
        id: 'm2',
        role: 'assistant',
        author: 'Claude',
        reasoning: 'Detailed reasoning: Analyzing client-server vs embedded relational architectures.',
        contentHtml: '<p>PostgreSQL is client-server, whereas SQLite is embedded.</p>',
        contentText: 'PostgreSQL is client-server, whereas SQLite is embedded.',
        codeBlocks: [{ language: 'typescript', code: 'const db = new Database();' }],
        tables: [[['Feature', 'PostgreSQL', 'SQLite'], ['Engine', 'Server', 'Embedded']]],
        artifacts: [{ id: 'art-1', title: 'DbConnector.ts', type: 'code', content: 'export class DbConnector {}' }],
        citations: [{ index: 1, title: 'SQLite Architecture Guide', url: 'https://sqlite.org/arch.html', siteName: 'sqlite.org' }],
        images: ['https://images.unsplash.com/photo-diagram.jpg']
      }
    ]
  };

  const mdExporter = new MarkdownExporter();

  // 1. Markdown Frontmatter
  const mdFmOn = mdExporter.exportToMarkdown(toggleTestData, { format: 'markdown', includeFrontmatter: true });
  const mdFmOff = mdExporter.exportToMarkdown(toggleTestData, { format: 'markdown', includeFrontmatter: false });
  assert.ok(mdFmOn.startsWith('---'), 'Frontmatter ON must start with YAML block');
  assert.equal(mdFmOff.startsWith('---'), false, 'Frontmatter OFF must not start with YAML block');

  // 2. Markdown Reasoning
  const mdReasOn = mdExporter.exportToMarkdown(toggleTestData, { format: 'markdown', includeReasoning: true });
  const mdReasOff = mdExporter.exportToMarkdown(toggleTestData, { format: 'markdown', includeReasoning: false });
  assert.ok(mdReasOn.includes('> [!note]- 🧠 **Reasoning Process**'), 'Reasoning ON must include callout');
  assert.equal(mdReasOff.includes('Reasoning Process'), false, 'Reasoning OFF must exclude callout');

  // 3. Markdown Citations
  const mdCitOn = mdExporter.exportToMarkdown(toggleTestData, { format: 'markdown', includeCitations: true });
  const mdCitOff = mdExporter.exportToMarkdown(toggleTestData, { format: 'markdown', includeCitations: false });
  assert.ok(mdCitOn.includes('#### 📚 **Citations & References**'), 'Citations ON must include references');
  assert.equal(mdCitOff.includes('Citations & References'), false, 'Citations OFF must exclude references');

  // 4. Markdown Images
  const mdImgOn = mdExporter.exportToMarkdown(toggleTestData, { format: 'markdown', includeImages: true });
  const mdImgOff = mdExporter.exportToMarkdown(toggleTestData, { format: 'markdown', includeImages: false });
  assert.ok(mdImgOn.includes('![User Attachment](https://images.unsplash.com/photo-database.jpg)'), 'Images ON must render image link');
  assert.equal(mdImgOff.includes('photo-database.jpg'), false, 'Images OFF must strip image link');

  // 5. PDF Reasoning
  const pdfReasOn = PDFExporter.generateDocumentHtml(toggleTestData, 'executive', { format: 'pdf', includeReasoning: true });
  const pdfReasOff = PDFExporter.generateDocumentHtml(toggleTestData, 'executive', { format: 'pdf', includeReasoning: false });
  assert.ok(pdfReasOn.includes('🧠 Reasoning Process'), 'PDF Reasoning ON must render reasoning box');
  assert.equal(pdfReasOff.includes('Reasoning Process'), false, 'PDF Reasoning OFF must omit reasoning box');

  // 6. PDF Citations
  const pdfCitOn = PDFExporter.generateDocumentHtml(toggleTestData, 'executive', { format: 'pdf', includeCitations: true });
  const pdfCitOff = PDFExporter.generateDocumentHtml(toggleTestData, 'executive', { format: 'pdf', includeCitations: false });
  assert.ok(pdfCitOn.includes('📚 Citations & Sources'), 'PDF Citations ON must render sources list');
  assert.equal(pdfCitOff.includes('Citations & Sources'), false, 'PDF Citations OFF must omit sources list');

  // 7. PDF Artifacts
  const pdfArtOn = PDFExporter.generateDocumentHtml(toggleTestData, 'executive', { format: 'pdf', includeArtifacts: true });
  const pdfArtOff = PDFExporter.generateDocumentHtml(toggleTestData, 'executive', { format: 'pdf', includeArtifacts: false });
  assert.ok(pdfArtOn.includes('ARTIFACT:'), 'PDF Artifacts ON must render artifact panel');
  assert.equal(pdfArtOff.includes('ARTIFACT:'), false, 'PDF Artifacts OFF must omit artifact panel');

  // 8. PDF Images
  const pdfImgOn = PDFExporter.generateDocumentHtml(toggleTestData, 'executive', { format: 'pdf', includeImages: true });
  const pdfImgOff = PDFExporter.generateDocumentHtml(toggleTestData, 'executive', { format: 'pdf', includeImages: false });
  assert.ok(pdfImgOn.includes('<img src="https://images.unsplash.com/photo-database.jpg"'), 'PDF Images ON must render <img> tag');
  assert.equal(pdfImgOff.includes('<img'), false, 'PDF Images OFF must omit <img> tag');
});



