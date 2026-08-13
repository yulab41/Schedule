import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceEntry = fileURLToPath(new URL('../src/index.ts', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const miniProgramOutputDirectory = fileURLToPath(new URL('../dist/miniprogram/', import.meta.url));

await rm(outputDirectory, { force: true, recursive: true });
await Promise.all([
  mkdir(outputDirectory, { recursive: true }),
  mkdir(miniProgramOutputDirectory, { recursive: true }),
]);

const sharedOptions = {
  absWorkingDir: packageRoot,
  bundle: true,
  entryPoints: [sourceEntry],
  legalComments: 'none',
  logLevel: 'warning',
  metafile: true,
  minify: true,
  platform: 'neutral',
  sourcemap: true,
  target: 'es2020',
  treeShaking: true,
};

const [esmResult, commonJsResult, miniProgramResult] = await Promise.all([
  build({
    ...sharedOptions,
    format: 'esm',
    outfile: fileURLToPath(new URL('../dist/index.js', import.meta.url)),
  }),
  build({
    ...sharedOptions,
    format: 'cjs',
    outfile: fileURLToPath(new URL('../dist/index.cjs', import.meta.url)),
  }),
  build({
    ...sharedOptions,
    format: 'cjs',
    outfile: fileURLToPath(new URL('../dist/miniprogram/index.js', import.meta.url)),
    target: 'es2017',
  }),
]);

await Promise.all([
  writeFile(
    fileURLToPath(new URL('../dist/miniprogram/package.json', import.meta.url)),
    `${JSON.stringify({ type: 'commonjs' })}\n`,
    'utf8',
  ),
  writeFile(
    fileURLToPath(new URL('../dist/index.esm.meta.json', import.meta.url)),
    `${JSON.stringify(esmResult.metafile)}\n`,
    'utf8',
  ),
  writeFile(
    fileURLToPath(new URL('../dist/index.cjs.meta.json', import.meta.url)),
    `${JSON.stringify(commonJsResult.metafile)}\n`,
    'utf8',
  ),
  writeFile(
    fileURLToPath(new URL('../dist/miniprogram/meta.json', import.meta.url)),
    `${JSON.stringify(miniProgramResult.metafile)}\n`,
    'utf8',
  ),
]);
