import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, rm } from 'node:fs/promises';
import { build, context } from 'esbuild';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.join(scriptsDir, '..');
const srcDir = path.join(extensionRoot, 'src');
const outDir = path.join(extensionRoot, 'dist');
const sharedIndex = path.join(extensionRoot, '..', '..', 'packages', 'shared', 'src', 'index.ts');
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: {
    background: path.join(srcDir, 'background', 'service-worker.ts'),
    panel: path.join(srcDir, 'panel', 'panel.ts'),
    content: path.join(srcDir, 'content', 'content.ts'),
  },
  bundle: true,
  outdir: outDir,
  format: 'iife',
  target: ['chrome114'],
  platform: 'browser',
  sourcemap: true,
  legalComments: 'none',
  alias: { '@agency-apply/shared': sharedIndex },
  logLevel: 'info',
};

const copyStatic = async () => {
  await cp(path.join(srcDir, 'manifest.json'), path.join(outDir, 'manifest.json'));
  await cp(path.join(srcDir, 'panel', 'panel.html'), path.join(outDir, 'panel.html'));
  await cp(path.join(srcDir, 'panel', 'panel.css'), path.join(outDir, 'panel.css'));
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await copyStatic();

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('extension: watching for changes');
} else {
  await build(options);
}
