import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { ChatGPTAdapter } from '../src/core/adapters/chatgpt-adapter';
import { ClaudeAdapter } from '../src/core/adapters/claude-adapter';
import { PerplexityAdapter } from '../src/core/adapters/perplexity-adapter';
import { DeepSeekAdapter } from '../src/core/adapters/deepseek-adapter';
import { GeminiAdapter } from '../src/core/adapters/gemini-adapter';
import { FallbackAdapter } from '../src/core/adapters/fallback-adapter';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures');

function loadFixture(filename: string, url: string): JSDOM {
  const filePath = path.join(FIXTURES_DIR, filename);
  const html = fs.readFileSync(filePath, 'utf8');
  return new JSDOM(html, { url });
}

function setupDomGlobals(dom: JSDOM) {
  // @ts-ignore
  global.window = dom.window;
  // @ts-ignore
  global.document = dom.window.document;
  // @ts-ignore
  global.Element = dom.window.Element;
  // @ts-ignore
  global.HTMLElement = dom.window.HTMLElement;
  // @ts-ignore
  global.HTMLAnchorElement = dom.window.HTMLAnchorElement;
}

test('Adapter 1: ChatGPT Adapter (o3-mini reasoning, KaTeX math, tables, code)', async () => {
  const dom = loadFixture('chatgpt.fixture.html', 'https://chatgpt.com/c/67123-quantum');
  setupDomGlobals(dom);

  const adapter = new ChatGPTAdapter();
  assert.equal(adapter.matches('https://chatgpt.com/c/67123-quantum'), true);
  assert.equal(adapter.matches('https://chat.openai.com/c/abc'), true);
  assert.equal(adapter.matches('https://claude.ai/chat/123'), false);

  const conv = await adapter.extractConversation();

  assert.equal(conv.platform, 'chatgpt');
  assert.equal(conv.title, 'Quantum Computing and Complexity');
  assert.equal(conv.model, 'o3-mini');
  assert.equal(conv.messages.length, 4);

  // Turn 0: User
  assert.equal(conv.messages[0].role, 'user');
  assert.equal(conv.messages[0].author, 'You');
  assert.ok(conv.messages[0].contentText.includes("Grover's search algorithm"));

  // Turn 1: Assistant with reasoning, math, table, and python code
  const asst1 = conv.messages[1];
  assert.equal(asst1.role, 'assistant');
  assert.equal(asst1.author, 'ChatGPT');
  assert.ok(asst1.reasoning?.includes("Analyze Grover's search algorithm"));
  assert.equal(asst1.codeBlocks.length, 1);
  assert.equal(asst1.codeBlocks[0].language, 'python');
  assert.ok(asst1.codeBlocks[0].code.includes('def grover_iterations'));

  // KaTeX math normalization check
  assert.ok(asst1.contentHtml.includes('$N$') || asst1.contentText.includes('$N$'));
  assert.ok(asst1.tables && asst1.tables.length > 0);
  assert.equal(asst1.tables![0].length, 3); // Header + 2 rows

  // Turn 2: User follow-up
  assert.equal(conv.messages[2].role, 'user');

  // Turn 3: Assistant formula
  assert.equal(conv.messages[3].role, 'assistant');
});

test('Adapter 2: Claude Adapter (Claude 3.7 Sonnet thinking & isolated Artifacts)', async () => {
  const dom = loadFixture('claude.fixture.html', 'https://claude.ai/chat/arch-visualizer-99');
  setupDomGlobals(dom);

  const adapter = new ClaudeAdapter();
  assert.equal(adapter.matches('https://claude.ai/chat/arch-visualizer-99'), true);
  assert.equal(adapter.matches('https://chatgpt.com'), false);

  const conv = await adapter.extractConversation();

  assert.equal(conv.platform, 'claude');
  assert.equal(conv.title, 'Full Stack Architecture & Visualizer');
  assert.equal(conv.messages.length, 2);

  // User message
  assert.equal(conv.messages[0].role, 'user');
  assert.ok(conv.messages[0].contentText.includes('system architecture diagram in SVG'));

  // Claude message
  const claudeMsg = conv.messages[1];
  assert.equal(claudeMsg.role, 'assistant');
  assert.equal(claudeMsg.author, 'Claude');
  assert.ok(claudeMsg.reasoning?.includes('generate clean, self-contained SVG vectors'));

  // Artifacts extraction verification
  assert.ok(claudeMsg.artifacts && claudeMsg.artifacts.length === 2);
  const svgArt = claudeMsg.artifacts![0];
  assert.equal(svgArt.type, 'svg');
  assert.ok(svgArt.title.includes('System Architecture Diagram'));
  assert.ok(svgArt.content.includes('<svg'));

  const reactArt = claudeMsg.artifacts![1];
  assert.equal(reactArt.type, 'react');
  assert.ok(reactArt.title.includes('UserProfileCard.tsx'));
  assert.ok(reactArt.content.includes('interface UserProfileProps'));
});

test('Adapter 3: Perplexity Adapter (Web citations & Academic Bibliography)', async () => {
  const dom = loadFixture('perplexity.fixture.html', 'https://www.perplexity.ai/search/nuclear-fusion-2026');
  setupDomGlobals(dom);

  const adapter = new PerplexityAdapter();
  assert.equal(adapter.matches('https://www.perplexity.ai/search/abc'), true);
  assert.equal(adapter.matches('https://deepseek.com'), false);

  const conv = await adapter.extractConversation();

  assert.equal(conv.platform, 'perplexity');
  assert.equal(conv.title, 'Latest Advances in Nuclear Fusion 2026');
  assert.equal(conv.messages.length, 2);

  // Assistant message citations verification
  const pplxMsg = conv.messages[1];
  assert.equal(pplxMsg.role, 'assistant');
  assert.ok(pplxMsg.citations && pplxMsg.citations.length === 2);

  assert.equal(pplxMsg.citations![0].index, 1);
  assert.equal(pplxMsg.citations![0].title, 'Ignition Energy Gain at NIF');
  assert.equal(pplxMsg.citations![0].url, 'https://nature.com/articles/fusion-breakthrough-2026');
  assert.equal(pplxMsg.citations![0].siteName, 'nature.com');

  assert.equal(pplxMsg.citations![1].index, 2);
  assert.equal(pplxMsg.citations![1].title, 'SPARC High-Field Magnet Testing');
  assert.equal(pplxMsg.citations![1].siteName, 'news.mit.edu');

  assert.ok(pplxMsg.tables && pplxMsg.tables.length === 1);
});

test('Adapter 4: DeepSeek Adapter (<think> reasoning extraction & tables)', async () => {
  const dom = loadFixture('deepseek.fixture.html', 'https://chat.deepseek.com/c/crypto-benchmark');
  setupDomGlobals(dom);

  const adapter = new DeepSeekAdapter();
  assert.equal(adapter.matches('https://chat.deepseek.com/c/123'), true);
  assert.equal(adapter.matches('https://gemini.google.com'), false);

  const conv = await adapter.extractConversation();

  assert.equal(conv.platform, 'deepseek');
  assert.equal(conv.title, 'Asymmetric Cryptography Architecture');
  assert.equal(conv.messages.length, 2);

  const dsMsg = conv.messages[1];
  assert.equal(dsMsg.role, 'assistant');
  assert.equal(dsMsg.author, 'DeepSeek');
  assert.ok(dsMsg.reasoning?.includes('Curve25519 Twisted Edwards curve'));

  assert.ok(dsMsg.tables && dsMsg.tables.length === 1);
  assert.equal(dsMsg.tables![0].length, 3); // Header + 2 rows
  assert.equal(dsMsg.codeBlocks.length, 1);
  assert.equal(dsMsg.codeBlocks[0].language, 'typescript');
});

test('Adapter 5: Google Gemini Adapter (custom tags, model detection & menu filtering)', async () => {
  const dom = loadFixture('gemini.fixture.html', 'https://gemini.google.com/app/consensus-raft');
  setupDomGlobals(dom);

  const adapter = new GeminiAdapter();
  assert.equal(adapter.matches('https://gemini.google.com/app/123'), true);
  assert.equal(adapter.matches('https://chatgpt.com'), false);

  const conv = await adapter.extractConversation();

  assert.equal(conv.platform, 'gemini');
  assert.equal(conv.title, 'Distributed Consensus Protocols');
  assert.equal(conv.model, 'Gemini 2.0 Flash Thinking');
  assert.equal(conv.messages.length, 2);

  // User query
  assert.equal(conv.messages[0].role, 'user');
  assert.ok(conv.messages[0].contentText.includes('leader election works in the Raft'));

  // Gemini model response
  const geminiMsg = conv.messages[1];
  assert.equal(geminiMsg.role, 'assistant');
  assert.ok(geminiMsg.reasoning?.includes('Randomized election timeouts'));

  // Check that floating menus & action buttons were stripped
  assert.equal(geminiMsg.contentText.includes('Switch Mode'), false, 'Must filter out bard-mode-menu');
  assert.equal(geminiMsg.contentText.includes('Settings'), false, 'Must filter out mat-menu');
  assert.equal(geminiMsg.contentText.includes('Copy Code'), false, 'Must filter out copy button text');

  assert.ok(geminiMsg.tables && geminiMsg.tables.length === 1);
  assert.equal(geminiMsg.codeBlocks.length, 1);
  assert.equal(geminiMsg.codeBlocks[0].language, 'go');
});

test('Adapter 6: Fallback Adapter (generic web pages)', async () => {
  const dom = new JSDOM('<html><head><title>Generic Documentation</title></head><body><main><h1>Docs</h1><p>Documentation text content.</p></main></body></html>', {
    url: 'https://developer.mozilla.org/en-US/docs/Web'
  });
  setupDomGlobals(dom);

  const adapter = new FallbackAdapter();
  assert.equal(adapter.matches('https://developer.mozilla.org'), true);

  const conv = await adapter.extractConversation();
  assert.equal(conv.platform, 'unknown');
  assert.equal(conv.title, 'Generic Documentation');
  assert.equal(conv.messages.length, 1);
  assert.ok(conv.messages[0].contentText.includes('Documentation text content'));
});

test('Adapter 7: Stress & Edge Case Extraction (Streaming Cursors & Long Threads)', async () => {
  const dom = loadFixture('stress-conversation.fixture.html', 'https://chatgpt.com/c/stress-999');
  setupDomGlobals(dom);

  // Dynamically expand conversation thread to 50 turns in DOM
  const mainEl = dom.window.document.getElementById('chat-thread')!;
  for (let i = 2; i < 50; i++) {
    const isUser = i % 2 === 0;
    const article = dom.window.document.createElement('article');
    article.setAttribute('data-testid', `conversation-turn-${i}`);
    article.setAttribute('data-message-author-role', isUser ? 'user' : 'assistant');

    const msgDiv = dom.window.document.createElement('div');
    msgDiv.setAttribute('data-message-id', `stress-msg-${i}`);

    if (isUser) {
      msgDiv.innerHTML = `<p>Stress question prompt turn #${i}</p>`;
    } else {
      msgDiv.innerHTML = `<div class="markdown"><p>Stress response turn #${i} with table:</p><table><tr><th>Metric</th><th>Val</th></tr><tr><td>Iter</td><td>${i}</td></tr></table></div>`;
    }
    article.appendChild(msgDiv);
    mainEl.appendChild(article);
  }

  const adapter = new ChatGPTAdapter();
  const conv = await adapter.extractConversation();

  assert.equal(conv.messages.length, 50, 'Must extract all 50 turns without dropping nodes');
  // First assistant turn had unclosed code block and streaming cursor █
  const firstAsst = conv.messages[1];
  assert.equal(firstAsst.contentText.includes('█'), false, 'Must strip streaming cursor character');
  assert.equal(firstAsst.codeBlocks.length, 1);
});
