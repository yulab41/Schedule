/* global process */

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  windowsHide: true,
});

if (result.error || result.status !== 0 || !result.stdout?.trim()) process.exit(0);

const checkoutRoot = path.resolve(result.stdout.trim());
const localDirectory = path.dirname(fileURLToPath(import.meta.url));
process.env.SCHEDULE_HOOK_CONFIG ??= path.join(localDirectory, 'project.json');

const sourceScript = pathToFileURL(path.join(checkoutRoot, 'scripts', 'codex', 'schedule-project-hook.mjs')).href;
const { main } = await import(sourceScript);
main();
