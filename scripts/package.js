import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const RELEASES_DIR = path.join(ROOT_DIR, 'releases');

/**
 * Creates a zip archive from a source directory
 */
function createZip(sourceDir, outZipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      const sizeMb = (archive.pointer() / 1024 / 1024).toFixed(2);
      const sizeKb = (archive.pointer() / 1024).toFixed(1);
      console.log(`📦 Created package: ${path.basename(outZipPath)} (${sizeKb} KB)`);
      resolve(outZipPath);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function packageAll() {
  console.log('\n🗜️  Starting Universal AI Exporter Release Packaging...');

  if (!fs.existsSync(RELEASES_DIR)) {
    fs.mkdirSync(RELEASES_DIR, { recursive: true });
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const version = pkg.version || '1.0.0';

  const packages = [
    {
      sourceDir: path.join(ROOT_DIR, 'dist/chromium'),
      zipName: `universal-ai-exporter-edge-v${version}.zip`,
      targetName: 'Microsoft Edge Add-ons'
    },
    {
      sourceDir: path.join(ROOT_DIR, 'dist/firefox'),
      zipName: `universal-ai-exporter-firefox-v${version}.zip`,
      targetName: 'Mozilla Firefox AMO'
    },
    {
      sourceDir: path.join(ROOT_DIR, 'dist/chromium'),
      zipName: `universal-ai-exporter-chrome-v${version}.zip`,
      targetName: 'Google Chrome Web Store / Brave / Opera'
    }
  ];

  for (const item of packages) {
    if (!fs.existsSync(item.sourceDir)) {
      throw new Error(`Build directory not found: ${item.sourceDir}. Run 'npm run build' first.`);
    }

    const outPath = path.join(RELEASES_DIR, item.zipName);
    // Also place in root directory for instant upload convenience
    const rootOutPath = path.join(ROOT_DIR, item.zipName);

    await createZip(item.sourceDir, outPath);
    fs.copyFileSync(outPath, rootOutPath);
  }

  console.log(`\n🎉 All packages generated and ready for store submission in releases/ and root folder!\n`);
}

packageAll().catch(err => {
  console.error('❌ Packaging failed:', err);
  process.exit(1);
});
