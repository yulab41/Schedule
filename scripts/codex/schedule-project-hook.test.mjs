import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEPENDENCY_MUTATION_REASON,
  SCHEDULE_HOOK_CONTEXT,
  classifyCommand,
  detectScheduleProject,
  handleHookEvent,
  releaseOwnedLeases,
} from './schedule-project-hook.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const commonDir = path.join(root, '.git');
const temporaryDirectories = [];

function temporaryDirectory() {
  const runtimeRoot = path.join(root, 'runtime');
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runtimeRoot, 'codex-test-hook-'));
  temporaryDirectories.push(directory);
  return directory;
}

function fakeGit(cwd, arguments_) {
  if (arguments_[0] === 'rev-parse' && arguments_[1] === '--show-toplevel') return root;
  if (arguments_[0] === 'rev-parse' && arguments_[1] === '--git-common-dir') return commonDir;
  if (arguments_[0] === 'rev-parse' && arguments_[1] === '--absolute-git-dir') return path.join(cwd, 'admin');
  if (arguments_[0] === 'status') return '';
  return undefined;
}

function event(eventName, command, overrides = {}) {
  return {
    event: eventName,
    cwd: root,
    tool_name: 'Bash',
    tool_input: command === undefined ? {} : { command },
    ...overrides,
  };
}

test.after(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

test('blocks direct and wrapped dependency mutations but allows test commands', () => {
  const poolRoot = path.join(root, 'runtime', 'synthetic-pool');
  const blocked = [
    'pnpm install',
    'pnpm i --frozen-lockfile',
    'cmd /c pnpm install',
    'powershell -Command "pnpm install"',
    "bash -c 'pnpm install'",
    'CI=true pnpm install',
    '& pnpm.cmd install',
    "'pnpm' install",
    '"pnpm.exe" i',
    'pnpm store prune',
    'npm ci',
    'yarn upgrade',
    'git clean -xfd',
    'Remove-Item -Recurse -Force node_modules',
  ];
  for (const command of blocked) assert.equal(classifyCommand(command, { cwd: root, poolRoot }).blocked, true, command);
  const allowed = [
    'pnpm test',
    'pnpm exec vitest',
    'pnpm --filter @schedule/miniprogram test',
    'pnpm --filter @schedule/miniprogram build',
    'pnpm run test',
    'pnpm list',
    'pnpm store path',
    'echo "pnpm install"',
    'cmd /c echo "pnpm install"',
    'powershell -Command "Write-Output \'pnpm install\'"',
    'node scripts/install-fixture.test.mjs',
  ];
  for (const command of allowed) assert.equal(classifyCommand(command, { cwd: root, poolRoot }).blocked, false, command);
});

test('blocks recursive cleanup in a persistent slot', () => {
  const poolRoot = path.join(root, 'runtime', 'synthetic-pool');
  assert.equal(classifyCommand('rm -rf dist', { cwd: path.join(poolRoot, 'general-1'), poolRoot }).blocked, true);
  assert.equal(classifyCommand(`Remove-Item -Recurse ${path.join(poolRoot, 'general-1', 'dist')}`, { cwd: root, poolRoot }).blocked, true);
  assert.equal(classifyCommand('rm -rf runtime/test-output', { cwd: root, poolRoot }).blocked, false);
});

test('injects context only for Schedule and denies PreToolUse without authorization', () => {
  const config = {
    commonDir: '.git',
    poolRoot: 'runtime/synthetic-pool',
    stateRoot: 'runtime/codex',
    authorizationDir: 'runtime/codex/dependency-maintenance-authorizations',
  };
  const detected = detectScheduleProject({ cwd: root, config, git: fakeGit });
  assert.equal(detected.poolRoot, path.join(root, 'runtime', 'synthetic-pool'));
  assert.equal(detected.stateRoot, path.join(root, 'runtime', 'codex'));
  assert.equal(detected.authorizationDir, path.join(root, 'runtime', 'codex', 'dependency-maintenance-authorizations'));
  assert.ok(SCHEDULE_HOOK_CONTEXT.length <= 250);
  const scheduleStart = handleHookEvent(event('SessionStart'), { config, git: fakeGit });
  assert.equal(scheduleStart.additionalContext.includes('REUSE_ONLY'), true);
  const prompt = handleHookEvent(event('UserPromptSubmit'), { config, git: fakeGit });
  assert.equal(prompt.additionalContext.includes('warm slot'), true);
  const denial = handleHookEvent(event('PreToolUse', 'powershell -Command "pnpm install"'), { config, git: fakeGit });
  assert.deepEqual(denial, { decision: 'deny', reason: DEPENDENCY_MUTATION_REASON });
  const nonSchedule = handleHookEvent(
    { ...event('PreToolUse', 'pnpm install'), cwd: root },
    { config: { ...config, commonDir: path.join(root, 'not-schedule', '.git') }, git: fakeGit },
  );
  assert.equal(nonSchedule, undefined);
  const nonScheduleContext = handleHookEvent(
    { ...event('SessionStart'), cwd: root },
    { config: { ...config, commonDir: path.join(root, 'not-schedule', '.git') }, git: fakeGit },
  );
  assert.equal(nonScheduleContext, undefined);
});

test('SessionEnd removes only the owning lease and preserves node_modules', () => {
  const poolRoot = temporaryDirectory();
  const slot = path.join(poolRoot, 'general-1');
  const state = path.join(poolRoot, 'state');
  const leaseRoot = path.join(state, 'leases');
  const leasePath = path.join(leaseRoot, 'general-1.json');
  const nodeModulesMarker = path.join(slot, 'node_modules', 'keep.txt');
  fs.mkdirSync(path.dirname(nodeModulesMarker), { recursive: true });
  fs.mkdirSync(leaseRoot, { recursive: true });
  fs.writeFileSync(nodeModulesMarker, 'keep\n');
  fs.writeFileSync(leasePath, JSON.stringify({
    pid: -1,
    path: slot,
    sessionId: 'session-1',
    taskId: 'thread-1',
  }));
  const released = releaseOwnedLeases({
    project: { poolRoot, stateRoot: state },
    event: { session_id: 'session-1', thread_id: 'thread-1' },
    git: (cwd, arguments_) => {
      if (arguments_[0] === 'rev-parse') return root;
      if (arguments_[0] === 'status') return '';
      return undefined;
    },
  });
  assert.equal(released, 1);
  assert.equal(fs.existsSync(leasePath), false);
  assert.equal(fs.existsSync(nodeModulesMarker), true);
});
