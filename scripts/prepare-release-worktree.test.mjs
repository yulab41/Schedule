import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PNPM_INSTALL_ARGUMENTS,
  collectDependencyInputs,
  computeDependencyFingerprint,
  parseArguments,
  parseWorktreeList,
  resolvePnpmInvocation,
  shouldReuseDependencies,
} from './prepare-release-worktree.mjs';

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

function createTemporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-release-worktree-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('reusable isolated release worktree', () => {
  it('defaults to HEAD and accepts an explicit commit and absolute worktree path', () => {
    expect(parseArguments([])).toEqual({ commit: 'HEAD', json: false, worktreePath: undefined });

    const worktreePath = path.resolve('E:/isolated/schedule-release');
    expect(parseArguments(['--commit', 'abc1234', '--path', worktreePath, '--json'])).toEqual({
      commit: 'abc1234',
      json: true,
      worktreePath,
    });
  });

  it('parses registered detached worktrees without treating their paths as disposable folders', () => {
    const entries = parseWorktreeList(
      [
        'worktree E:/AItools/Schedule',
        'HEAD f070b69600000000000000000000000000000000',
        'branch refs/heads/main',
        '',
        'worktree E:/AItools/Schedule-release-worktree',
        'HEAD 7f4f70a000000000000000000000000000000000',
        'detached',
        '',
      ].join('\n'),
    );

    expect(entries).toEqual([
      {
        branch: 'refs/heads/main',
        detached: false,
        head: 'f070b69600000000000000000000000000000000',
        path: path.normalize('E:/AItools/Schedule'),
      },
      {
        branch: undefined,
        detached: true,
        head: '7f4f70a000000000000000000000000000000000',
        path: path.normalize('E:/AItools/Schedule-release-worktree'),
      },
    ]);
  });

  it('fingerprints every tracked pnpm dependency input and changes when one changes', () => {
    const root = createTemporaryDirectory();
    const files = [
      '.npmrc',
      'apps/api/package.json',
      'package.json',
      'patches/example.patch',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
    ];

    for (const relativePath of files) {
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, `${relativePath}\n`, 'utf8');
    }

    expect(collectDependencyInputs(files)).toEqual(files);
    const first = computeDependencyFingerprint(root, files);
    fs.appendFileSync(path.join(root, 'apps/api/package.json'), 'changed\n');
    expect(computeDependencyFingerprint(root, files)).not.toBe(first);
  });

  it('reuses dependencies only when node_modules and the worktree-local fingerprint agree', () => {
    const root = createTemporaryDirectory();
    const gitDirectory = path.join(root, '.git-worktree');
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    fs.mkdirSync(gitDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(gitDirectory, 'schedule-release-dependencies.json'),
      JSON.stringify({ fingerprint: 'same' }),
      'utf8',
    );

    expect(shouldReuseDependencies(root, gitDirectory, 'same')).toBe(true);
    expect(shouldReuseDependencies(root, gitDirectory, 'different')).toBe(false);
    fs.rmSync(path.join(root, 'node_modules'), { recursive: true });
    expect(shouldReuseDependencies(root, gitDirectory, 'same')).toBe(false);
  });

  it('invokes the pnpm JavaScript entry directly on Windows instead of spawning pnpm.cmd', () => {
    const appData = createTemporaryDirectory();
    const cliPath = path.join(appData, 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.mjs');
    fs.mkdirSync(path.dirname(cliPath), { recursive: true });
    fs.writeFileSync(cliPath, '', 'utf8');

    expect(
      resolvePnpmInvocation({ APPDATA: appData }, 'win32', 'C:/Program Files/nodejs/node.exe'),
    ).toEqual({
      argumentsPrefix: [cliPath],
      command: 'C:/Program Files/nodejs/node.exe',
    });
  });

  it('keeps unapproved dependency scripts blocked without failing the reusable install', () => {
    expect(PNPM_INSTALL_ARGUMENTS).toEqual([
      'install',
      '--frozen-lockfile',
      '--config.strictDepBuilds=false',
    ]);
  });
});
