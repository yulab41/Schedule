/* global console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniIconDirectory = path.join(repositoryRoot, 'apps/miniprogram/src/assets/icons');
const outputPaths = [
  path.join(repositoryRoot, 'apps/web/src/generated/ui-icon-motion.css'),
  path.join(repositoryRoot, 'apps/miniprogram/src/styles/ui-icon-motion.wxss'),
];

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function snapshot() {
  const files = [
    ...fs
      .readdirSync(miniIconDirectory)
      .filter((fileName) => fileName.endsWith('.svg'))
      .sort()
      .map((fileName) => path.join(miniIconDirectory, fileName)),
    ...outputPaths,
  ];
  return Object.fromEntries(
    files.map((filePath) => [path.relative(repositoryRoot, filePath), hashFile(filePath)]),
  );
}

function run(command) {
  execFileSync(process.execPath, [path.join(repositoryRoot, command)], {
    cwd: repositoryRoot,
    stdio: 'inherit',
  });
}

run('packages/ui-icons/scripts/generate-miniprogram-assets.mjs');
run('packages/ui-icons/scripts/generate-motion-adapters.mjs');
const first = snapshot();
run('packages/ui-icons/scripts/generate-miniprogram-assets.mjs');
run('packages/ui-icons/scripts/generate-motion-adapters.mjs');
const second = snapshot();

const firstJson = JSON.stringify(first);
const secondJson = JSON.stringify(second);
const result = {
  deterministic: firstJson === secondJson,
  fileCount: Object.keys(second).length,
  firstHash: hashFile(path.join(repositoryRoot, 'apps/miniprogram/src/styles/ui-icon-motion.wxss')),
};
console.log(JSON.stringify(result, null, 2));
if (!result.deterministic) {
  console.error('[ui-icons] generator output changed between consecutive runs');
  process.exitCode = 1;
}
