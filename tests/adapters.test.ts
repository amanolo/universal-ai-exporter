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
import { MarkdownExporter } from '../src/core/exporters/markdown-exporter';

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

test('Adapter 8: Multimodal Image Turns in Gemini (User Uploads & AI Generated Images)', async () => {
  const multimodalHtml = `
    <html>
    <head><title>Cyberpunk Art Generation - Gemini</title></head>
    <body>
      <div class="conversation-turn user">
        <user-query>
          <div role="button" class="image-thumbnail">
            <img src="https://lh3.googleusercontent.com/user-uploaded-face.png" alt="User Photo" width="200" height="200" />
          </div>
          <p>Κάνε εμένα σαν έναν cyberpunk ήρωα.</p>
        </user-query>
      </div>
      <div class="conversation-turn model">
        <model-response>
          <div class="generated-image-container">
            <img src="https://lh3.googleusercontent.com/cyberpunk-result.png" alt="Cyberpunk Artwork" width="800" height="800" />
          </div>
        </model-response>
      </div>
    </body>
    </html>
  `;
  const dom = new JSDOM(multimodalHtml, { url: 'https://gemini.google.com/app/cyberpunk-123' });
  setupDomGlobals(dom);

  const adapter = new GeminiAdapter();
  const conv = await adapter.extractConversation();

  assert.equal(conv.messages.length, 2, 'Must extract both user prompt and visual-only response');

  // User turn
  const userTurn = conv.messages[0];
  assert.equal(userTurn.role, 'user');
  assert.ok(userTurn.contentText.includes('Κάνε εμένα σαν έναν cyberpunk ήρωα.'));
  assert.ok(userTurn.images && userTurn.images.length === 1);
  assert.equal(userTurn.images![0], 'https://lh3.googleusercontent.com/user-uploaded-face.png');

  // AI turn (pure image response)
  const aiTurn = conv.messages[1];
  assert.equal(aiTurn.role, 'assistant');
  assert.ok(aiTurn.images && aiTurn.images.length === 1);
  assert.equal(aiTurn.images![0], 'https://lh3.googleusercontent.com/cyberpunk-result.png');
});

test('Adapter 8b: Gemini 4-Turn Multimodal Isolation (User Upload in Turn 1, Generated Sunshine in Turn 4)', async () => {
  const fourTurnHtml = `
    <html>
    <head><title>B2B AI Lead Enrichment Suite Graphic - Google Gemini</title></head>
    <body>
      <div class="conversation-container">
        <!-- Turn 1: User with uploaded image -->
        <div class="conversation-turn user">
          <user-query>
            <div class="image-preview">
              <img src="https://lh3.googleusercontent.com/gg/user_b2b_graphic.png" alt="Uploaded graphic" width="400" height="300" />
            </div>
            <p>What is in this picture?</p>
          </user-query>
        </div>
        <!-- Turn 2: Gemini text explanation -->
        <div class="conversation-turn model">
          <model-response>
            <p>This image is a promotional graphic for B2B AI Lead Enrichment Suite.</p>
          </model-response>
        </div>
        <!-- Turn 3: User text prompt requesting image -->
        <div class="conversation-turn user">
          <user-query>
            <p>generate a sunshine image</p>
          </user-query>
        </div>
        <!-- Turn 4: Gemini generated sunshine image -->
        <div class="conversation-turn model">
          <model-response>
            <div class="generated-image">
              <img src="https://lh3.googleusercontent.com/gg/generated_sunshine.png" alt="Sunshine" width="1024" height="1024" />
            </div>
          </model-response>
        </div>
      </div>
    </body>
    </html>
  `;
  const dom = new JSDOM(fourTurnHtml, { url: 'https://gemini.google.com/app/b2b-suite' });
  setupDomGlobals(dom);

  const adapter = new GeminiAdapter();
  const conv = await adapter.extractConversation();

  assert.equal(conv.messages.length, 4, 'Must extract all 4 turns');

  // Turn 1 (User upload): exactly 1 image
  assert.equal(conv.messages[0].images?.length, 1, 'Turn 1 must have user uploaded image');
  assert.equal(conv.messages[0].images![0], 'https://lh3.googleusercontent.com/gg/user_b2b_graphic.png');

  // Turn 2 (Gemini text): 0 images
  assert.equal(conv.messages[1].images?.length || 0, 0, 'Turn 2 must have 0 images');

  // Turn 3 (User text prompt): 0 images (must NOT inherit generated sunshine from Turn 4)
  assert.equal(conv.messages[2].images?.length || 0, 0, 'Turn 3 must have 0 images');

  // Turn 4 (Gemini generated sunshine): exactly 1 image
  assert.equal(conv.messages[3].images?.length, 1, 'Turn 4 must have exactly 1 generated sunshine image');
  assert.equal(conv.messages[3].images![0], 'https://lh3.googleusercontent.com/gg/generated_sunshine.png');

  // Verify Markdown export output for all 4 turns
  const mdExporter = new MarkdownExporter();
  const md = mdExporter.exportToMarkdown(conv, { format: 'markdown', includeImages: true });
  assert.ok(md.includes('https://lh3.googleusercontent.com/gg/user_b2b_graphic.png'), 'Markdown must include Turn 1 user upload');
  assert.ok(md.includes('https://lh3.googleusercontent.com/gg/generated_sunshine.png'), 'Markdown must include Turn 4 generated sunshine');
  assert.equal(md.includes('*[AI Generated Visual]*'), false, 'Markdown must not show placeholder when image URL exists');
});

test('Adapter 9: Multimodal Image Turns and Noise Stripping in ChatGPT (DALL-E Generations)', async () => {
  const chatgptImageHtml = `
    <html>
    <head><title>Generate Cyberpunk Skyline - ChatGPT</title></head>
    <body>
      <main>
        <article data-testid="conversation-turn-0" data-message-author-role="user">
          <div data-message-id="user-img-1">
            <h4 class="sr-only">You said:</h4>
            <p>Generate a futuristic cyberpunk skyline</p>
          </div>
        </article>
        <article data-testid="conversation-turn-1" data-message-author-role="assistant">
          <div data-message-id="asst-img-1">
            <h4 class="sr-only">ChatGPT said:</h4>
            <div class="image-wrapper">
              <button aria-label="Edit image">
                <img src="https://chatgpt.com/backend-api/estuary/content?id=file_0001&ts=100&sig=abc" alt="Generated image: Neon Rain Over Future City" width="512" height="512" />
              </button>
              <div class="image-actions">
                <button>Edit</button>
                <button>Download</button>
              </div>
            </div>
          </div>
        </article>
      </main>
    </body>
    </html>
  `;
  const dom = new JSDOM(chatgptImageHtml, { url: 'https://chatgpt.com/c/skyline-123' });
  setupDomGlobals(dom);

  const adapter = new ChatGPTAdapter();
  const conv = await adapter.extractConversation();

  assert.equal(conv.messages.length, 2);

  const asstMsg = conv.messages[1];
  assert.equal(asstMsg.role, 'assistant');
  assert.equal(asstMsg.images?.length, 1, 'Should extract exactly 1 deduplicated image URL');
  assert.equal(asstMsg.images![0], 'https://chatgpt.com/backend-api/estuary/content?id=file_0001&ts=100&sig=abc');

  // Verify UI noise ("ChatGPT said:" and "Edit") is stripped
  assert.equal(asstMsg.contentText.includes('ChatGPT said:'), false, 'Must strip ChatGPT said header');
  assert.equal(asstMsg.contentText.includes('Edit'), false, 'Must strip Edit button');
  assert.equal(asstMsg.contentText.includes('Download'), false, 'Must strip Download button');
});

test('Adapter 10: User Uploaded Images & Parent-Child De-nesting in ChatGPT', async () => {
  const userUploadHtml = `
    <html>
    <head><title>Describe picture contents - ChatGPT</title></head>
    <body>
      <main>
        <!-- Parent article containing both uploaded image thumbnail and inner user div -->
        <article data-testid="conversation-turn-0">
          <div class="user-turn-container">
            <div class="image-preview">
              <img src="https://chatgpt.com/backend-api/estuary/content?id=file_user_upload&ts=100&sig=abc" alt="gumroad_thumbnail.png" width="300" height="200" />
            </div>
            <!-- Nested child with data-message-author-role -->
            <div data-message-author-role="user" data-message-id="msg-u1">
              <p>What is in this picture?</p>
            </div>
          </div>
        </article>

        <!-- Parent article for assistant response -->
        <article data-testid="conversation-turn-1">
          <div class="asst-turn-container">
            <!-- Nested child with data-message-author-role -->
            <div data-message-author-role="assistant" data-message-id="msg-a1">
              <p>The picture is a dark, futuristic promotional graphic.</p>
            </div>
          </div>
        </article>
      </main>
    </body>
    </html>
  `;
  const dom = new JSDOM(userUploadHtml, { url: 'https://chatgpt.com/c/describe-123' });
  setupDomGlobals(dom);

  const adapter = new ChatGPTAdapter();
  const conv = await adapter.extractConversation();

  // Must extract EXACTLY 2 turns (1 User, 1 ChatGPT), NOT 4 turns!
  assert.equal(conv.messages.length, 2, 'Must extract exactly 2 turns without parent-child duplication');

  // Turn 0: User with uploaded image
  const userTurn = conv.messages[0];
  assert.equal(userTurn.role, 'user');
  assert.ok(userTurn.contentText.includes('What is in this picture?'));
  assert.equal(userTurn.images?.length, 1);
  assert.equal(userTurn.images![0], 'https://chatgpt.com/backend-api/estuary/content?id=file_user_upload&ts=100&sig=abc');

  // Turn 1: Assistant response
  const asstTurn = conv.messages[1];
  assert.equal(asstTurn.role, 'assistant');
  assert.ok(asstTurn.contentText.includes('The picture is a dark, futuristic promotional graphic.'));
});

test('Adapter 11: Claude User Image Attachments & Accessibility Noise Removal', async () => {
  const claudeImageHtml = `
    <html>
    <head><title>Image identification request - Claude</title></head>
    <body>
      <main>
        <!-- User turn group containing attachment and text -->
        <div class="ChatMessage_container group/quip user-turn">
          <div class="attachment-wrapper">
            <button aria-label="Attachment thumbnail">
              <img src="https://claude.ai/api/attachments/gumroad_thumbnail.png" alt="gumroad_thumbnail.png" width="200" height="200" />
            </button>
          </div>
          <div data-testid="user-message" class="font-user-message">
            <p>What is in this picture?</p>
          </div>
        </div>

        <!-- Claude assistant turn container -->
        <div class="ChatMessage_container group/quip font-claude-message">
          <h2 class="sr-only">Claude responded: This is a Gumroad-style product thumbnail/promo graphic</h2>
          <div class="prose">
            <p>This is a Gumroad-style product thumbnail/promo graphic for a Google Sheets template product.</p>
          </div>
        </div>
      </main>
    </body>
    </html>
  `;
  const dom = new JSDOM(claudeImageHtml, { url: 'https://claude.ai/chat/img-123' });
  setupDomGlobals(dom);

  const adapter = new ClaudeAdapter();
  const conv = await adapter.extractConversation();

  assert.equal(conv.messages.length, 2);

  // User turn
  const userMsg = conv.messages[0];
  assert.equal(userMsg.role, 'user');
  assert.ok(userMsg.contentText.includes('What is in this picture?'));
  assert.equal(userMsg.images?.length, 1, 'Must extract user uploaded image attachment');
  assert.equal(userMsg.images![0], 'https://claude.ai/api/attachments/gumroad_thumbnail.png');

  // Assistant turn
  const asstMsg = conv.messages[1];
  assert.equal(asstMsg.role, 'assistant');
  assert.equal(asstMsg.contentText.includes('Claude responded:'), false, 'Must strip Claude responded accessibility heading');
  assert.ok(asstMsg.contentText.includes('This is a Gumroad-style product thumbnail'));
});

test('Adapter 12: Claude Visual SVG Graphics & Tool Noise Stripping (Sunshine Graphic)', async () => {
  const claudeSunshineHtml = `
    <html>
    <head><title>Create a sunshine pic - Claude</title></head>
    <body>
      <main>
        <!-- User turn -->
        <div data-testid="user-message" class="font-user-message">
          <p>create a sunshine pic plz</p>
        </div>

        <!-- Assistant turn with visualize show_widget tool call and SVG illustration -->
        <div class="font-claude-message">
          <div class="tool-call-widget">
            <button aria-label="Toggle widget">v</button>
            <button>visualize</button>
            <span>visualize show_widget</span>
          </div>
          <div class="visual-canvas-container">
            <svg viewBox="0 0 500 300" width="500" height="300" xmlns="http://www.w3.org/2000/svg">
              <rect width="500" height="300" fill="#87CEEB" />
              <circle cx="250" cy="150" r="60" fill="#FFD700" />
            </svg>
          </div>
          <p>Here's a bright sunshine scene for you ☀️</p>
        </div>
      </main>
    </body>
    </html>
  `;
  const dom = new JSDOM(claudeSunshineHtml, { url: 'https://claude.ai/chat/sunshine-123' });
  setupDomGlobals(dom);

  const adapter = new ClaudeAdapter();
  const conv = await adapter.extractConversation();

  assert.equal(conv.messages.length, 2);

  const asstMsg = conv.messages[1];
  assert.equal(asstMsg.role, 'assistant');
  assert.equal(asstMsg.contentText.includes('visualize show_widget'), false, 'Must strip tool call header');
  assert.equal(asstMsg.contentText.includes('visualize'), false, 'Must strip visualize button');
  assert.ok(asstMsg.contentText.includes("Here's a bright sunshine scene for you"));

  // Check SVG artifact extraction
  assert.ok(asstMsg.artifacts && asstMsg.artifacts.length >= 1, 'Must extract SVG graphic as artifact');
  assert.equal(asstMsg.artifacts![0].type, 'svg');
  assert.ok(asstMsg.artifacts![0].content.includes('<svg'));
});

test('Adapter 13: Claude Sandboxed Iframe Visual Widget (Sunshine SVG in Iframe srcdoc)', async () => {
  const claudeIframeWidgetHtml = `
    <html>
    <head><title>Create a sunshine pic - Claude</title></head>
    <body>
      <main>
        <div data-testid="user-message" class="font-user-message">
          <p>create a sunshine pic plz</p>
        </div>

        <div class="font-claude-message">
          <details>
            <summary>V</summary>
            <div>visualize show_widget</div>
          </details>
          <div class="widget-frame-wrapper">
            <iframe sandbox="allow-scripts" srcdoc="&lt;!DOCTYPE html&gt;&lt;html&gt;&lt;body&gt;&lt;svg viewBox=&quot;0 0 500 300&quot; width=&quot;500&quot; height=&quot;300&quot;&gt;&lt;rect width=&quot;500&quot; height=&quot;300&quot; fill=&quot;#87CEEB&quot;/&gt;&lt;circle cx=&quot;250&quot; cy=&quot;150&quot; r=&quot;60&quot; fill=&quot;#FFD700&quot;/&gt;&lt;/svg&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>
          </div>
          <p>Here's a bright sunshine scene for you ☀️</p>
        </div>
      </main>
    </body>
    </html>
  `;
  const dom = new JSDOM(claudeIframeWidgetHtml, { url: 'https://claude.ai/chat/iframe-sunshine' });
  setupDomGlobals(dom);

  const adapter = new ClaudeAdapter();
  const conv = await adapter.extractConversation();

  assert.equal(conv.messages.length, 2);

  const asstMsg = conv.messages[1];
  assert.equal(asstMsg.role, 'assistant');
  assert.equal(asstMsg.contentText.includes('visualize show_widget'), false);
  assert.equal(asstMsg.contentText.includes('V\n'), false);
  assert.ok(asstMsg.contentText.includes("Here's a bright sunshine scene for you"));

  // Check SVG extracted from iframe srcdoc
  assert.ok(asstMsg.artifacts && asstMsg.artifacts.length >= 1, 'Must extract SVG graphic from iframe srcdoc');
  assert.equal(asstMsg.artifacts![0].type, 'svg');
  assert.ok(asstMsg.artifacts![0].content.includes('<svg'));
});

test('Adapter 14: Claude Tool Payload SVG extraction (widget_code vector SVG in tool call)', async () => {
  const claudeToolPayloadHtml = `
    <html>
    <head><title>Create a sunshine pic - Claude</title></head>
    <body>
      <main>
        <div data-testid="user-message" class="font-user-message">
          <p>create a sunshine pic plz</p>
        </div>

        <div class="font-claude-message">
          <button aria-label="View request/response">View request/response</button>
          <pre><code class="language-javascript">{\n  "loading_messages": ["Painting the sky"],\n  "title": "sunshine_illustration",\n  "widget_code": "<svg width='100%' viewBox='0 0 680 480' xmlns='http://www.w3.org/2000/svg'><rect width='680' height='480' fill='#4fb8ea'/><circle cx='340' cy='160' r='90' fill='#ffd23f'/></svg>"\n}</code></pre>
          <pre><code class="language-json">Content rendered and shown to the user.</code></pre>
          <p>Here's a bright sunshine scene for you ☀️</p>
        </div>
      </main>
    </body>
    </html>
  `;
  const dom = new JSDOM(claudeToolPayloadHtml, { url: 'https://claude.ai/chat/tool-sunshine' });
  setupDomGlobals(dom);

  const adapter = new ClaudeAdapter();
  const conv = await adapter.extractConversation();

  assert.equal(conv.messages.length, 2);

  const asstMsg = conv.messages[1];
  assert.equal(asstMsg.role, 'assistant');
  assert.equal(asstMsg.contentText.includes('widget_code'), false, 'Must strip raw tool payload JSON from text');
  assert.equal(asstMsg.contentText.includes('Content rendered'), false, 'Must strip tool response text');
  assert.ok(asstMsg.contentText.includes("Here's a bright sunshine scene for you"));

  // Check SVG extracted from widget_code payload
  assert.ok(asstMsg.artifacts && asstMsg.artifacts.length >= 1, 'Must extract SVG from widget_code');
  assert.equal(asstMsg.artifacts![0].type, 'svg');
  assert.equal(asstMsg.artifacts![0].title, 'Sunshine illustration');
  assert.ok(asstMsg.artifacts![0].content.includes('<svg'));
  assert.ok(asstMsg.artifacts![0].content.includes('fill="#ffd23f"'));
});






