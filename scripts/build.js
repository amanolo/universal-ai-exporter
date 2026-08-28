import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAllIcons } from './generate-icons.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Command line argument parser
const args = process.argv.slice(2);
const targetArgIndex = args.indexOf('--target');
const target = targetArgIndex !== -1 ? args[targetArgIndex + 1] : 'all'; // 'chromium', 'firefox', or 'all'

async function buildTarget(targetName) {
  const isFirefox = targetName === 'firefox';
  const outDir = path.join(ROOT_DIR, 'dist', targetName);

  console.log(`\n🔨 Building target: [${targetName.toUpperCase()}] -> ${outDir}`);

  // Clean output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Bundle TypeScript entry points
  const entryPoints = [
    { in: path.join(ROOT_DIR, 'src/content/content.ts'), out: 'content/content' },
    { in: path.join(ROOT_DIR, 'src/popup/popup.ts'), out: 'popup/popup' },
    { in: path.join(ROOT_DIR, 'src/background/service-worker.ts'), out: 'background/service-worker' }
  ];

  await esbuild.build({
    entryPoints,
    bundle: true,
    outdir: outDir,
    format: 'iife',
    platform: 'browser',
    target: ['chrome110', 'firefox110', 'edge110'],
    minify: false,
    sourcemap: false,
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.TARGET_BROWSER': JSON.stringify(targetName)
    },
    loader: {
      '.ts': 'ts'
    }
  });

  // 2. Copy static files & styles
  const copyTasks = [
    { src: 'src/popup/popup.html', dest: 'popup/popup.html' },
    { src: 'src/popup/popup.css', dest: 'popup/popup.css' },
    { src: 'src/content/floating-toolbar.css', dest: 'content/floating-toolbar.css' }
  ];

  copyTasks.forEach(task => {
    const srcPath = path.join(ROOT_DIR, task.src);
    const destPath = path.join(outDir, task.dest);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  });

  // 3. Generate & copy icons
  const iconsDestDir = path.join(outDir, 'icons');
  generateAllIcons(iconsDestDir);

  // 4. Copy appropriate manifest
  const manifestSrc = isFirefox
    ? path.join(ROOT_DIR, 'src/manifest.firefox.json')
    : path.join(ROOT_DIR, 'src/manifest.chromium.json');
  const manifestDest = path.join(outDir, 'manifest.json');
  fs.copyFileSync(manifestSrc, manifestDest);

  console.log(`✅ [${targetName.toUpperCase()}] build completed successfully.`);
}

async function buildAll() {
  console.log('🚀 Starting Universal AI Exporter Build Pipeline...');
  const start = performance.now();

  if (target === 'all' || target === 'chromium') {
    await buildTarget('chromium');
  }
  if (target === 'all' || target === 'firefox') {
    await buildTarget('firefox');
  }

  const duration = ((performance.now() - start) / 1000).toFixed(2);
  console.log(`\n✨ All builds compiled cleanly in ${duration}s!`);
}

buildAll().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
