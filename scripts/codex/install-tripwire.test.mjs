import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CI_INSTALL_CHANNEL,
  assertInstallAuthorized,
  isCiFreshInstall,
  isDependencyMutation,
  isGithubActionsFreshCheckout,
} from './install-tripwire.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const originRemote = execFileSync('git', ['-C', root, 'config', '--get', 'remote.origin.url'], {
  encoding: 'utf8',
}).trim();
const originMatch = originRemote
  .replace(/\.git$/iu, '')
  .match(/(?:https?:\/\/|git@)([^/:]+)[/:]([^/]+\/[^/]+)$/iu);
assert.equal(originMatch?.[1]?.toLocaleLowerCase('en-US'), 'github.com');
const githubRepository = originMatch[2];

function githubFreshInstallEnvironment(overrides = {}) {
  return {
    ...process.env,
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_WORKSPACE: root,
    GITHUB_REPOSITORY: githubRepository,
    GITHUB_RUN_ID: 'synthetic-run-1',
    GITHUB_WORKFLOW: 'Verify',
    GITHUB_EVENT_NAME: 'push',
    RUNNER_OS: 'Linux',
    SCHEDULE_CI_INSTALL_CHANNEL: CI_INSTALL_CHANNEL,
    ...overrides,
  };
}

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
  ])
    assert.equal(isDependencyMutation(command), true, command.join(' '));
  for (const command of [
    ['test'],
    ['run', 'test'],
    ['exec', 'vitest'],
    ['list'],
    ['store', 'path'],
    ['config', 'get', 'storeDir'],
  ])
    assert.equal(isDependencyMutation(command), false, command.join(' '));
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

test('allows only the explicitly marked GitHub Actions frozen fresh install', () => {
  const arguments_ = ['install', '--frozen-lockfile'];
  const env = githubFreshInstallEnvironment();
  assert.equal(isCiFreshInstall(arguments_), true);
  assert.equal(isCiFreshInstall(['i', '--frozen-lockfile']), false);
  assert.equal(isCiFreshInstall(['--dir', 'slot', 'install', '--frozen-lockfile']), false);
  assert.equal(isGithubActionsFreshCheckout({ cwd: root, arguments_, env }), true);
  assert.deepEqual(assertInstallAuthorized({ cwd: root, arguments_, env }), {
    mutation: true,
    authorized: true,
    authorizationSource: CI_INSTALL_CHANNEL,
  });

  assert.throws(
    () =>
      assertInstallAuthorized({
        cwd: root,
        arguments_,
        env: githubFreshInstallEnvironment({ SCHEDULE_CI_INSTALL_CHANNEL: undefined }),
      }),
    /unauthorized dependency mutation/iu,
  );
  assert.throws(
    () => assertInstallAuthorized({ cwd: root, arguments_: ['install'], env }),
    /unauthorized dependency mutation/iu,
  );
  assert.throws(
    () => assertInstallAuthorized({ cwd: root, arguments_: ['add', 'zod'], env }),
    /unauthorized dependency mutation/iu,
  );
  assert.throws(
    () =>
      assertInstallAuthorized({
        cwd: root,
        arguments_,
        env: githubFreshInstallEnvironment({ GITHUB_ACTIONS: 'false' }),
      }),
    /unauthorized dependency mutation/iu,
  );

  const workflow = fs.readFileSync(path.join(root, '.github/workflows/verify.yml'), 'utf8');
  assert.match(workflow, /SCHEDULE_CI_INSTALL_CHANNEL:\s*github-actions-fresh-checkout/iu);
  assert.match(workflow, /pnpm install --frozen-lockfile/iu);
});

test('the project pnpmfile is independent of Codex Hooks and has no install bypass', () => {
  const pnpmfile = fs.readFileSync(path.join(root, '.pnpmfile.cjs'), 'utf8');
  const maintenance = fs.readFileSync(
    path.join(root, 'scripts/codex/dependency-maintenance.ps1'),
    'utf8',
  );
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
