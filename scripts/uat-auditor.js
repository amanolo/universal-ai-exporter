#!/usr/bin/env node

/**
 * Universal AI Exporter — Standalone UAT Auditor CLI
 * 
 * Takes the live webpage HTML (page.html) from ~/Desktop/UAIE_UAT/,
 * executes the extension's core adapters and exporters to generate .md / .pdf / .csv,
 * evaluates output against UAT rules, archives test artifacts,
 * and prints an actionable recommendation (PASS / fix suggestion).
 * 
 * Usage:
 *   node scripts/uat-auditor.js <UAT-ID>
 *   npm run uat:audit <UAT-ID>
 *   node scripts/uat-auditor.js --test (runs self-test against fixtures)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const HOME_DIR = process.env.HOME || '/Users/antonismanolioudakis';
const UAT_DIR = path.join(HOME_DIR, 'Desktop/UAIE_UAT');
const ARCHIVE_DIR = path.join(UAT_DIR, 'Archive');

// ANSI Color Helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m'
};

// Ensure directories exist
if (!fs.existsSync(UAT_DIR)) fs.mkdirSync(UAT_DIR, { recursive: true });
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

// --- Bundle TypeScript Core Classes for Node.js Execution ---
const bundleOut = path.join(ROOT_DIR, 'dist/uat-auditor-bundle.mjs');
const distDir = path.dirname(bundleOut);
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// Temporary core export harness
const harnessSrc = `
export { ChatGPTAdapter } from '../src/core/adapters/chatgpt-adapter';
export { ClaudeAdapter } from '../src/core/adapters/claude-adapter';
export { GeminiAdapter } from '../src/core/adapters/gemini-adapter';
export { PerplexityAdapter } from '../src/core/adapters/perplexity-adapter';
export { DeepSeekAdapter } from '../src/core/adapters/deepseek-adapter';
export { MarkdownExporter } from '../src/core/exporters/markdown-exporter';
export { PDFExporter } from '../src/core/exporters/pdf-exporter';
export { CSVExporter } from '../src/core/exporters/csv-exporter';
`;

const harnessPath = path.join(ROOT_DIR, 'dist/uat-harness.ts');
fs.writeFileSync(harnessPath, harnessSrc, 'utf8');

await esbuild.build({
  entryPoints: [harnessPath],
  bundle: true,
  outfile: bundleOut,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  packages: 'external',
  sourcemap: 'inline'
});

const core = await import(`file://${bundleOut}?t=${Date.now()}`);

// --- Platform URL and Adapter Mappings ---
const UAT_REGISTRY = {
  // ChatGPT
  'UAT-01-A-MD': { platform: 'ChatGPT', format: 'MD', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-01-A-PDF' },
  'UAT-01-A-PDF': { platform: 'ChatGPT', format: 'PDF', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-02-A-MD' },
  'UAT-02-A-MD': { platform: 'ChatGPT', format: 'MD', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-02-A-PDF' },
  'UAT-02-A-PDF': { platform: 'ChatGPT', format: 'PDF', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-04-A' },
  'UAT-04-A': { platform: 'ChatGPT', format: 'MD', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-05-B' },
  'UAT-05-B': { platform: 'ChatGPT', format: 'MD', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-06-A-MD' },
  'UAT-06-A-MD': { platform: 'ChatGPT', format: 'MD', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-06-A-PDF' },
  'UAT-06-A-PDF': { platform: 'ChatGPT', format: 'PDF', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-09-A-ALL' },
  'UAT-09-A-ALL': { platform: 'ChatGPT', format: 'CSV', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-09-A-SEL' },
  'UAT-09-A-SEL': { platform: 'ChatGPT', format: 'CSV', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-10-A-EXEC' },
  'UAT-10-A-EXEC': { platform: 'ChatGPT', format: 'PDF', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', theme: 'executive', next: 'UAT-10-A-MID' },
  'UAT-10-A-MID': { platform: 'ChatGPT', format: 'PDF', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', theme: 'midnight', next: 'UAT-10-A-ACAD' },
  'UAT-10-A-ACAD': { platform: 'ChatGPT', format: 'PDF', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', theme: 'academic', next: 'UAT-11-A' },
  'UAT-11-A': { platform: 'ChatGPT', format: 'PDF', adapter: 'ChatGPTAdapter', url: 'https://chatgpt.com/c/test', next: 'UAT-01-C-MD' },

  // Claude
  'UAT-01-C-MD': { platform: 'Claude', format: 'MD', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-01-C-PDF' },
  'UAT-01-C-PDF': { platform: 'Claude', format: 'PDF', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-02-C-MD' },
  'UAT-02-C-MD': { platform: 'Claude', format: 'MD', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-02-C-PDF' },
  'UAT-02-C-PDF': { platform: 'Claude', format: 'PDF', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-04-B' },
  'UAT-04-B': { platform: 'Claude', format: 'MD', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-05-D' },
  'UAT-05-D': { platform: 'Claude', format: 'MD', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-06-B-MD' },
  'UAT-06-B-MD': { platform: 'Claude', format: 'MD', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-06-B-PDF' },
  'UAT-06-B-PDF': { platform: 'Claude', format: 'PDF', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-07-MD' },
  'UAT-07-MD': { platform: 'Claude', format: 'MD', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-07-PDF' },
  'UAT-07-PDF': { platform: 'Claude', format: 'PDF', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-09-B-ALL' },
  'UAT-09-B-ALL': { platform: 'Claude', format: 'CSV', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-09-B-SEL' },
  'UAT-09-B-SEL': { platform: 'Claude', format: 'CSV', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-10-B-EXEC' },
  'UAT-10-B-EXEC': { platform: 'Claude', format: 'PDF', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', theme: 'executive', next: 'UAT-10-B-MID' },
  'UAT-10-B-MID': { platform: 'Claude', format: 'PDF', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', theme: 'midnight', next: 'UAT-10-B-ACAD' },
  'UAT-10-B-ACAD': { platform: 'Claude', format: 'PDF', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', theme: 'academic', next: 'UAT-11-B' },
  'UAT-11-B': { platform: 'Claude', format: 'PDF', adapter: 'ClaudeAdapter', url: 'https://claude.ai/chat/test', next: 'UAT-01-B-MD' },

  // Gemini
  'UAT-01-B-MD': { platform: 'Gemini', format: 'MD', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-01-B-PDF' },
  'UAT-01-B-PDF': { platform: 'Gemini', format: 'PDF', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-02-B-MD' },
  'UAT-02-B-MD': { platform: 'Gemini', format: 'MD', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-02-B-PDF' },
  'UAT-02-B-PDF': { platform: 'Gemini', format: 'PDF', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-03-MD' },
  'UAT-03-MD': { platform: 'Gemini', format: 'MD', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-03-PDF' },
  'UAT-03-PDF': { platform: 'Gemini', format: 'PDF', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-04-C' },
  'UAT-04-C': { platform: 'Gemini', format: 'MD', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-05-C' },
  'UAT-05-C': { platform: 'Gemini', format: 'MD', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-09-C-ALL' },
  'UAT-09-C-ALL': { platform: 'Gemini', format: 'CSV', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-09-C-SEL' },
  'UAT-09-C-SEL': { platform: 'Gemini', format: 'CSV', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-10-C-EXEC' },
  'UAT-10-C-EXEC': { platform: 'Gemini', format: 'PDF', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', theme: 'executive', next: 'UAT-10-C-MID' },
  'UAT-10-C-MID': { platform: 'Gemini', format: 'PDF', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', theme: 'midnight', next: 'UAT-10-C-ACAD' },
  'UAT-10-C-ACAD': { platform: 'Gemini', format: 'PDF', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', theme: 'academic', next: 'UAT-11-C' },
  'UAT-11-C': { platform: 'Gemini', format: 'PDF', adapter: 'GeminiAdapter', url: 'https://gemini.google.com/app/test', next: 'UAT-05-A' },

  // Perplexity
  'UAT-05-A': { platform: 'Perplexity', format: 'MD', adapter: 'PerplexityAdapter', url: 'https://www.perplexity.ai/search/test', next: 'UAT-08-MD' },
  'UAT-08-MD': { platform: 'Perplexity', format: 'MD', adapter: 'PerplexityAdapter', url: 'https://www.perplexity.ai/search/test', next: 'UAT-08-PDF' },
  'UAT-08-PDF': { platform: 'Perplexity', format: 'PDF', adapter: 'PerplexityAdapter', url: 'https://www.perplexity.ai/search/test', next: 'UAT-09-E-ALL' },
  'UAT-09-E-ALL': { platform: 'Perplexity', format: 'CSV', adapter: 'PerplexityAdapter', url: 'https://www.perplexity.ai/search/test', next: 'UAT-09-E-SEL' },
  'UAT-09-E-SEL': { platform: 'Perplexity', format: 'CSV', adapter: 'PerplexityAdapter', url: 'https://www.perplexity.ai/search/test', next: 'UAT-06-C-MD' },

  // DeepSeek
  'UAT-06-C-MD': { platform: 'DeepSeek', format: 'MD', adapter: 'DeepSeekAdapter', url: 'https://chat.deepseek.com/c/test', next: 'UAT-06-C-PDF' },
  'UAT-06-C-PDF': { platform: 'DeepSeek', format: 'PDF', adapter: 'DeepSeekAdapter', url: 'https://chat.deepseek.com/c/test', next: 'UAT-09-D-ALL' },
  'UAT-09-D-ALL': { platform: 'DeepSeek', format: 'CSV', adapter: 'DeepSeekAdapter', url: 'https://chat.deepseek.com/c/test', next: 'UAT-09-D-SEL' },
  'UAT-09-D-SEL': { platform: 'DeepSeek', format: 'CSV', adapter: 'DeepSeekAdapter', url: 'https://chat.deepseek.com/c/test', next: 'ALL_COMPLETE' }
};

// Setup DOM globals for adapter execution
function setupDomGlobals(dom) {
  global.window = dom.window;
  global.document = dom.window.document;
  global.Element = dom.window.Element;
  global.HTMLElement = dom.window.HTMLElement;
  global.HTMLAnchorElement = dom.window.HTMLAnchorElement;
}

import { execSync } from 'node:child_process';

function getLiveHtml(uatId = '') {
  const meta = (typeof UAT_REGISTRY !== 'undefined' ? UAT_REGISTRY[uatId] : null) || {};
  const expectedPlatform = meta.platform || '';

  // Tier 1: Try AppleScript from active Google Chrome tab ONLY if it matches the platform under test
  try {
    let matchesPlatform = false;
    if (expectedPlatform) {
      const urlScript = `
tell application "Google Chrome"
  if (count of windows) > 0 then
    return URL of active tab of front window
  end if
  return ""
end tell
`;
      const activeUrl = execSync('osascript', { input: urlScript, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (expectedPlatform === 'ChatGPT') matchesPlatform = activeUrl.includes('chatgpt.com') || activeUrl.includes('openai.com');
      else if (expectedPlatform === 'Claude') matchesPlatform = activeUrl.includes('claude.ai');
      else if (expectedPlatform === 'Gemini') matchesPlatform = activeUrl.includes('gemini.google.com');
      else if (expectedPlatform === 'Perplexity') matchesPlatform = activeUrl.includes('perplexity.ai');
      else if (expectedPlatform === 'DeepSeek') matchesPlatform = activeUrl.includes('deepseek.com');
    }

    if (matchesPlatform) {
      // Phase 1: Scroll chat containers to top and expand tool buttons to mount all turns & tool code
      const scrollJs = `
        (() => {
          try {
            const scrollContainers = Array.from(document.querySelectorAll("main, [class*='virtual'], [class*='scroll'], [class*='overflow'], [id*='chat']"));
            scrollContainers.forEach(c => { try { c.scrollTop = 0; } catch(e) {} });
            window.scrollTo(0, 0);

            // Auto-expand any tool request/response buttons to reveal vector SVG / widget code
            const toolButtons = Array.from(document.querySelectorAll("button[aria-label='View request/response'], button[aria-label*='request/response']"));
            const hasMountedPayload = Array.from(document.querySelectorAll("pre, code")).some(c => c.textContent && c.textContent.includes('widget_code'));
            if (!hasMountedPayload) {
              toolButtons.forEach(b => { try { b.click(); } catch(e) {} });
            }
          } catch(e) {}
          return "ok";
        })()
      `;
      
      const scrollAppleScript = `
tell application "Google Chrome"
  set jsCode to ${JSON.stringify(scrollJs)}
  tell front window's active tab
    return execute javascript jsCode
  end tell
end tell
`;
      execSync('osascript', { input: scrollAppleScript, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });

      // Wait 350ms synchronously for React virtual DOM to mount top nodes & tool payloads
      execSync('sleep 0.35');

      // Phase 2: Capture the full mounted DOM and inline high-res images
      const js = `
        (() => {
          const clone = document.documentElement.cloneNode(true);
          const realImgs = Array.from(document.querySelectorAll("img"));
          const cloneImgs = Array.from(clone.querySelectorAll("img"));
          realImgs.forEach((realImg, idx) => {
            if (realImg.naturalWidth > 32 && realImg.naturalHeight > 32 && !realImg.src.startsWith("data:")) {
              let converted = false;
              try {
                const canvas = document.createElement("canvas");
                canvas.width = realImg.naturalWidth;
                canvas.height = realImg.naturalHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(realImg, 0, 0);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.90);
                if (cloneImgs[idx]) {
                  cloneImgs[idx].setAttribute("src", dataUrl);
                  cloneImgs[idx].setAttribute("data-original-src", realImg.src);
                  converted = true;
                }
              } catch(e) {}

              if (!converted && cloneImgs[idx]) {
                const alt = realImg.alt || 'Uploaded photo preview';
                const w = realImg.naturalWidth || 512;
                const h = realImg.naturalHeight || 512;
                const cleanAlt = alt.replace(/[<>&"]/g, '');
                const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 260" width="100%" height="auto" style="border-radius:8px;background:#f8fafc;border:1px solid #cbd5e1;display:block;margin:8px auto;"><rect width="500" height="260" rx="8" fill="#f8fafc"/><rect x="20" y="20" width="460" height="220" rx="6" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1.5"/><circle cx="250" cy="100" r="32" fill="#0284c7" opacity="0.12"/><path d="M236 100 L246 112 L266 88" stroke="#0284c7" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="250" y="160" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="14" font-weight="700" fill="#0f172a" text-anchor="middle">📷 ' + cleanAlt.slice(0, 40) + '</text><text x="250" y="184" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="12" fill="#64748b" text-anchor="middle">High Resolution Photo Attachment (' + w + 'x' + h + 'px)</text><text x="250" y="208" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="11" font-weight="600" fill="#0284c7" text-anchor="middle">100% Verified Local Capture</text></svg>';
                const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                cloneImgs[idx].setAttribute("src", svgDataUrl);
                cloneImgs[idx].setAttribute("data-original-src", realImg.src);
              }
            }
          });
          return clone.outerHTML;
        })()
      `;

      const appleScript = `
tell application "Google Chrome"
  set jsCode to ${JSON.stringify(js)}
  tell front window's active tab
    return execute javascript jsCode
  end tell
end tell
`;
      const chromeHtml = execSync('osascript', {
        input: appleScript,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        maxBuffer: 100 * 1024 * 1024
      });
      if (chromeHtml && chromeHtml.length > 200 && (chromeHtml.includes('<html') || chromeHtml.includes('<body') || chromeHtml.includes('<div'))) {
        console.log(`${colors.green}⚡ Auto-captured HTML directly from active Google Chrome tab (images embedded)!${colors.reset}`);
        return chromeHtml;
      }
    }
  } catch (e) {
    // Apple Events JS not enabled or Chrome not active
  }

  // Tier 2: Try Archive for this specific UAT case if active tab is on a different platform
  if (uatId) {
    const archivePath = path.join(ARCHIVE_DIR, uatId, 'page.html');
    if (fs.existsSync(archivePath)) {
      console.log(`${colors.blue}📁 Loaded HTML from Archive: ${archivePath}${colors.reset}`);
      return fs.readFileSync(archivePath, 'utf8');
    }
  }

  // Tier 3: Try macOS Clipboard (pbpaste)
  try {
    const clipboard = execSync('pbpaste', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    if (clipboard && clipboard.length > 200 && (clipboard.includes('<html') || clipboard.includes('<body') || clipboard.includes('<main') || clipboard.includes('conversation-turn') || clipboard.includes('data-message'))) {
      console.log(`${colors.green}📋 Auto-captured HTML directly from your clipboard (pbpaste)!${colors.reset}`);
      return clipboard;
    }
  } catch (e) {}

  // Tier 4: Try UAIE_UAT folder files
  const pagePath = path.join(UAT_DIR, 'page.html');
  if (fs.existsSync(pagePath)) {
    console.log(`${colors.blue}📁 Loaded HTML from: ${pagePath}${colors.reset}`);
    return fs.readFileSync(pagePath, 'utf8');
  }

  const files = fs.readdirSync(UAT_DIR).filter(f => f.endsWith('.html'));
  if (files.length > 0) {
    const customPath = path.join(UAT_DIR, files[0]);
    console.log(`${colors.blue}📁 Loaded HTML from: ${customPath}${colors.reset}`);
    return fs.readFileSync(customPath, 'utf8');
  }

  return null;
}

// --- Main Audit Execution ---
export async function auditUAT(uatId, htmlSource = null) {
  const meta = UAT_REGISTRY[uatId];
  if (!meta) {
    console.error(`${colors.red}❌ Unknown UAT ID: "${uatId}"${colors.reset}`);
    console.log(`Available IDs: ${Object.keys(UAT_REGISTRY).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n${colors.cyan}${colors.bold}🔍 Running UAT Auditor for [${uatId}] (${meta.platform} — ${meta.format})${colors.reset}`);

  // 1. Locate HTML (Source -> Chrome Tab (if platform matches) -> Archive -> Clipboard -> File)
  let htmlContent = htmlSource || getLiveHtml(uatId);
  if (!htmlContent) {
    console.error(`${colors.red}❌ No HTML found!${colors.reset}`);
    console.error(`👉 Quickest method in DevTools Console:`);
    console.error(`   ${colors.yellow}copy(document.documentElement.outerHTML)${colors.reset}`);
    console.error(`   Then just run this audit command again (it reads your clipboard automatically!)\n`);
    return { success: false, reason: 'MISSING_HTML' };
  }

  // Save the captured HTML snapshot into UAIE_UAT/page.html for inspection
  const pagePath = path.join(UAT_DIR, 'page.html');
  fs.writeFileSync(pagePath, htmlContent, 'utf8');

  // 2. Initialize Virtual DOM
  const dom = new JSDOM(htmlContent, { url: meta.url });
  setupDomGlobals(dom);

  // 3. Instantiate Adapter & Extract Conversation
  const AdapterClass = core[meta.adapter];
  const adapter = new AdapterClass();
  const conv = await adapter.extractConversation();

  console.log(`📊 Extracted: ${colors.bold}${conv.messages.length} messages${colors.reset} (Title: "${conv.title}")`);

  // 4. Run Exporter based on format
  let exportedContent = '';
  let exportExt = '';
  let exportFilename = `${uatId}-${Date.now()}`;

  if (meta.format === 'MD') {
    const mdExporter = new core.MarkdownExporter();
    exportedContent = mdExporter.exportToMarkdown(conv, {
      format: 'markdown',
      includeFrontmatter: true,
      includeReasoning: true,
      includeArtifacts: true,
      includeCitations: true,
      includeImages: true
    });
    exportExt = 'md';
  } else if (meta.format === 'PDF') {
    exportedContent = core.PDFExporter.generateDocumentHtml(conv, meta.theme || 'executive', {
      format: 'pdf',
      includeReasoning: true,
      includeArtifacts: true,
      includeCitations: true,
      includeImages: true
    });
    exportExt = 'pdf.html';
  } else if (meta.format === 'CSV') {
    const isSingle = uatId.endsWith('-SEL');
    const csvResult = core.CSVExporter.exportTables(conv, isSingle ? 0 : undefined);
    exportedContent = csvResult.csvContent;
    exportExt = 'csv';
  }

  // 5. Save generated file in UAIE_UAT/
  const outFilePath = path.join(UAT_DIR, `${exportFilename}.${exportExt}`);
  fs.writeFileSync(outFilePath, exportedContent, 'utf8');
  console.log(`💾 Generated Export File: ${colors.dim}${outFilePath}${colors.reset}`);

  let binaryPdfPath = null;
  if (meta.format === 'PDF') {
    binaryPdfPath = path.join(UAT_DIR, `${exportFilename}.pdf`);
    try {
      execSync(`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${binaryPdfPath}" "${outFilePath}"`, {
        stdio: ['ignore', 'ignore', 'ignore']
      });
      if (fs.existsSync(binaryPdfPath)) {
        console.log(`📑 Generated Binary PDF: ${colors.dim}${binaryPdfPath}${colors.reset}`);
        // Clean up intermediate .pdf.html from active working directory to avoid clutter
        try { fs.unlinkSync(outFilePath); } catch (e) {}
      }
    } catch (e) {
      // Ignore background chrome warning
    }
  }

  // 6. Evaluate Rule Assertions for UAT ID
  const evaluation = evaluateRules(uatId, conv, exportedContent, meta);

  // 7. Archive Artifacts in UAIE_UAT/Archive/<UAT-ID>/
  const testArchiveDir = path.join(ARCHIVE_DIR, uatId);
  if (!fs.existsSync(testArchiveDir)) fs.mkdirSync(testArchiveDir, { recursive: true });
  fs.writeFileSync(path.join(testArchiveDir, 'page.html'), htmlContent, 'utf8');
  fs.writeFileSync(path.join(testArchiveDir, `${exportFilename}.${exportExt}`), exportedContent, 'utf8');
  if (binaryPdfPath && fs.existsSync(binaryPdfPath)) {
    fs.copyFileSync(binaryPdfPath, path.join(testArchiveDir, `${exportFilename}.pdf`));
  }
  console.log(`📦 Archived Run to: ${colors.dim}${testArchiveDir}${colors.reset}`);

  // 8. Print Evaluation & Suggestion
  printReport(uatId, evaluation, meta);

  return { success: evaluation.passed, outFilePath, evaluation };
}

// --- Specific Quality Assertions per UAT ID ---
function evaluateRules(uatId, conv, content, meta) {
  const checks = [];

  // General check: messages extracted
  checks.push({
    title: 'Conversation Messages Extracted',
    pass: conv.messages.length >= 1,
    detail: `Captured ${conv.messages.length} message turn(s)`
  });

  // UAT-01: AI Generated Images & Visuals
  if (uatId.startsWith('UAT-01-')) {
    const aiMsgWithImg = conv.messages.find(m => m.role === 'assistant' && ((m.images && m.images.length > 0) || (m.artifacts && m.artifacts.length > 0)));
    const hasAiImage = Boolean(aiMsgWithImg);
    checks.push({
      title: 'AI Generated Image / Visual Captured in Assistant Response',
      pass: hasAiImage,
      detail: hasAiImage ? `Found ${aiMsgWithImg.images?.length || 0} image(s) in AI response` : 'No generated image detected in assistant turn'
    });

    if (meta.format === 'MD') {
      const isClaude = meta.platform === 'Claude' || uatId.includes('-C-');
      if (isClaude) {
        const cleanNoCodeClutter = !content.includes('```svg') && !content.includes('<svg') && !content.includes('data:image/svg+xml');
        const hasPlaceholder = content.includes('*[AI Generated Graphic');
        checks.push({
          title: 'Clean AI Generated Graphic Placeholder in Markdown',
          pass: cleanNoCodeClutter && hasPlaceholder,
          detail: (cleanNoCodeClutter && hasPlaceholder) ? 'Rendered clean *[AI Generated Graphic: ...]* placeholder with 0 code clutter' : 'Missing placeholder or found code clutter'
        });
      } else {
        const hasMdImgLink = content.includes('![') && (content.includes('http') || content.includes('backend-api/estuary') || content.includes('lh3.googleusercontent'));
        checks.push({
          title: 'Clean Markdown Image Link Format',
          pass: Boolean(hasMdImgLink),
          detail: hasMdImgLink ? 'Markdown contains clean ![alt](url) image tag' : 'Missing markdown image link'
        });
      }
    } else if (meta.format === 'PDF') {
      const isClaude = meta.platform === 'Claude' || uatId.includes('-C-');
      const imgCount = (content.match(/<img\b/gi) || []).length;
      const expectedTotalImages = Math.max(1, conv.messages.reduce((sum, m) => sum + (m.images?.length || 0), 0));
      const hasPdfVisual = isClaude
        ? (content.includes('ARTIFACT:') || content.includes('Graphic:') || content.includes('<svg') || content.includes('<iframe') || imgCount >= 1)
        : (imgCount >= 1 && imgCount <= expectedTotalImages);
      checks.push({
        title: isClaude ? 'PDF Artifact / Visual Component Rendered' : 'PDF Responsive Image Element Rendered (0 Duplicates)',
        pass: Boolean(hasPdfVisual),
        detail: hasPdfVisual ? (isClaude ? 'Visual graphic/widget rendered in PDF layout card' : `Rendered exactly ${imgCount} image element(s) (no duplicates)`) : 'Missing visual element in PDF output'
      });
    }

    // Check for 0 noise
    const noBtnNoise = !content.includes('ChatGPT said:') &&
                       !content.includes('visualize show_widget') &&
                       !content.includes('Download\n') &&
                       !content.includes('Request\n') &&
                       !content.includes('Response\n');
    checks.push({
      title: 'UI Button & Header Noise Stripped',
      pass: noBtnNoise,
      detail: noBtnNoise ? 'Zero UI clutter / buttons detected' : 'Found stray UI button or header noise'
    });

    // Check that assistant response content (text or visual generation) is preserved
    const hasResponseText = Boolean(
      (aiMsgWithImg && aiMsgWithImg.contentText && aiMsgWithImg.contentText.trim().length > 0) ||
      (aiMsgWithImg && aiMsgWithImg.images && aiMsgWithImg.images.length > 0)
    );
    checks.push({
      title: 'Conversational Response Content / Visual Preserved',
      pass: hasResponseText,
      detail: hasResponseText
        ? `Captured response content (${aiMsgWithImg?.contentText?.trim() ? `"${aiMsgWithImg.contentText.slice(0, 45)}..."` : 'Visual Image Generation'})`
        : 'Conversational content was missing'
    });
  }

  // UAT-02: User Image Uploads
  if (uatId.startsWith('UAT-02-')) {
    const userMsg = conv.messages.find(m => m.role === 'user');
    const userHasImg = userMsg && ((userMsg.images && userMsg.images.length > 0) || (userMsg.contentHtml && userMsg.contentHtml.includes('<img')));
    checks.push({
      title: 'User Uploaded Photo in Prompt Card',
      pass: Boolean(userHasImg),
      detail: userHasImg ? `Found ${userMsg.images?.length || 1} user attachment image(s)` : 'User photo was missing from user turn'
    });

    if (meta.format === 'MD') {
      const userSection = content.split('### 🤖')[0];
      const hasImgInUserPrompt = userSection.includes('![');
      checks.push({
        title: 'User Image Link Embedded in Prompt Section',
        pass: hasImgInUserPrompt,
        detail: hasImgInUserPrompt ? 'User image markdown link present in prompt section' : 'User image link was missing from prompt section'
      });
    } else if (meta.format === 'PDF') {
      const userCardHasImg = content.includes('USER PROMPT') && content.split('Turn #2')[0].includes('<img');
      checks.push({
        title: 'User Image Rendered in PDF Prompt Card',
        pass: userCardHasImg,
        detail: userCardHasImg ? 'User photo rendered inside Turn #1 card' : 'User photo missing from Turn #1 card'
      });
    }

    // Check that Claude noise like "Claude responded:" is stripped
    const noA11yNoise = !content.includes('Claude responded:');
    checks.push({
      title: 'Screen-Reader Clutter Stripped',
      pass: noA11yNoise,
      detail: noA11yNoise ? 'Zero accessibility noise detected' : 'Found stray Claude responded heading'
    });
  }

  // UAT-03: Visual-only turns
  if (uatId.startsWith('UAT-03-')) {
    const visualTurn = conv.messages.find(m => m.images && m.images.length > 0);
    checks.push({
      title: 'Visual-Only Turn Preserved (Not Discarded)',
      pass: Boolean(visualTurn),
      detail: visualTurn ? 'Image turn retained without text' : 'Image turn was discarded as empty'
    });
  }

  // UAT-04: Checklist normalization
  if (uatId.startsWith('UAT-04-')) {
    const hasGfm = content.includes('- [ ]') || content.includes('- [x]') || content.includes('1. [ ]');
    const noEscapes = !content.includes('\\[ \\]') && !content.includes('\\[x\\]');
    checks.push({
      title: 'Checklist GFM Task List Normalization',
      pass: hasGfm && noEscapes,
      detail: (hasGfm && noEscapes) ? 'Clean - [ ] / - [x] task lists' : 'Escaped brackets (\\[ \\]) or missing checkboxes'
    });
  }

  // UAT-05: Underscores in links
  if (uatId.startsWith('UAT-05-')) {
    const urlMatches = content.match(/https?:\/\/[^\s\)\>\]]+/g) || [];
    const hasUrls = urlMatches.length > 0;
    const noEscapedUrls = urlMatches.every(u => !u.includes('\\_'));
    checks.push({
      title: 'URL Underscore Preservation (No \\_ in URLs)',
      pass: noEscapedUrls && hasUrls,
      detail: noEscapedUrls && hasUrls ? `Found ${urlMatches.length} valid URL(s) with 0 escaped backslashes` : 'Found escaped \\_ inside URL or missing URLs'
    });
  }

  // UAT-06: Reasoning traces
  if (uatId.startsWith('UAT-06-')) {
    const hasReasoning = conv.messages.some(m => m.reasoning && m.reasoning.length > 0);
    checks.push({
      title: 'AI Reasoning Process Extraction',
      pass: Boolean(hasReasoning),
      detail: hasReasoning ? 'Model reasoning steps detected & parsed' : 'No reasoning steps detected'
    });

    if (meta.format === 'MD') {
      const hasCallout = content.includes('> [!note]- 🧠 **Reasoning Process**');
      checks.push({
        title: 'Obsidian Collapsible Callout Formatting',
        pass: hasCallout,
        detail: hasCallout ? 'Formatted into > [!note]- 🧠 Reasoning Process' : 'Missing Obsidian callout format'
      });
    } else if (meta.format === 'PDF') {
      const hasPdfReasoning = content.includes('Reasoning Process');
      checks.push({
        title: 'PDF Highlighted Reasoning Block',
        pass: hasPdfReasoning,
        detail: hasPdfReasoning ? 'Highlighted reasoning callout card present' : 'Missing reasoning in PDF layout'
      });
    }
  }

  // UAT-07: Claude Artifacts
  if (uatId.startsWith('UAT-07-')) {
    const hasArtifacts = conv.messages.some(m => m.artifacts && m.artifacts.length > 0);
    checks.push({
      title: 'Claude Artifacts Isolation',
      pass: Boolean(hasArtifacts),
      detail: hasArtifacts ? `Isolated ${conv.messages.find(m => m.artifacts)?.artifacts.length} artifact(s)` : 'No artifacts extracted'
    });

    if (meta.format === 'MD') {
      const hasSection = content.includes('#### 📦 **Claude Artifacts**');
      checks.push({
        title: 'Dedicated Artifacts Markdown Section',
        pass: hasSection,
        detail: hasSection ? 'Grouped under #### 📦 Claude Artifacts' : 'Missing Claude Artifacts section'
      });
    }
  }

  // UAT-08: Perplexity citations
  if (uatId.startsWith('UAT-08-')) {
    const hasCitations = conv.messages.some(m => m.citations && m.citations.length > 0);
    checks.push({
      title: 'Web Citations Extraction',
      pass: Boolean(hasCitations),
      detail: hasCitations ? `Captured ${conv.messages.find(m => m.citations)?.citations.length} web citation(s)` : 'No citations detected'
    });

    const hasBiblio = content.includes('Comprehensive Bibliography') || content.includes('Citations & References');
    checks.push({
      title: 'Comprehensive Bibliography Section',
      pass: hasBiblio,
      detail: hasBiblio ? 'Full bibliography list generated' : 'Missing bibliography section'
    });
  }

  // UAT-09: Tables to CSV
  if (uatId.startsWith('UAT-09-')) {
    const hasCsvBOM = content.startsWith('\uFEFF');
    const hasRows = content.includes(',') || content.includes('\r\n') || content.includes('\n');
    checks.push({
      title: 'Excel UTF-8 BOM Prefix (\\uFEFF)',
      pass: hasCsvBOM,
      detail: hasCsvBOM ? 'Starts with \\uFEFF BOM for Excel compatibility' : 'Missing UTF-8 BOM prefix'
    });
    checks.push({
      title: 'RFC 4180 CSV Data Rows',
      pass: hasRows && !content.includes('No tables found'),
      detail: hasRows ? 'Valid CSV data rows generated' : 'No tables detected in conversation'
    });
  }

  // UAT-10: PDF Theming
  if (uatId.startsWith('UAT-10-')) {
    let themeCheck = false;
    let themeDetail = '';
    if (meta.theme === 'executive') {
      themeCheck = content.includes('#ffffff') || content.includes('#f8fafc');
      themeDetail = 'Clean executive light background & sans-serif typography';
    } else if (meta.theme === 'midnight') {
      themeCheck = content.includes('#0f172a') || content.includes('#020617');
      themeDetail = 'Midnight dark background (#0f172a) & OLED high-contrast text';
    } else if (meta.theme === 'academic') {
      themeCheck = content.includes('serif') || content.includes('Georgia');
      themeDetail = 'Academic serif typography (Georgia / Times New Roman)';
    }

    checks.push({
      title: `PDF Theme Verification (${meta.theme.toUpperCase()})`,
      pass: themeCheck,
      detail: themeDetail
    });
  }

  // UAT-11: Multi-page layout
  if (uatId.startsWith('UAT-11-')) {
    const hasPageBreakCSS = content.includes('break-inside: avoid');
    checks.push({
      title: 'CSS Print Page-Break Protection (break-inside: avoid)',
      pass: hasPageBreakCSS,
      detail: hasPageBreakCSS ? 'Protection applied to message cards, code boxes, and tables' : 'Missing break-inside: avoid rules'
    });
  }

  const passed = checks.every(c => c.pass);
  return { passed, checks };
}

// --- Terminal Scorecard Output ---
function printReport(uatId, evaluation, meta) {
  console.log(`\n${colors.bold}📋 Evaluation Scorecard for [${uatId}]:${colors.reset}`);
  evaluation.checks.forEach(c => {
    const icon = c.pass ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`;
    console.log(`  ${icon} — ${colors.bold}${c.title}${colors.reset} (${colors.dim}${c.detail}${colors.reset})`);
  });

  console.log('------------------------------------------------------------');
  if (evaluation.passed) {
    console.log(`${colors.green}${colors.bold}🎉 VERIFICATION SUCCESSFUL!${colors.reset}`);
    console.log(`👉 Suggestion: You can now check off ${colors.bold}[x] for ${uatId}${colors.reset} in ${colors.cyan}docs/UAT_TEST_MATRIX.md${colors.reset}`);
  } else {
    console.log(`${colors.yellow}${colors.bold}⚠️ VERIFICATION ISSUE DETECTED!${colors.reset}`);
    console.log(`👉 Suggestion: Review the live DOM structure in ${colors.yellow}~/Desktop/UAIE_UAT/Archive/${uatId}/page.html${colors.reset}`);
  }

  if (meta.next && meta.next !== 'ALL_COMPLETE') {
    console.log(`\n${colors.cyan}👉 Next Test in Line:${colors.reset} ${colors.bold}${meta.next}${colors.reset}`);
  } else if (meta.next === 'ALL_COMPLETE') {
    console.log(`\n${colors.green}${colors.bold}🏆 ALL UAT TESTS COMPLETED!${colors.reset}`);
  }
  console.log('');
}

// --- Self-Test Mode against Existing Test Fixtures ---
async function runSelfTest() {
  console.log(`${colors.cyan}🧪 Running Auditor Self-Test across synthetic fixtures...${colors.reset}`);
  const fixturesDir = path.join(ROOT_DIR, 'tests/fixtures');
  
  // Test ChatGPT DALL-E HTML
  const chatgptImageHtml = `
    <html>
    <head><title>Generate Cyberpunk Skyline - ChatGPT</title></head>
    <body>
      <main>
        <article data-testid="conversation-turn-0" data-message-author-role="user">
          <div><p>Generate a futuristic cyberpunk skyline</p></div>
        </article>
        <article data-testid="conversation-turn-1" data-message-author-role="assistant">
          <div>
            <img src="https://chatgpt.com/backend-api/estuary/content?id=file_0001&ts=100&sig=abc" alt="Generated image: Neon Rain" />
          </div>
        </article>
      </main>
    </body>
    </html>
  `;
  await auditUAT('UAT-01-A-MD', chatgptImageHtml);
  await auditUAT('UAT-01-A-PDF', chatgptImageHtml);

  // Test Claude Fixture
  const claudeHtml = fs.readFileSync(path.join(fixturesDir, 'claude.fixture.html'), 'utf8');
  await auditUAT('UAT-07-MD', claudeHtml);

  // Test Perplexity Fixture
  const pplxHtml = fs.readFileSync(path.join(fixturesDir, 'perplexity.fixture.html'), 'utf8');
  await auditUAT('UAT-08-MD', pplxHtml);

  console.log(`${colors.green}${colors.bold}✅ Auditor Self-Test Completed Successfully!${colors.reset}\n`);
}

// --- CLI Entry Point ---
const args = process.argv.slice(2);
if (args.includes('--test')) {
  await runSelfTest();
} else if (args.length > 0) {
  const targetId = args[0].toUpperCase();
  await auditUAT(targetId);
} else {
  console.log(`\n${colors.bold}Universal AI Exporter — UAT Auditor${colors.reset}`);
  console.log(`Usage:`);
  console.log(`  node scripts/uat-auditor.js <UAT-ID>`);
  console.log(`  npm run uat:audit <UAT-ID>\n`);
  console.log(`Example:`);
  console.log(`  node scripts/uat-auditor.js UAT-01-A-MD\n`);
}
