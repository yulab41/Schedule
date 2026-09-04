import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertInstallAuthorized,
  isDependencyMutation,
} from './install-tripwire.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('classifies dependency mutations without treating allowed commands as installs', () => {
  for (const command of [
    ['install'],
    ['i', '--frozen-lockfile'],
    ['add', 'zod'],
    ['remove', 'zod'],
    ['update'],
    ['fetch', '--offline'],
    ['rebuild'],
    ['prune'],
    ['store', 'prune'],
    ['--dir', 'slot', 'install'],
  ]) assert.equal(isDependencyMutation(command), true, command.join(' '));
  for (const command of [
    ['test'],
    ['run', 'test'],
    ['exec', 'vitest'],
    ['list'],
    ['store', 'path'],
    ['config', 'get', 'storeDir'],
  ]) assert.equal(isDependencyMutation(command), false, command.join(' '));
});

test('allows no-op pnpmfile loading for non-mutation commands only', () => {
  assert.deepEqual(assertInstallAuthorized({ cwd: root, arguments_: ['test'] }), {
    mutation: false,
    authorized: true,
  });
  const tripwire = fs.readFileSync(path.join(root, 'scripts/codex/install-tripwire.cjs'), 'utf8');
  assert.match(tripwire, /single-use|singleUse/iu);
  assert.match(tripwire, /lockfileSha256/iu);
  assert.match(tripwire, /targetWorktree/iu);
  assert.match(tripwire, /nodeVersion/iu);
  assert.match(tripwire, /pnpmVersion/iu);
  assert.doesNotMatch(tripwire, /SCHEDULE_[A-Z_]+\s*===\s*['"]?1/iu);
});

test('the project pnpmfile is independent of Codex Hooks and has no install bypass', () => {
  const pnpmfile = fs.readFileSync(path.join(root, '.pnpmfile.cjs'), 'utf8');
  const maintenance = fs.readFileSync(path.join(root, 'scripts/codex/dependency-maintenance.ps1'), 'utf8');
  assert.match(pnpmfile, /install-tripwire\.cjs/iu);
  assert.match(pnpmfile, /module\.exports\s*=\s*\{\s*\}/iu);
  assert.doesNotMatch(pnpmfile, /hook\.json|schedule-project-hook/iu);
  assert.match(maintenance, /lockfileSha256/iu);
  assert.match(maintenance, /singleUse\s*=\s*\$true/iu);
  assert.match(maintenance, /--frozen-lockfile/iu);
  assert.match(maintenance, /--offline/iu);
  assert.doesNotMatch(maintenance, /--force/iu);
  assert.doesNotMatch(maintenance, /-AuthorizationFile\s+<|user-created/iu);
});
