import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Bundle TypeScript test files
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

// 2. Execute via Node's native test runner
const result = spawnSync(process.execPath, ['--test', testBundleOut], {
  stdio: 'inherit',
  cwd: ROOT_DIR
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
