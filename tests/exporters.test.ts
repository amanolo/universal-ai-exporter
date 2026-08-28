import test from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownExporter, healCodeFences } from '../src/core/exporters/markdown-exporter';
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
