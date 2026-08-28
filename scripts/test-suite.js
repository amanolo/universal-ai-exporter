import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import TurndownService from 'turndown';
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signLicense } from './generate-license.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// --- Base Unit Tests (Isolation) ---

function sanitizeFilename(name, extension) {
  const clean = name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  const dateStr = new Date().toISOString().slice(0, 10);
  return `${clean || 'ai-export'}-${dateStr}.${extension}`;
}

function escapeCsvCell(cell) {
  const stringVal = cell == null ? '' : String(cell);
  if (stringVal.includes('"') || stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('\r')) {
    return `"${stringVal.replace(/"/g, '""')}"`;
  }
  return stringVal;
}

function tableToCSV(tableData) {
  return tableData.map(row => row.map(cell => escapeCsvCell(cell)).join(',')).join('\r\n');
}

function exportTables(conversation, tableIndex) {
  const allTables = [];
  conversation.messages.forEach(msg => {
    if (msg.tables && msg.tables.length > 0) {
      msg.tables.forEach(t => {
        allTables.push({ messageAuthor: msg.author, table: t });
      });
    }
  });

  if (allTables.length === 0) {
    return {
      csvContent: '\uFEFFNo tables found in this conversation.',
      count: 0,
      filename: 'empty-tables.csv'
    };
  }

  if (typeof tableIndex === 'number' && tableIndex >= 0 && tableIndex < allTables.length) {
    const selected = allTables[tableIndex];
    const csv = '\uFEFF' + tableToCSV(selected.table);
    return {
      csvContent: csv,
      count: 1,
      filename: `table-${tableIndex + 1}.csv`
    };
  }

  const sections = [];
  allTables.forEach((item, idx) => {
    sections.push(`--- TABLE ${idx + 1} (${item.messageAuthor}) ---`);
    sections.push(tableToCSV(item.table));
    sections.push('\r\n');
  });

  const fullContent = '\uFEFF' + sections.join('\r\n');
  return {
    csvContent: fullContent,
    count: allTables.length,
    filename: `all-tables-${conversation.id}.csv`
  };
}

function healCodeFences(text) {
  const matches = text.match(/(?:^|\n)\s*(?:>\s*)*```/g);
  const count = matches ? matches.length : 0;
  if (count % 2 !== 0) {
    return text.trimEnd() + '\n```\n';
  }
  return text;
}

function stripStreamingCursors(text) {
  return text.replace(/[\u25ae\u2588\u25cf\u258b\u258c\u258d\u258e\u258f\u25a0\u25aa\u25ab\u200b]/g, '').trim();
}

function computeAdaptiveCanvasScale(docHeight) {
  const safeMaxCanvasHeight = 30000;
  return Math.min(2, Math.max(0.5, safeMaxCanvasHeight / docHeight));
}

test('Base 1. Filename Sanitization & Character Stripping', () => {
  const sanitized1 = sanitizeFilename('What is Quantum Computing? / Part 1: Intro', 'md');
  assert.match(sanitized1, /^What-is-Quantum-Computing-Part-1-Intro-\d{4}-\d{2}-\d{2}\.md$/);

  const sanitized2 = sanitizeFilename('   <<<Illegal:::Characters???>>>   ', 'pdf');
  assert.match(sanitized2, /^Illegal-Characters-\d{4}-\d{2}-\d{2}\.pdf$/);

  const sanitized3 = sanitizeFilename('', 'csv');
  assert.match(sanitized3, /^ai-export-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('Base 2. CSV RFC 4180 Escaping & Excel UTF-8 BOM', () => {
  const testTable = [
    ['Header 1', 'Header 2, with comma', 'Header 3 "Quotes"'],
    ['Row 1', 'Line\nBreak', 'Simple Value']
  ];

  const csv = tableToCSV(testTable);
  assert.ok(csv.includes('"Header 2, with comma"'), 'Should wrap commas in quotes');
  assert.ok(csv.includes('"Header 3 ""Quotes"""'), 'Should escape double quotes with double-double quotes');
  assert.ok(csv.includes('"Line\nBreak"'), 'Should wrap multiline cells in quotes');

  const conversationMock = {
    id: 'test-123',
    title: 'Financial Analysis',
    messages: [
      {
        author: 'ChatGPT',
        tables: [testTable]
      }
    ]
  };

  const result = exportTables(conversationMock);
  assert.equal(result.count, 1);
  assert.ok(result.csvContent.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for Excel');
  assert.ok(result.csvContent.includes('--- TABLE 1 (ChatGPT) ---'));
});

test('Base 3. Markdown Turndown & Math Preservation', () => {
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  const htmlWithMath = '<p>The formula is $E = mc^2$ and $$\\int_0^1 x dx$$</p>';
  const markdown = turndown.turndown(htmlWithMath);
  assert.ok(markdown.includes('$E = mc^2$'));

  const htmlWithCode = '<pre><code class="language-python">def hello():\n    print("world")</code></pre>';
  const mdCode = turndown.turndown(htmlWithCode);
  assert.ok(mdCode.includes('def hello():'));
});

test('Base 4. Ed25519 Web Crypto License Verification', async () => {
  const email = 'researcher@university.edu';
  const { licenseKey, payload, keys } = signLicense(email, 'pro', 'lifetime');

  assert.ok(licenseKey.startsWith('UAIE-PRO.'));
  assert.equal(payload.email, email);
  assert.equal(payload.tier, 'pro');

  const parts = licenseKey.split('.');
  assert.equal(parts.length, 3);

  const [prefix, payloadB64, signatureB64] = parts;
  const signatureBuffer = Buffer.from(signatureB64, 'base64url');
  const spkiBuffer = Buffer.from(keys.spkiBase64, 'base64');
  const payloadBuffer = Buffer.from(JSON.stringify(payload), 'utf8');

  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    spkiBuffer,
    { name: 'Ed25519' },
    false,
    ['verify']
  );

  const isValid = await crypto.subtle.verify(
    { name: 'Ed25519' },
    cryptoKey,
    signatureBuffer,
    payloadBuffer
  );

  assert.equal(isValid, true, 'Cryptographic signature must be valid');
});

test('Base 5. Markdown Code Fence Healing & Cursor Stripping', () => {
  const unclosed = '### Response\n\nHere is some code:\n```typescript\nconst a = 1;';
  const healed = healCodeFences(unclosed);
  assert.ok(healed.endsWith('```\n'));
  assert.equal(healCodeFences(healed), healed);

  const rawTextWithCursors = 'Generating tokens...\u25ae\u2588\u200b';
  const cleaned = stripStreamingCursors(rawTextWithCursors);
  assert.equal(cleaned, 'Generating tokens...');
});

test('Base 6. Adaptive PDF Canvas Scale Calculation', () => {
  assert.equal(computeAdaptiveCanvasScale(3000), 2);
  assert.equal(computeAdaptiveCanvasScale(15000), 2);
  assert.equal(computeAdaptiveCanvasScale(30000), 1);
  assert.equal(computeAdaptiveCanvasScale(60000), 0.5);
});

// --- Dynamic Compilation & Execution of Multi-Platform Fixture & Security Tests ---

const testBundleOut = path.join(ROOT_DIR, 'dist/test-suite-bundle.mjs');
const distDir = path.dirname(testBundleOut);
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(ROOT_DIR, 'tests/all-tests.ts')],
  bundle: true,
  outfile: testBundleOut,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  packages: 'external',
  sourcemap: 'inline'
});

// Execute the bundled fixture, exporter, and security test suites
await import(`file://${testBundleOut}?t=${Date.now()}`);
